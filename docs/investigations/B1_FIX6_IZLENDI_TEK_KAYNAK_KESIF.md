# B-1 / Fix 6 — "İzlendi" tek doğruluk kaynağı: KEŞİF

Tarih: 2 Eki 2026 · Mod: salt okunur · Kod/migration yazılmadı.
Kilitli karar (girdi): Watched = kaynağı ne olursa olsun izlenen her film,
kaynak `watchlist.watched_at`. `watch_feedback` satisfaction metriği olarak
kalır (K-27), Profil sayacının kaynağı olmaz.

Çalışma ağacında Fix 1/4'ün commit edilmemiş değişiklikleri var
(`app/(tabs)/profile.tsx`, `services/authService.ts`, `services/sessionReset.ts` …).
Fix 6 `profile.tsx`'e dokunacak — commit ayrımı için bkz. DUR-6.

---

## Yönetici özeti

1. **CHECK `'watchlist'`'i kabul etmiyor** (canlı: `manual | gauntlet_feedback | local_sync`).
   Ancak `'manual'` 072'de tam olarak "kullanıcı elle işaretledi" anlamıyla
   tanımlı ve hiçbir kod yazmıyor → `'manual'` kullanılırsa migration gerekmez. CTO seçimi (DUR-1).
2. **Saved listesi bugün izlenmiş filmleri gösteriyor.** `watchlist-detail`'in
   "Unwatched" filtresi sunucuyu değil yalnızca AsyncStorage'ı okuyor; gauntlet
   `seen` / `submit-watch-feedback` ile `watched_at` dolan satırlar Saved'de
   "izlenmemiş" görünüyor. Grouped görünümde ve Profil "Saved" sayacında filtre hiç yok.
3. **K-29 yolu `watched_at` yazıyor ama atomik değil.** `watch_feedback` INSERT'ten
   sonra `markWatched` çağrılıyor; `markWatched` patlarsa yeniden deneme
   `already_answered` dalına düşüp `markWatched`'ı hiç çağırmıyor → kalıcı fark mümkün.
   (c) SQL'i bu farkı ölçer — çalıştırılmadı.
4. **RLS temiz:** canlıda yalnızca migration'lardaki 4 owner policy var
   (Dashboard kaçağı yok). Client kendi satırını UPDATE edebiliyor, ama RLS
   satır düzeyinde: "unwatch yalnızca `watchlist` kaynaklıyı temizler" kuralı
   sunucuda zorlanmaz, yalnızca client filtresiyle sağlanır (DUR-4).
5. **`chosy_watched_films` sync sonrası silinmiyor ve düz `signOut` onu
   temizlemiyor** — Fix 4 yalnızca hesap silme yolunu kapattı; çıkış → yeni
   kimlik yolunda eski kullanıcının izlediği filmler yeni kimliğe senkronlanır.

---

## a) `watchlist.watched_source` CHECK kısıtı

**Repo:** `supabase/migrations/072_gauntlet_choice_events.sql:54-59`
```sql
ADD COLUMN IF NOT EXISTS watched_source TEXT;
ADD CONSTRAINT watchlist_watched_source_valid
  CHECK (watched_source IN ('manual', 'gauntlet_feedback', 'local_sync'));
```
072:49 — `manual — kullanici elle isaretledi`.

**Canlı (pg_constraint / information_schema, salt okunur):**
| öğe | değer |
|---|---|
| `watchlist_watched_source_valid` | `CHECK (watched_source = ANY (ARRAY['manual','gauntlet_feedback','local_sync']))` |
| `watched_source` default | yok · nullable=YES |
| `watched_at` default | yok · nullable=YES |

→ **`'watchlist'` kabul edilmiyor.** Gönderilirse `23514`.

**Canlı dağılım** (`SELECT coalesce(watched_source,'<NULL>'), watched_at IS NOT NULL, count(*) FROM watchlist GROUP BY 1,2`):
| watched_source | watched_at dolu | satır |
|---|---|---|
| NULL | hayır | 325 |
| gauntlet_feedback | evet | 1 |
| local_sync | evet | 5 |
| manual | evet | 2 |

`'manual'` yazan kod yolu repo'da yok (grep: `watched_source` geçen tüm yazıcılar
`gauntletCore.ts:537,557` ve `watchSync.ts:107,138`). 2 `manual` satırının
kaynağı **doğrulanamadı** (elle SQL / test olabilir).

