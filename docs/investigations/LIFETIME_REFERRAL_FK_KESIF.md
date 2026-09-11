# LIFETIME_REFERRAL_FK — Keşif Raporu

**Tarih:** 11 Eylül 2026
**Mod:** READ ONLY — hiçbir migration, FK değişikliği veya kod düzeltmesi yapılmadı.
**Tetikleyici:** 109/110 SECURITY DEFINER guard doğrulama turunda türetilen,
doğrulanmamış hipotez.

---

## Yönetici özeti

1. **Hipotez doğrulandı, ama daraltıldı.** `auth.users(id)`'ye referans veren
   7 FK var; `public.users(id)`'ye referans veren 23 FK var. İki kimlik uzayı
   ölçümle **tamamen ayrık**: `public.users.id` değerlerinin **0/260**'ı
   `auth.users`'ta mevcut. Yani bir uzayın id'si diğerinin FK'sını asla geçemez.

2. **Referral akışı koşulsuz kırık.** `apply_invite_code`, `v_referrer_id`'yi
   fonksiyonun *içinde* `SELECT id FROM users` ile üretiyor (`109:988-990`) —
   yani her zaman `public.users.id`. Bunu `referrals.referrer_id`'ye yazıyor
   (`109:1013`), ki o kolon `auth.users(id)`'ye FK veriyor (`026:26`). Çağıran
   hangi uzayı geçerse geçsin bu insert 23503 ile düşer. Ölçüm tutarlı:
   260 kullanıcıya karşılık `referrals` **0 satır**, `users.referred_by`
   **0 dolu**, `referral_rewards` **0 satır**.

3. **Lifetime akışı kırık DEĞİL — yalnızca istemci fallback'i kırık.** Birincil
   satın alma yolları doğru uzayı geçiyor: `revenuecat-webhook:430` →
   `authUserId`, `process-lifetime-purchase:109` → `event.app_user_id` (bu da
   auth id, çünkü `app/auth.tsx:93` RevenueCat'e `supabase.auth.getUser()`
   sonucunu veriyor). Yalnızca `app/lifetime.tsx:190-193` fallback'i
   `getAppUserId()` yani `public.users.id` geçiyor → 23503.

4. **Migration 109 `apply_invite_code`'un istemci yolunda regresyon yarattı.**
   `referralService.ts:134` `session.user.id` (auth id) geçiyor; 109'un guard'ı
   `p_referee_id`'nin `auth_user_id()` (= `public.users.id`) olmasını şart
   koşuyor (`109:981-984`). Bu iki koşul birbirini dışlıyor → istemci artık
   FK'ya varmadan **42501 FORBIDDEN** alıyor. 109 öncesinde bu çağrı guard'a
   takılmıyordu.

5. **`subscriptions` temiz.** `subscriptions.user_id` → `public.users(id)`.
   Sebebi belgeli: **migration 014 tam bu hata sınıfını bir kez teşhis edip
   düzeltmiş** (`014:1-9`), `mood_searches` ve `subscriptions` için. Aynı desen
   014'ten *sonra* yazılan 025/026'da tekrarlandı.

---

## Bulgular tablosu

| # | Dosya:satır | Bulgu | İş |
|---|---|---|---|
| B-1 | `026_referrals.sql:26` | `referrals.referrer_id` → `auth.users(id)`; fonksiyon içinde üretilen `public.users.id` yazılıyor (`109:1013`). Koşulsuz 23503. | M |
| B-2 | `026_referrals.sql:27` | `referrals.referee_id` → `auth.users(id)`. Çağıranlar tutarsız: Edge auth id (`process-referral:63`), istemci auth id (`referralService.ts:134`), ama guard public id şart koşuyor. | M |
| B-3 | `026_referrals.sql:11` | `users.referred_by` → `auth.users(id)`; `109:1016` public id yazıyor. | S |
| B-4 | `026_referrals.sql:67` | `referral_rewards.user_id` → `auth.users(id)`; `activate_referral` `v_referral.referrer_id` (public uzay) yazıyor (`026:248,254,256,267,275`). | M |
| B-5 | `025_lifetime_tier.sql:12` | `lifetime_sales.user_id` → `auth.users(id)`. Edge yolları doğru, istemci fallback'i yanlış uzay geçiyor. | S |
| B-6 | `109:981-984` + `referralService.ts:134` | Guard public id şart koşuyor, çağıran auth id geçiyor → istemci `apply_invite_code` yolu FORBIDDEN. **109 kaynaklı regresyon.** | S |
| B-7 | `109:958-964` | `claim_lifetime_spot` yalnızca `unique_violation` yakalıyor; 23503 maskelenmeden yukarı fırlar. Sessiz fallback yok, hata görünür. | — |
| B-8 | `014_fix_fk_references.sql:1-9` | Aynı hata sınıfı daha önce yaşandı ve belgelendi ("kota hep 0 → ödeme bypass"). Desen 025/026'da tekrarlandı — tekrarlayan kök neden. | — |
| B-9 | `027_webhook_columns.sql:20` | `winback_queue.user_id` → `auth.users(id)`. **Hata değil:** `revenuecat-webhook:166-167` iki uzayı belgeliyor ve `authUserId` yazıyor (`:718`). | — |
| B-10 | `101_user_collection_progress_cascade.sql:15-18` | `user_collection_progress.user_id` → `auth.users(id)`. **Hata değil:** bilinçli ve belgeli karar — tabloya yazan servis yok, RLS `auth.uid()` semantiği bekliyor. | — |

---

## Ölçülmüş sayılar

Tümü `supabase db query --linked` ile, salt okunur SELECT.

### FK kimlik uzayı dağılımı

