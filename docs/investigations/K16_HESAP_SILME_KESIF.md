# K-16 — Hesap Silme Cascade Keşfi

**Tarih:** 25 Eylül 2026 · **Mod:** READ ONLY (hiçbir kod/şema değişmedi)
**Kapsam:** Hesap silme akışının bugünkü gerçeği · auth/public silme sırası ·
App Store Guideline 5.1.1(v) + GDPR risk durumu

---

## Yönetici özeti

1. **Hesap silme akışı VAR ve uygulamanın içinde.** Profil → Ayarlar
   bottom-sheet'inin en altında "Delete Account" satırı
   (`app/(tabs)/profile.tsx:696-714`), iki aşamalı onay
   (`app/(tabs)/profile.tsx:1070-1125`), client servisi
   `services/authService.ts:644-728`, sunucu tarafı Edge Function
   `supabase/functions/delete-account/index.ts`. Fonksiyon canlıda **ACTIVE,
   version 23, 24 Nis 2026** (`supabase functions list`).
2. **Önceki turun "ters orphan" bulgusu akışa uymuyor — düzeltilmesi gerekir.**
   Canlı FK envanterine göre `subscriptions` ve `notification_log` bugün
   `public.users(id)` üzerine **ON DELETE CASCADE** ile bağlı. "Ayakta kalır"
   tespiti yalnızca **auth.users'ın doğrudan silinmesi** (Dashboard / Admin API
   tek başına) senaryosunda geçerli; uygulamanın akışı önce `public.users`'ı
   siliyor, o yüzden bu iki tablo akışta temizleniyor.
3. **Gerçek "ters orphan" kapısı akışın içinde başka bir yerde:** Edge
   Function'ın `users` satırını bulamadığı dal, yalnızca auth kaydını silip
   `{"success":true,"note":"auth_only"}` döndürüyor
   (`supabase/functions/delete-account/index.ts:98-107`). Bu dal çalışırsa
   public taraf hiç dokunulmadan kalır ve client bunu **başarı** sayar.
4. **FK'siz kalan tek dolu tablo `game_scores` (12 satır, hepsi zaten orphan).**
   Silme akışında da, cascade'de de yer almıyor. Diğer FK'siz adaylar ya boş
   (`api_rate_limits`, `custom_lists`, `trial_claims`) ya da VIEW
   (`user_stats`, `mood_history`, `user_swipe_history`,
   `detective_daily_scores`, `v_mood_searches_recent`).
5. **App Store 5.1.1(v) açısından özellik mevcut**; asıl risk "silme butonu
   yok" değil, **silmenin sessizce yarım kalabilmesi** (madde 3) ve
   **auth-only hesapların artığı** (canlı: auth.users 281 / public.users 266,
   15 fark).

---

## Akış — bugün gerçekte ne çalışıyor

| Adım | Nerede | Ne yapıyor |
|---|---|---|
| UI girişi | `app/(tabs)/profile.tsx:696-714` | Ayarlar modalında "Delete Account" satırı; **`isAnonymous` gate'i YOK**, her kullanıcıya görünür |
| Onay | `app/(tabs)/profile.tsx:1070-1125` | İki aşamalı `Alert.alert` zinciri |
| Client | `services/authService.ts:644-728` | JWT al → `POST /functions/v1/delete-account` → RC logout, kota cache temizliği, PostHog/Sentry reset, `signOut()` |
| Sunucu | `supabase/functions/delete-account/index.ts:57-83` | Bearer token ile `auth.getUser()` doğrulaması |
| Sunucu 1 | `…/index.ts:90-107` | `users` satırını `auth_id` ile bul; **bulamazsa auth-only sil ve başarı dön** |
| Sunucu 2 | `…/index.ts:111-131` | `subscriptions` + `mood_searches` manuel DELETE (hata yalnızca `console.warn`) |
| Sunucu 3 | `…/index.ts:135-146` | `public.users` DELETE → cascade |
| Sunucu 4 | `…/index.ts:149-158` | `auth.admin.deleteUser(authUid)`; başarısızsa HTTP **207** |