**DEFAULT notu (R4 / 106 deseni):** 106'nın kuralı "CHECK ile DEFAULT çelişmesin"di.
Burada DEFAULT NULL ve NULL CHECK'ten geçer — tutarlı. `watched_source`'a NULL dışı
bir DEFAULT vermek, `watched_at` NULL olan her Saved satırını yanlış etiketler;
bu yüzden önizlemede DEFAULT **açıkça NULL bırakılıyor**.

**Migration önizlemesi — YALNIZCA `'watchlist'` seçilirse.** Dosya oluşturulmadı
(`supabase/migrations/`'a konursa `db push` ile kazara gidebilir). En yüksek
mevcut: `120_spotlight_puzzles_cron.sql` → yeni numara **121**.
```sql
-- 121_watchlist_watched_source_watchlist.sql
-- watched_source sözlüğüne 'watchlist' eklenir (B-1 / Fix 6: toggleWatched
-- sunucuya yazıyor). Mevcut 3 değer korunur; daraltma yok → mevcut satırlar
-- doğrulamadan geçer (ölçüm: 333 satır, hepsi listede ya da NULL).
--
-- DEFAULT bilinçli olarak YOK (NULL): watched_at NULL olan Saved satırı
-- kaynak taşımamalı. NULL CHECK'ten geçer → CHECK/DEFAULT çelişkisi yok (106 deseni).

ALTER TABLE watchlist
  DROP CONSTRAINT IF EXISTS watchlist_watched_source_valid;

ALTER TABLE watchlist
  ADD CONSTRAINT watchlist_watched_source_valid
  CHECK (watched_source IN ('manual', 'gauntlet_feedback', 'local_sync', 'watchlist'));

ALTER TABLE watchlist ALTER COLUMN watched_source DROP DEFAULT;  -- no-op, niyet beyanı

COMMENT ON COLUMN watchlist.watched_source IS
  'watched_at sinyalinin kaynagi. NULL = 072 oncesi ya da izlenmemis. '
  'watchlist = film detay/izleme listesinden elle (Fix 6). manual = 072 sozlugu, kod yazmiyor.';

-- DOWN (elle):
-- ALTER TABLE watchlist DROP CONSTRAINT IF EXISTS watchlist_watched_source_valid;
-- ALTER TABLE watchlist ADD CONSTRAINT watchlist_watched_source_valid
--   CHECK (watched_source IN ('manual','gauntlet_feedback','local_sync'));
-- (önce: UPDATE ... SET watched_source='manual' WHERE watched_source='watchlist')
```

---

## b) K-29: `watch_feedback` yazan yol `watched_at`'i de yazıyor mu?

**Evet, ama atomik değil.**

| adım | dosya:satır |
|---|---|
| `loved/ok/abandoned` kümesi | `supabase/functions/submit-watch-feedback/index.ts:61-65` |
| `watch_feedback` INSERT | `submit-watch-feedback/index.ts:194-201` |
| ardından `markWatched` | `submit-watch-feedback/index.ts:234-236` |
| `markWatched`: satır yoksa INSERT `watched_source:'gauntlet_feedback'` | `supabase/functions/_shared/gauntletCore.ts:532-542` |
| satır var, `watched_at` NULL → UPDATE | `gauntletCore.ts:555-562` |
| satır var, `watched_at` dolu → dokunma | `gauntletCore.ts:546-553` |
| `seen` dalı da aynı fonksiyonu kullanıyor | `gauntletCore.ts:510-512` |

**Fark üreten yol:** INSERT başarılı → `markWatched` fırlatır → 503
(`index.ts:247-264`). İstemci tekrar dener → `existingRes.data` dolu →
`already_answered` döner (`index.ts:178-190`), `markWatched` **çağrılmaz**.
`watch_feedback` satırı var, `watched_at` NULL kalır.

**Deploy doğrulaması:** canlı `submit-watch-feedback` (v11) indirildi ve
karşılaştırıldı: `index.ts`, `gameUtils.ts`, `sentry.ts` repo ile **aynı**.
`gauntletCore.ts` farklı ama fark yalnızca `toW500PosterUrl` (poster
normalizasyonu); deploy edilmiş `markWatched` repo ile aynı
(`gauntlet_feedback` iki satırda). Paketteki `types/gauntlet.ts` yerelden
farklı — Fix 6 kapsamı dışı, not edildi.

Ölü yol: `services/feedback.ts:86-91` `watched_at`'i `watched_source`'suz
yazıyor, ama `saveFeedback`'in hiçbir çağıranı yok (grep).

---

## c) Fark ölçümü — SQL (ÇALIŞTIRILMADI)

`watch_feedback.user_id` zaten `public.users.id` (069:105, FK). Kimlik
çözümlemesi: `public.users` JOIN'i — silinmiş/orphan kullanıcılar ve yalnızca
`device_id` taşıyan satırlar ayrı sayılır.

```sql
-- supabase db query --linked  (salt okunur)
WITH fb AS (
  SELECT DISTINCT wf.user_id, wf.film_id
  FROM public.watch_feedback wf
  JOIN public.users u ON u.id = wf.user_id          -- auth_id → users.id çözülmüş kimlik
  WHERE wf.response IN ('loved','ok','abandoned')
)
SELECT
  count(*) FILTER (WHERE w.id IS NULL)                           AS no_watchlist_row,
  count(*) FILTER (WHERE w.id IS NOT NULL AND w.watched_at IS NULL) AS row_but_null,
  count(*) FILTER (WHERE w.id IS NULL OR w.watched_at IS NULL)   AS total_gap,
  count(DISTINCT fb.user_id) FILTER (WHERE w.id IS NULL OR w.watched_at IS NULL) AS affected_users,
  count(*)                                                       AS fb_pairs_total
FROM fb
LEFT JOIN public.watchlist w
  ON w.user_id = fb.user_id AND w.film_id = fb.film_id;

-- Eşlenemeyen satırlar (backfill'e giremez):
SELECT count(*) AS device_only_or_orphan
FROM public.watch_feedback wf
LEFT JOIN public.users u ON u.id = wf.user_id
WHERE wf.response IN ('loved','ok','abandoned') AND u.id IS NULL;
```
`count(*)` sunucuda kesin sayımdır (PostgREST `count=exact` eşdeğeri; anti-join
PostgREST'te ifade edilemiyor).

**Backfill önizlemesi** — yalnızca `total_gap > 0` ise. Dosya oluşturulmadı.
Numara: 121 `'manual'` seçilirse, `'watchlist'` seçilirse **122**.
```sql
-- 12X_watchlist_backfill_from_watch_feedback.sql
-- Profil sayacı watch_feedback → watchlist.watched_at geçişinde düşmesin diye
-- loved/ok/abandoned olup watched_at'i NULL kalan çiftler doldurulur.
-- Mevcut dolu watched_at EZİLMEZ (markWatched kuralı). Kaynak: gauntlet_feedback
-- (bu sinyali üreten yol o). Tarih: ilk cevap anı.
-- ⚠️ ÖNKOŞUL: Saved sorgusu watched_at IS NULL filtresiyle deploy edilmiş olmalı;
-- aksi halde eklenen satırlar kullanıcının Saved listesinde belirir.

INSERT INTO public.watchlist (user_id, film_id, watched_at, watched_source)
SELECT wf.user_id, wf.film_id,
       min(coalesce(wf.answered_at, wf.created_at)),
       'gauntlet_feedback'
FROM public.watch_feedback wf
JOIN public.users u ON u.id = wf.user_id
WHERE wf.response IN ('loved','ok','abandoned')
GROUP BY wf.user_id, wf.film_id
ON CONFLICT (user_id, film_id) DO UPDATE
  SET watched_at     = EXCLUDED.watched_at,
      watched_source = EXCLUDED.watched_source
  WHERE public.watchlist.watched_at IS NULL;

-- DOWN: yok — hangi satırın bu migration'la oluştuğu ayırt edilemez.
-- Gerekirse öncesinde: CREATE TABLE ... AS SELECT ile fark listesi anlık görüntüsü.
```
Not: `ON CONFLICT (user_id, film_id)` hedefi canlıda iki ayrı UNIQUE kısıtla
karşılanıyor (`watchlist_user_film_unique` ve `watchlist_user_id_film_id_key`,
ikisi de `UNIQUE (user_id, film_id)`) — çakışma çıkarımı çalışır; mükerrer
kısıt Fix 6 kapsamı dışında.

---

## d) Saved/Watchlist sorgusu

| bulgu | dosya:satır |
|---|---|
| `getWatchlist` `watched_at`'i seçmiyor, filtrelemiyor | `services/watchlist.ts:232-238` |
| Liste "izlendi" bilgisini AsyncStorage'dan alıyor | `app/watchlist-detail.tsx:127-132` |
| Varsayılan filtre `unwatched` = `!watchedIds.has(...)` (yalnız yerel) | `watchlist-detail.tsx:103`, `:218-222` |
| İzlendi çipleri yalnızca list modunda | `watchlist-detail.tsx:507-508` |
| Grouped mod: RPC'de `watched` filtresi yok | `watchlist-detail.tsx:609`, `supabase/migrations/100_get_watchlist_grouped_authz.sql:92` |
| Profil "Saved" sayacı + poster şeridi tüm satırlar | `app/(tabs)/profile.tsx:948-954` |
| Uzun-basma menüsünde "Watched ✓" düğmesinin `onPress`'i yok (ölü) | `watchlist-detail.tsx:661-668` |

**Sonuç:** Gauntlet `seen` (`gauntletCore.ts:532-538`) ve
`submit-watch-feedback` yeni bir watchlist satırı açıyor; bu satır cihazdaki
AsyncStorage'da olmadığı için **Saved'de "Unwatched" altında görünüyor**,
grouped modda ve Profil Saved sayacında da görünüyor. Aynı yerel kaynak
`app/roulette.tsx:188-193,248-250` (rulet adayları) ve
`hooks/useFeedManager.ts:304-308` tarafından da okunuyor.

Fix 6'nın 1. maddesi (toggle sunucuya yazar) watchlist'te olmayan bir film
için **yeni satır INSERT etmek** zorunda — d) düzeltilmeden bu da filmi
Saved'e sokar. Sıra bağımlılığı: d) → 1.

---

## e) watchlist RLS

**Canlı `pg_policies` (salt okunur):** tam olarak 4 policy, hepsi PERMISSIVE, roles=public:
| policy | cmd | ifade | kaynak |
|---|---|---|---|
| `watchlist: owner read` | SELECT | `user_id = (SELECT users.id FROM users WHERE users.auth_id = auth.uid()::text LIMIT 1)` | 008 |
| `watchlist: owner insert` | INSERT | CHECK aynı | 008 |
| `watchlist: owner delete` | DELETE | USING aynı | 008 |
| `watchlist: owner update` | UPDATE | USING + CHECK aynı | `083_watchlist_owner_update_policy.sql:10-17` |

- RLS açık (`relrowsecurity=true`, force=false).
- 099'un sildiği 3 Dashboard policy'si (`*_all`) **yok**; migration dışı policy **yok**.
- Client doğrudan UPDATE **yapabilir**, kimlik `auth.uid()::text → users.auth_id → users.id`
  (`app_user_id()` ile aynı çözümleme, 069:41-48).
- Trigger yok.
- RLS satır düzeyi: client kendi satırında `watched_source='gauntlet_feedback'`
  satırını da güncelleyebilir/silebilir. "Unwatch gauntlet kaynaklıyı silmez"
  yalnızca client sorgusundaki `.eq('watched_source', ...)` ile sağlanır (DUR-4).
- Kapsam dışı not: `anon` ve `authenticated` tabloda TRUNCATE dahil tüm
  GRANT'lara sahip (099'un "bilinçli yapmadıkları" maddesiyle tutarlı).

