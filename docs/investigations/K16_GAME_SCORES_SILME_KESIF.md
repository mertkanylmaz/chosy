# K-16 KEŞİF — `game_scores` hesap silme zincirinde neden yok

- Tarih: 4 Eki 2026 · Mod: READ-ONLY (migration yok, DELETE yok)
- Canlı veri: `supabase db query --linked` (SELECT) + Supabase log akışı (MCP `query_logs`, salt okunur).
- Kimlikler raporda **yalnız ilk 8 karakterle** geçer.

## Yönetici özeti

1. **Silme FK CASCADE'e dayanıyor, Edge Function tablo tablo silmiyor.** `delete-account` yalnız
   `subscriptions`, `mood_searches` ve `public.users` satırını siler; geri kalan her şey
   `public.users(id)`'ye bağlı `ON DELETE CASCADE` FK'lerle gider. `merge_anonymous_user` (122/123)
   de anonim kullanıcıyı aynı yolla (`DELETE FROM users`) siler.
2. **`game_scores.user_id`'de FK yok** (016'dan beri: `user_id UUID NOT NULL`, REFERENCES yok).
   Bu yüzden iki silme yolu da `game_scores` satırlarını bırakır. Kod tarafında `game_scores`'u
   silen tek yer `dev-reset-games` (geliştirme, allowlist'li).
3. **Ölçüm: 18 satırın 17'si yetim** (6 kullanıcı). 17'sinin `user_id`'si ne `public.users.id`'de
   ne `auth.users.id`'de var — kimlik uzayı karışıklığı değil, silinmiş kullanıcı.
4. **Yetimlerin 4 kullanıcısı (5 satır) son 5 günden** ve log zaman çizelgesi founder test akışıyla
   (anonim oyna → merge → delete-account) uyumlu. Temmuz'daki 2 kullanıcının (12 satır) logları bu
   turda sorgulanmadı. Borç 7 Ağu'dan beri kayıtlı (TEKNIK_BORC:302, o gün 9 satır).
5. FK'siz başka kimlik kolonları: `trial_claims.user_id`, `api_rate_limits.user_id` (text),
   `custom_lists.user_id` (text), `watchlist.device_id`, `subscriptions.rc_customer_id`,
   `users.auth_id` (text). Ölçülen tablolarda yetim **0** (çoğu boş).

## Önceki kayıtlar

- `docs/TEKNIK_BORC.md:302-314` — "game_scores — 9 sahipsiz satır" (7 Ağu 2026, migration 070):
  9 ölü satır, FK yok, "temizlik + FK ayrı migration". **Bugün 17** (Temmuz'un 12 satırı + Eylül/Ekim'in 5'i;
  070'te 12 satırın 3'ü sahipliydi; bugün Temmuz'un 12 satırının hepsi yetim → c6140c44'ün 3 satırı
  070'ten sonra yetim kaldı, kullanıcısının silinme tarihi doğrulanmadı).
- `supabase/migrations/070_fix_app_user_policies.sql:22-24` — aynı 9 satır, "bilinçli olarak dokunulmuyor".
- `docs/TEKNIK_BORC.md:3178-3182` — merge (122) bölümü §5: "`game_scores.user_id` FK yok — anonim
  Spotlight ilerlemesi öksüz kalır". Yani merge kaynaklı yetim **biliniyordu**; yeni olan, delete-account
  yolunun da aynı sonucu ürettiğinin ölçümü ve sayının büyümesi.

## Bulgular tablosu

| Kaynak | Açıklama | Büyüklük |
|---|---|---|
| `supabase/functions/delete-account/index.ts:260-310` | Manuel silme: `subscriptions` (`:263`), `mood_searches` (`:278`), `users` (`:294`). Başlık yorumu `:10-11` "public.users'a bağlı 26 FK'nin biri hariç hepsi CASCADE" — `game_scores` bu 26'nın içinde değil, çünkü FK'si yok. | — |
| `supabase/migrations/016_game_tables.sql:17-25` | `game_scores.user_id UUID NOT NULL` — REFERENCES yok. `puzzle_id` FK'li (`daily_puzzles ON DELETE CASCADE`). | — |
| Canlı `pg_constraint` | `game_scores`: yalnız `pkey`, `puzzle_id_fkey`, `UNIQUE (user_id, puzzle_id)`. | — |
| `supabase/migrations/122_merge_anonymous_user.sql:150-151` | `DELETE FROM users WHERE id = p_from` — "taşınmayan her şey CASCADE ile gider" (`:25-31`). `game_scores` CASCADE'siz → anonim kullanıcının oyun skorları yetim kalır; v1 kapsamı skorları taşımıyor (`:10-12`). | — |
| `supabase/functions/dev-reset-games/index.ts:4, 122` | `game_scores`'ta bilinçli DELETE yalnız burada (dev allowlist, 068). | — |
| Canlı `pg_policies` | `game_scores` RLS'i `user_id = app_user_id()` (app kimlik uzayı). 016'daki `auth.uid() = user_id` sonradan düzeltilmiş (070). Yazıcı da app kimliği kullanıyor: `submit-guess/index.ts:212-216` `resolveAppUser` → `appUser.id`. Kimlik uzayı tutarlı. | — |
| Önerilen düzeltme (aşağıda) | FK + CASCADE | S (migration) + veri temizliği |

## Ölçülmüş sayılar

```sql
select count(*) as total,
       count(*) filter (where u.id is null) as orphan_vs_users,
       count(*) filter (where u.id is null and au.id is not null) as orphan_but_auth_uid,
       count(*) filter (where u.id is null and au.id is null) as orphan_nowhere,
       count(distinct gs.user_id) filter (where u.id is null) as orphan_users
from game_scores gs
left join public.users u on u.id = gs.user_id
left join auth.users au on au.id = gs.user_id;
-- total 18 · orphan_vs_users 17 · orphan_but_auth_uid 0 · orphan_nowhere 17 · orphan_users 6
```

Kullanıcı bazında (kimlik ilk 8 karakter; `matches_auth_id` = `public.users.auth_id` ile eşleşme):

| uid8 | Satır | Bitmemiş | Oyunlar | Bulmaca tarihleri | Son `completed_at` (UTC) | `auth_id` eşleşmesi |
|---|---|---|---|---|---|---|
| 260fde57 | 9 | 5 | cinemetrics, detective, fadein, imposter, logline, spotlight | 24–30 Tem | 29 Tem 18:39 | yok |
| c6140c44 | 3 | 2 | cinemetrics, detective, imposter | 31 Tem–1 Ağu | 30 Tem 18:49 | yok |
| 81832313 | 2 | 1 | spotlight | 1–3 Eki | 3 Eki 16:31 | yok |
| 5928ce74 | 1 | 0 | spotlight | 4 Eki | 3 Eki 21:13 | yok |
| ddfb7c06 | 1 | 0 | spotlight | 4 Eki | 4 Eki 13:42 | yok |
| fdd983a4 | 1 | 0 | spotlight | 30 Eyl | 30 Eyl 15:51 | yok |

Toplam 17 satır. Yetim olmayan tek satır var (18 − 17).

### Yetimler kimden — log zaman çizelgesi
`query_logs`, `function_logs` / `function_edge_logs`, mesaj filtresi `Hesap tamamen silindi` /
`[merge-anonymous-user]`:

| Zaman (UTC) | Olay |
|---|---|
| 30 Eyl 15:51 | fdd983a4 Spotlight bitirdi |
| 1 Eki 08:30 | `delete-account` (auth 9b109425…) |
| 3 Eki 10:42 → 16:34 | 4× `merge-anonymous-user` → hedef **81832313** (`target_won` / `merged`) |
| 3 Eki 16:31 | 81832313 Spotlight bitirdi |
| 3 Eki 16:33 | `delete-account` (auth 51442ac7…) |
| 3 Eki 21:13 | 5928ce74 Spotlight bitirdi |
| 4 Eki 13:40:08 | `merge-anonymous-user` → hedef 81832313 (`target_won`) |
| 4 Eki 13:40:43 | `delete-account` (auth f24a9e93…) |
| 4 Eki 13:42 | ddfb7c06 Spotlight bitirdi |
| 4 Eki 14:53 | `delete-account` (auth a61dd644…) |

Okuma: her yetim kullanıcının son oyunundan sonra bir `delete-account` ya da `merge` (anonim
kaynak silinir) var. 81832313 merge **hedefiydi** ve 4 Eki 13:40'taki merge'den 35 s sonra bir
delete-account geldi — hedef hesabın silindiği akışla uyumlu. Bu akış founder test döngüsüne
benziyor (anonim oyna → Apple ile gir → merge → hesabı sil).

**Eşleme kanıtlanamaz:** log auth kimliği verir, yetim satır app kimliği taşır; ilgili
`public.users` satırları silindiği için auth ↔ app eşlemesi artık yok. Zamanlama uyumu kanıt değil.

### FK'siz diğer kimlik kolonları (şema taraması)
```sql
-- information_schema.columns (public, BASE TABLE, ad ~* user|device|auth|owner|player|profile|
-- referr|created_by|actor|member|account|distinct|anon|install|subscriber|customer|app_user,
-- tip uuid/text/varchar) LEFT JOIN pg_constraint FK
```
| Tablo.kolon | Tip | FK | Satır | Yetim |
|---|---|---|---|---|
| `game_scores.user_id` | uuid | yok | 18 | **17** |
| `trial_claims.user_id` | uuid | yok | 0 | 0 — **şema sapması:** `012:69-72` tabloyu `email TEXT PRIMARY KEY, claimed_at` olarak tanımlar ve `070:27-29` "tabloda user_id kolonu yok" der; canlıda `id uuid, user_id uuid NULL, email text, claimed_at` var. Hangi yoldan eklendiği doğrulanmadı (Dashboard? bkz. 012 `CREATE TABLE IF NOT EXISTS` no-op notu). |
| `api_rate_limits.user_id` | text | yok | 0 | 0 |
| `custom_lists.user_id` | text | yok | 0 | 0 |
| `watchlist.device_id` | text | yok | `user_id` NULL + `device_id` dolu: 0 | 0 |
| `subscriptions.rc_customer_id` | text | yok | ölçülmedi | — |
| `users.auth_id` | text | yok (auth.users'a) | 287 | 0 (287/287 auth'ta var) |

Diğer 29 kolon FK'li: 27'si `public.users(id)`'ye (26'sı `ON DELETE CASCADE`, `users.referred_by`
SET NULL), 2'si `auth.users`'a CASCADE (`user_collection_progress`, `winback_queue`).
`delete-account` başlığındaki "26 FK'nin biri hariç hepsi CASCADE" (`:10-11`) canlı sayıyla
uyuşuyor (27 = 26 CASCADE + 1 SET NULL).

Not: `trial_claims` canlıda `email` kolonu taşıyor ve FK'siz — hesap silindiğinde sağ kalır
(012'deki amaç: aynı e-postayla ikinci trial engeli). Bugün 0 satır. GDPR açısından ayrı
değerlendirme konusu (kapsam dışı, yalnız not).

## Önerilen düzeltme — DUR (onay bekliyor, YAZILMADI)

1. **Veri temizliği önce:** 17 yetim satır silinmeden FK eklenemez (`ADD CONSTRAINT` mevcut
   satırları doğrular, yetimler 23503 ile reddeder).
   - Bu bir `DELETE` (film verisi değil; kural 4 kapsamı dışında), ama `game_scores` ham olay
     tablosu sayılırsa (chosy-conventions §6: ham olay silinmez) karar gerektirir. Satırlar zaten
     silinmiş kullanıcılara ait; hesap silme taahhüdü gereği silinmeleri gerekir.
   - `NOT VALID` FK ile önce yeni yetimler durdurulup temizlik sonra yapılabilir — alternatif.
2. **Migration:** `ALTER TABLE game_scores ADD CONSTRAINT game_scores_user_id_fkey
   FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;` (+ `idx_game_scores_user`
   zaten var, 016:29). Numara: klasördeki en yüksek + 1 (listelenmedi, yazım anında doğrulanmalı).
   migration-guard denetimi gerekir.
3. **Merge v1 kapsamı:** FK CASCADE ile anonim kullanıcının Spotlight skoru merge'de **silinir**
   (bugün yetim kalıyor). Taşınması istenirse 122/123'e `game_scores` taşıma adımı — ayrı karar
   (v1 kapsamı kilitli, `122:10-12`).
4. `delete-account` başlık yorumundaki "26 FK" sayısı (bugün 27 FK = 26 CASCADE + 1 SET NULL) FK eklenince 28 olur — yorum düzeltmesi.

**İstenen onay:** (a) 17 yetim satırın silinmesi, (b) FK migration'ı, (c) merge'de skorların
silinmesi mi taşınması mı.

## Doğrulanamayanlar

- **Temmuz yetimlerinin kaynağı** (260fde57, c6140c44): bu oturumda Temmuz/Ağustos
  loglarına bakılmadı; log saklama süresi de doğrulanmadı.
- **auth ↔ app kimlik eşlemesi**: silinmiş satırlar yüzünden kurulamaz; tablo zaman uyumuna dayanıyor.
- **`subscriptions.rc_customer_id`** yetim sayısı ölçülmedi (RevenueCat kimliği, app user ile
  ilişkisi bu turda incelenmedi).
- Ad deseniyle eşleşmeyen kimlik kolonları (ör. `jsonb` içinde kullanıcı kimliği) taranmadı.