**Sıra doğru:** önce public (cascade), sonra auth. Auth tarafındaki tüm FK'ler
(`user_collection_progress`, `winback_queue` dahil) CASCADE olduğu için adım 4
FK ihlaliyle bloke olmuyor.

**207 işlenişi düzeltilmiş durumda:** `services/authService.ts:668-676` 207'yi
açıkça `partial_failure` sayıyor, Sentry'ye yazıyor, oturumu KAPATMIYOR;
kullanıcıya "tekrar dokun" mesajı gösteriliyor (`locales/en.json:543`).

---

## Bulgular tablosu

| # | Dosya:satır | Bulgu | Büyüklük |
|---|---|---|---|
| B-1 | `supabase/functions/delete-account/index.ts:98-107` | `users` satırı bulunamazsa auth-only silinir, public taraf kalır ve yanıt `success: true`. Ters orphan üretebilen tek in-app yol. | S |
| B-2 | `supabase/functions/delete-account/index.ts:117-131` | `subscriptions` / `mood_searches` DELETE hatası yalnızca `console.warn` — sessiz fallback (chosy-conventions §1'e aykırı). Pratikte zararsız (ikisi de CASCADE), ama hata yutuluyor. | S |
| B-3 | `supabase/functions/delete-account/index.ts:111-131` | Bu iki manuel DELETE bugün **gereksiz**: canlı FK'ler CASCADE. 014 sonrası kalıntı. | S |
| B-4 | Canlı şema (aşağıdaki envanter) | `game_scores.user_id` FK'siz → hesap silmede hiçbir yoldan temizlenmiyor. 12 satır, hepsi zaten orphan. | S |
| B-5 | `supabase/functions/delete-account/index.ts:26` | `esm.sh` supabase-js kanalı — yeni fonksiyonlar için `jsr` kuralı var; bu eski fonksiyon, dokunulursa gündeme gelir. | S |
| B-6 | `services/authService.ts:705-710` | PostHog sunucu tarafı silme yapılmıyor (kod içinde "backlog" olarak yazılı). GDPR silme talebinde analitik kimliği sunucuda kalır. | M |
| B-7 | `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md:73` | K-16 tanımı "auth user → profile → choice events → watch history → DNA → analytics identity". **analytics identity** ayağı B-6 nedeniyle karşılanmamış; şema ayakları karşılanıyor. | — |
| B-8 | Canlı ölçüm | auth.users 281 / public.users 266 → 15 auth-only kayıt. `public_users_without_auth = 0`, yani ters yönde artık yok. Bu 15'in kaynağı `docs/investigations/ORPHAN_AUTH_KOK_NEDEN.md` ile örtüşüyor olabilir; bu turda ayrıştırılmadı. | — |

---

## Ölçülmüş sayılar

Tümü `supabase db query --linked` ile, 25 Eyl 2026, salt okunur.

### `users`'a bağlı FK envanteri (silme kuralı)

```sql
select pn.nspname||'.'||pc.relname parent, cn.nspname||'.'||cc.relname child,
       a.attname, c.confdeltype
from pg_constraint c
join pg_class cc on cc.oid=c.conrelid join pg_namespace cn on cn.oid=cc.relnamespace
join pg_class pc on pc.oid=c.confrelid join pg_namespace pn on pn.oid=pc.relnamespace
join unnest(c.conkey) k(attnum) on true
join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum
where c.contype='f' and pc.relname='users' and pn.nspname in ('public','auth');
```

- `auth.users` ← `public.user_collection_progress.user_id` (**c**),
  `public.winback_queue.user_id` (**c**) + 10 adet `auth.*` iç tablo.
- `public.users` ← 26 bağ; **`users.referred_by` dışında hepsi `c` (CASCADE)**,
  `referred_by` = `n` (SET NULL, 102'nin gerekçesi).
  Bu listede `subscriptions`, `notification_log`, `mood_searches`,
  `choice_events`, `cinema_dna`, `watchlist`, `watch_feedback`,
  `daily_gauntlets`, `lifetime_sales`, `referrals`, `referral_rewards`,
  `paywall_events`, `daily_chest_log` var — hepsi CASCADE.

### FK'siz kullanıcı kolonları

| Nesne | Tür | Satır |
|---|---|---|
| `game_scores` | tablo | **12** (12'si de orphan; `auth.users` uzayında da eşleşmiyor: 0) |
| `api_rate_limits` | tablo | 0 |
| `custom_lists` | tablo | 0 |
| `trial_claims` | tablo | 0 (email PK, `user_id` kolonu FK'siz) |
| `user_stats`, `mood_history`, `user_swipe_history`, `detective_daily_scores`, `v_mood_searches_recent` | **VIEW** | türetilmiş, silinecek veri değil |

### Kimlik uzayı

| Sorgu | Sonuç |
|---|---|
| `auth.users` | 281 |
| `public.users` | 266 |
| `public.users` auth_id NULL | 0 |
| `public.users` auth karşılığı olmayan | 0 |
| `subscriptions` | 3 |
| `notification_log` | 0 |

---

## App Store 5.1.1(v) / GDPR değerlendirmesi

- **Özellik uygulama içinde mevcut** — Profil → Ayarlar → Delete Account,
  ek web adımı gerektirmiyor, tek akışta hem veri hem auth kaydı siliniyor
  (`app/(tabs)/profile.tsx:696`, `services/authService.ts:644`).
  Apple'ın "hesap silme uygulamanın içinde olmalı" şartı **karşılanıyor**.
- **Kalan risk 1 (orta):** B-1 dalı — silme "başarılı" görünüp public profilin
  ayakta kalması. Reviewer bunu göremez, ama GDPR silme talebi açısından eksik
  silme demektir.
- **Kalan risk 2 (orta):** B-6 — PostHog sunucu tarafı kimlik silinmiyor;
  K-16'nın "analytics identity" ayağı açık.
- **Kalan risk 3 (düşük):** B-4 — `game_scores` kalıntısı; oyunlar `app_config`
  ile donduruldu, tablo 12 orphan satır taşıyor.
- **Reviewer'ı doğrudan bloklayacak bir eksik bu turda bulunamadı.**

---

## DUR NOKTASI gerektiren maddeler (CTO kararı)

1. **B-1 davranış kararı:** `users` satırı yokken auth-only silmek "başarı" mı,
   yoksa hata mı sayılmalı? Yanıt sözleşmesi (`note: 'auth_only'`) ve client'ın
   bunu nasıl yorumlayacağı ürün kararıdır.
2. **B-4 kapsam kararı:** `game_scores` için FK eklemek şema değişikliğidir
   (yeni migration). 12 orphan satırın FK eklenmeden önce ne yapılacağı da
   karar gerektirir.
3. **B-6 kapsam kararı:** PostHog sunucu tarafı silme K-16 kapsamında mı, ayrı
   backlog maddesi mi? Kapsam kilidi K-16 satırı "analytics identity" diyor,
   kod yorumu "bu turun kapsamı dışında (backlog)" diyor — iki kaynak çelişiyor.
4. **Hafıza/bible düzeltmesi:** Önceki turdaki "subscriptions ve
   notification_log ayakta kalıyor" tespiti akış bağlamında yanlış; yalnızca
   doğrudan auth silme senaryosunda doğru. Bible'a işlenip işlenmeyeceği CTO
   kararıdır.

---

## Doğrulanamayanlar

- **Deploy edilmiş Edge Function kodunun repo ile aynı olduğu doğrulanamadı.**
  Canlı version 23 / 24 Nis 2026; repodaki dosyanın son commit'i 27 Nis 2026
  (`feat: P9 Payment + P10 UX Polish…`). `supabase functions download` repo
  dosyalarının üzerine yazacağı için bu READ ONLY turda çalıştırılmadı.
- **Akışın uçtan uca cihazda çalıştığı doğrulanmadı** — canlı veride silinmiş
  hesap izi yok, yani akışın production'da kaç kez çalıştığı ölçülemedi.
- **15 auth-only kaydın kaynağı** (bounce mu, yarım kalmış silme mi) bu turda
  ayrıştırılmadı.