---

## f) Veri akışı

**toggleWatched** — `services/watchlist.ts:35-55`: yalnızca AsyncStorage
`chosy_watched_films` (`:21`) içinde Set'i tersine çevirir. Sunucuya hiçbir
şey yazmaz. Tek çağıran: `app/film/[id].tsx:609` (hata → `Alert`, `:610-616`).
Okuma: `getWatchedFilmIds` `watchlist.ts:60-70` — hata durumunda boş Set
döndürüyor (`:68`, logger.error ile).

**syncWatchedFilms** — `services/watchSync.ts:38-163`:
- Tetik: `app/_layout.tsx:470-477`, yalnızca `INITIAL_SESSION`, uygulama
  süreci başına bir kez (`hasSyncedWatchedFilms`, `:430`), bootstrap sonrası.
- Kimlik: `readAppUserId()` (`watchSync.ts:46`); yoksa Sentry warning + çık.
- `watched_at` NULL satırları `local_sync` ile UPDATE (`:104-111`), satırı
  olmayanları `local_sync` ile upsert-INSERT (`:131-143`).
- **Başarıdan sonra anahtar silinmiyor** → her soğuk açılışta yeniden
  çalışır. Sync'ten sonra yerelde "unwatch" edilen film sunucuda izlenmiş
  kalır (yerel/sunucu ıraksaması); bir sonraki sync onu yeniden yazmaz ama silmez de.