```sql
SELECT fns.nspname || '.' || ft.relname AS ref_tbl, count(*),
       string_agg(t.relname || '.' || a.attname, ', ' ORDER BY t.relname)
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace ns ON ns.oid = t.relnamespace
JOIN pg_class ft ON ft.oid = c.confrelid
JOIN pg_namespace fns ON fns.oid = ft.relnamespace
JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON TRUE
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
WHERE c.contype = 'f' AND ns.nspname = 'public' AND ft.relname = 'users'
GROUP BY 1;
```

| Referans hedefi | FK sayısı | Kolonlar |
|---|---|---|
| `auth.users` | **7** | `lifetime_sales.user_id`, `referral_rewards.user_id`, `referrals.referee_id`, `referrals.referrer_id`, `user_collection_progress.user_id`, `users.referred_by`, `winback_queue.user_id` |
| `public.users` | **23** | `subscriptions.user_id`, `watchlist.user_id`, `choice_events.user_id`, `mood_searches.user_id`, … |

### Kimlik uzayı ayrıklığı ve satır sayıları

| Ölçüm | Değer |
|---|---|
| `public.users` toplam | **260** |
| `auth.users` toplam | **272** |
| `public.users.auth_id` dolu | **260** |
| `public.users.id` aynı zamanda `auth.users.id` | **0** |
| `lifetime_sales` | **0** |
| `referrals` | **0** |
| `referral_rewards` | **0** |
| `users.referred_by` NOT NULL | **0** |
| `winback_queue` | **0** |
| `user_collection_progress` | **0** |

`auth.users`'a FK veren tabloların **tamamı boş**; `public.users`'a FK veren
tablolarda veri var. Hipotezle tutarlı en güçlü dolaylı kanıt bu.

### Çağıran → geçilen kimlik haritası

| Çağıran | Geçilen değer | Uzay | FK ile uyum |
|---|---|---|---|
| `revenuecat-webhook/index.ts:430` | `authUserId` | auth | ✅ |
| `process-lifetime-purchase/index.ts:109` | `event.app_user_id` | auth (`app/auth.tsx:93`) | ✅ |
| `app/lifetime.tsx:190-193` | `getAppUserId()` (`auth-utils.ts:140-142`) | public | ❌ 23503 |
| `process-referral/index.ts:63` | `user.id` | auth | referee ✅ / referrer ❌ |
| `referralService.ts:134` | `session.user.id` | auth | guard reddeder → 42501 |

---

## DUR NOKTASI gerektiren maddeler

**D-1 — Kimlik uzayı çelişkisi mimari karar gerektiriyor (B-1…B-6).**
`referrals`, `referral_rewards`, `users.referred_by` ve `lifetime_sales` için
guard'ın dayattığı uzay (`public.users.id`) ile FK'nın dayattığı uzay
(`auth.users.id`) birbirini dışlıyor. İki yön var, ikisi de şema/sözleşme
değişikliği: (a) FK'ları `public.users(id)`'ye çevirmek — 014'ün izlediği yol,
ama `lifetime_sales` RLS'i `auth.uid() = user_id` beklediği için o politika da
değişmek zorunda (`025:32-34`); (b) fonksiyonları auth id yazacak şekilde
değiştirmek — bu 109'un guard semantiğine dokunmak demek. **Karar CTO'nun.**

**D-2 — Launch-blocking değerlendirmesi.**
Referral akışı (davet kodu uygulama + ödül verme) canlıda çalışmıyor; ölçüm
260 kullanıcıya karşılık 0 referral satırı. Lifetime satın alma akışının
birincil yolları çalışıyor, yalnızca istemci fallback'i kırık. Bu ikisinin
release önceliği aynı değil; sıralama kararı CTO'nun.

**D-3 — `lifetime_sales` boşluğunun nedeni bu bug DEĞİL.**
Önceki turda "boş tablonun nedeni FK hatası olabilir" diye işaretlenmişti.
Ölçüm bunu **desteklemiyor**: birincil satın alma yolları doğru uzayı geçiyor,
dolayısıyla boşluk en az o kadar iyi "henüz satın alma olmadı" ile açıklanır.
Bu hipotez düşürülmelidir.

---

## Doğrulanamayanlar

- **Sentry 23503 arama (iş kalemi 3) yapılamadı.** Bu oturumda Sentry MCP bağlı
  değil; `ToolSearch` ile arandı, hiçbir Sentry aracı bulunmadı. Hipotezin
  doğrudan çalışma-zamanı kanıtı (gerçek bir FK violation event'i) bu turda
  elde edilemedi. Kanıt constraint tanımı + satır sayısı + çağıran haritası
  üzerinden **dolaylıdır**.
- **Hiçbir INSERT/UPDATE denenmedi** (kapsam kuralı). Dolayısıyla 23503'ün
  fiilen fırladığı ampirik olarak gösterilmedi; şema ve kod okumasından
  türetildi.
- **RevenueCat `app_user_id`'nin canlıdaki fiili değeri** ölçülmedi; kod
  yolundan (`app/auth.tsx:93` → `purchaseService.ts:213`) auth id olduğu
  çıkarıldı. `EXPO_PUBLIC_RC_TEST_MODE` aktifken sabit `test_user_matrix_k49`
  kullanılıyor (`purchaseService.ts:211-212`) — o modda hiçbir uzaya uymaz.

---

## Kapsam dışı bırakılanlar

Hiçbir migration yazılmadı, hiçbir FK değiştirilmedi, hiçbir kod düzeltilmedi.
Önceki turdan devreden iki açık RLS öğesi (`referrals` ve `lifetime_sales`
PUBLIC politikaları) bu turun konusu değildi — `docs/TEKNIK_BORC.md`'de duruyor.