- Sync kimliğe bağlı değil: anahtar hangi kimlik zamanında yazıldıysa
  yazılsın, açılıştaki kimliğe yazılır.

**watchlist-detail.tsx** — d) tablosu.

**Fix 4 sonrası `chosy_watched_films` yaşam döngüsü:**
| olay | anahtar |
|---|---|
| film detayında toggle | yazılır (`watchlist.ts:45`) |
| soğuk açılış | okunur, sunucuya kopyalanır, **kalır** |
| hesap silme | `resetToFreshSession` → `sweepUserStorage` allowlist dışı her anahtarı siler (`services/sessionReset.ts:94-105`, allowlist `:38`) — `signOut`'tan önce (`:149-157`) |
| Profil → Çıkış | `profile.tsx:1176-1178` → `authService.ts:642-651` yalnızca `supabase.auth.signOut()`; **anahtar silinmez** |
| Apple bağlama (Fix 1) | `linkIdentity` auth.uid'i korur (`authService.ts:241-246`) → aynı kimlik, sızıntı yok |

→ Temiz kurulumda sızıntı yok (anahtar yok). Hesap silme yolu kapalı.
**Çıkış → yeni kimlik yolu açık:** sonraki `INITIAL_SESSION` sync'i eski
kullanıcının listesini yeni kimliğin watchlist'ine yazar.

**Offline kuyruk modeli** — `services/offlineQueue.ts:34-42`: `QueuedOperation.type`
kapalı birleşim (`'save_archetype' | 'save_calibration_vector'`), işleyici
`:187-223`; kuyruk yalnızca `TOKEN_REFRESHED`'ta işleniyor (`_layout.tsx:479-489`).
Watched yazması için bir tip yok (DUR-3).

---

## g) Profil "Watched" bölümü

- **Yalnızca sayaç**, liste yok: `app/(tabs)/profile.tsx:1600-1611`.
  Sayı 0 ise son şampiyon kartı (`:1612-1631`) ya da boş davet (`:1632-1643`).
- Sorgu: `watch_feedback` · `count:'exact', head:true` · `user_id = userId` ·
  `response IN (loved, ok, abandoned)` — `profile.tsx:925-946`. Hata → `null`
  → bölüm çizilmez + Sentry.
- Dosya başlık yorumu: `profile.tsx:12` "Watched (watch_feedback sayisi)".
- Alt başlık **yok** — `SectionHeading title=` tek prop (`:1602`).

| anahtar | en.json | tr.json |
|---|---|---|
| `profile.watchedSection` | 554 "Watched" | 554 "İzlediklerin" |
| `profile.watchedCount` | 555 "Films watched: %{count}" | 555 "İzlenen film: %{count}" |
| `profile.watchedEmpty` | 556 "No films logged yet. I'll ask about your pick the day after." | 556 |
| `profile.lastPickLabel` / `lastPickHint` | 557-558 | 557-558 |
| `watchlist.filterUnwatched` / `filterWatched` | 228-229 | 228-229 |
| `watchlist.watched` | 202 | 202 |
| `errors.watchedToggle` | 414 | 414 |

Satır sayısı: en.json 1582 · tr.json 1582.
Yeni alt başlık için mevcut anahtar yok → yeni anahtar gerekir
(ör. `profile.watchedSubtitle`). `watchedEmpty` kopyası yalnız "ertesi gün
soracağım" akışını anlatıyor; kaynak genişleyince eksik kalıyor (copy kararı).

---

## Bulgular tablosu

| # | dosya:satır | açıklama | iş |
|---|---|---|---|
| 1 | `072_…sql:58-59` · canlı CHECK | `'watchlist'` kabul edilmiyor; `'manual'` aynı anlamda mevcut | S |
| 2 | `submit-watch-feedback/index.ts:178-190, 234-236` | INSERT→markWatched atomik değil; retry `markWatched`'ı atlıyor | M |
| 3 | `services/watchlist.ts:232-238` · `watchlist-detail.tsx:127-132, 218-222` | Saved "izlenmemiş" filtresi yalnızca yerel | M |
| 4 | `100_…sql:92` · `watchlist-detail.tsx:609` | Grouped modda izlendi filtresi yok (RPC gövdesi) | M |
| 5 | `profile.tsx:948-954` | Saved sayacı izlenmişleri de sayıyor | S |
| 6 | `profile.tsx:925-946` | Watched sayacı `watch_feedback`'ten | S |
| 7 | `services/watchlist.ts:35-70` | toggle/okuma yalnızca AsyncStorage | M |
| 8 | `services/watchSync.ts:38-163` | anahtar sync sonrası silinmiyor; kimliğe bağlı değil | S |
| 9 | `authService.ts:642-651` · `profile.tsx:1176-1178` | çıkış `chosy_watched_films`'i temizlemiyor | S |
| 10 | `watchlist-detail.tsx:661-668` | "Watched ✓" menü düğmesi ölü (onPress yok) | S |
| 11 | `roulette.tsx:188-193` · `useFeedManager.ts:304-308` | yerel izlendi kümesinin diğer tüketicileri | S |
| 12 | `services/feedback.ts:86-91` | ölü kod, `watched_source`'suz yazıyor | — |
| 13 | `offlineQueue.ts:34-42` | watched yazması için kuyruk tipi yok | M |

---

## DUR NOKTASI gerektiren maddeler

- **DUR-1 — kaynak etiketi.** `'watchlist'` (migration 121, CHECK genişletme)
  mı, yoksa 072 sözlüğündeki `'manual'` (migration yok) mı? Canlıda 2 `manual`
  satırı var, kaynağı bilinmiyor; `'manual'` seçilirse bunlar Fix 6
  kaynaklılarla aynı kovaya düşer ve "unwatch" onları da temizleyebilir.
- **DUR-2 — backfill.** (c) SQL'inin sonucu > 0 ise backfill migration'ı.
  Ön koşulu d) düzeltmesinin deploy'u. Down yok.
- **DUR-3 — offline kuyruk.** `QueuedOperation.type`'a yeni bir işlem tipi
  (ör. `set_watched`) eklemek mevcut sözleşmenin genişletilmesi. Alternatif:
  AsyncStorage'ı kuyruk gibi kullanan mevcut `syncWatchedFilms` (local_sync
  etiketiyle). Hangisi "mevcut offline kuyruk modeli"?
- **DUR-4 — unwatch semantiği.** (i) Toggle ile oluşan satır (Saved'de değildi)
  unwatch'ta silinsin mi, yoksa `watched_at` NULL'lanıp Saved'e mi düşsün? Hangi
  satırın toggle ile oluştuğu bugün veriden ayırt edilemiyor. (ii)
  `local_sync`/`manual`/NULL kaynaklı izlenmiş satır unwatch edilebilir mi?
  Görev metni yalnızca `watchlist` kaynağını serbest bırakıyor → bu üçü UI'da
  kilitli görünür. (iii) Koruma yalnızca client filtresi; sunucu zorlaması
  (trigger/policy) yeni pattern.
- **DUR-5 — grouped RPC.** `get_watchlist_grouped` gövdesine
  `watched_at IS NULL` eklemek mevcut RPC'nin sözleşme değişikliği
  (kapsam: "yeni RPC yok" — mevcut RPC değişikliği ayrıca onay ister).
  Alternatif: client'ta `getWatchlist` sonucuyla kesişim.
- **DUR-6 — commit ayrımı.** `profile.tsx` şu an Fix 4'ün commit edilmemiş
  hunk'larını taşıyor. Fix 6 aynı dosyaya dokunursa tek commit iki işi karıştırır;
  önce Fix 4'ün commit edilmesi ya da hunk ayrımı gerekir (stash `--keep-index`
  hunk-split riski hafızada kayıtlı).
- **DUR-7 — b) atomiklik.** `submit-watch-feedback`'in `already_answered`
  dalında `markWatched`'ı (idempotent) yeniden çağırmak Edge Function
  değişikliği; görev kapsamında sayılmadı.
- **Kapsam notu — çıkış sızıntısı (#9).** Görevin "Fix 4 sonrası temiz kurulumda
  sızıntı yok" kanıtı geçer, ama çıkış yolu açık. Fix 6 madde 3 ("kimliğe bağlı,
  başarıdan sonra anahtar kaldırılır") bunu büyük ölçüde kapatır; çıkışta
  temizlik ayrıca Fix 4 dosyasında mantık değişikliği olur (kapsam dışı).

## Doğrulanamayanlar

- (c) fark sayısı — talimat gereği SQL çalıştırılmadı.
- 2 `watched_source='manual'` satırını yazan yol — repo'da yazıcı yok.
- `tsc` baseline (14 / 32) bu turda çalıştırılmadı (kod değişmedi); uygulama
  turunda ilk iş.
- Deploy edilmiş `types/gauntlet.ts`'in yerel kopyadan farkının içeriği
  incelenmedi (kapsam dışı).
