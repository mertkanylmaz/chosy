# ADS-0 — Ölçüm Hazırlığı Keşfi (SALT OKUNUR)

Tarih: 20 Eki 2026 · Kapsam: Apple Ads (ABD, 7 gün, 100 USD) öncesi yeni ABD kullanıcısı deneyimi ve ölçülebilirlik.
Hiçbir kod/migration/deploy/yazma yapılmadı. SQL: yalnız SELECT (`supabase db query --linked`, proje `xpcwihldlnlmyopjubdc` = "chosy ai").

## 1. Denetlenen commit

- Dal: `chore/rename-chosy-2.1.1` · HEAD `6b4b0fed41af69c3d1bf912ee86d31a6e513de92`.
- **`production` adlı git dalı YOKTUR** (`git rev-parse production` → bilinmeyen revizyon; yerel ve uzak dallarda yok). `production` yalnız EAS branch/channel adıdır.
- Canlıdaki kodun karşılığı: EAS `production` branch'inin son grubu `edd2efbb…` "release/2.1.0-rc5 (submit alignment)" (runtime 2.1.0, ios). `release/2.1.0-rc5` = `26a0591`. HEAD ile rc5 farkı yalnız: marka metni (`app.config.ts`, `app.json`, locales, LoadingScreen, ShareCard, `send-notifications` başlığı) + `132_social_daily_lineup.sql`. Bu denetimin tüm dosya:satır atıfları rc5'te de aynıdır (diff bu dosyalara dokunmuyor). `app.json` sürümü 2.1.0 / build 905 (build 907 uzaktan sürümleme; `eas.json` `appVersionSource: remote`).

## 2. Yönetici özeti

1. **Gün sınırı artık UTC değil, kullanıcı-yerel 18:00** ve sunucu otoritesi (`_shared/cycleDate.ts`, 8 Eki 2026, rc5'te mevcut). Canlı veri: 10 Eki'den sonraki 21/21 UTC-dışı satırda `date` yerel-cycle kuralıyla eşleşiyor; yalnız 10/21'i UTC tarihiyle eşleşiyor. M2 Faz 2b `generate-gauntlet` / `get-archive-status` için fiilen uygulanmış; `update_streak` için uygulanmamış (ama gauntlet akışında çağrılmıyor).
2. **18:00 öncesi kuran yeni kullanıcı beklemez**: o anki "etkin cycle"ın (dün-yerel anahtar) dörtlüsünü hemen oynar. Bekleme durumu kodda yok.
3. **PostHog'da reklam/organik ayrımı YOK**, anonim kullanıcı için `identify` çağrılmıyor, "ilk açılış" ve "deneme başladı" olayı yok, event'lerde timezone yok → funnel (özellikle D1 yerel-gün) bugünkü kodla güvenilir kurulamaz.
4. **Apple Ads atıfı için SDK hazır** (`react-native-purchases` 10.0.1, `enableAdServicesAttributionTokenCollection` JS+native mevcut) ama **hiçbir yerde çağrılmıyor**. Çağrı JS-only/OTA ile eklenebilir; ancak `fallbackToCacheTimeout: 0` yüzünden yeni kurulumun ilk açılışı gömülü paketi çalıştırır, OTA 2. açılıştan itibaren geçerli olur.
5. **Webhook deneme (trial) durumunu hiç tanımıyor**: `period_type` okunmuyor, `status` hep `'active'` yazılıyor, `trial_used` yazılmıyor. Yetki taşıyıcısı `users.subscription_tier`; `subscriptions.expires_at` / `trial_used` hiçbir yerde yetki için okunmuyor → PRODUCTION satırındaki `expires_at=NULL` yetkiyi etkilemiyor, ama iptal edilmiş deneme kullanıcısının erişimi tamamen `EXPIRATION` olayının ulaşmasına bağlı.

## 3. A — Saat dilimi ve gün sınırı

### 3.1 "Bugün" hesaplayan her yer

| Ne | dosya:satır | Saat kaynağı |
|---|---|---|
| Cycle tarihi (gauntlet `date` anahtarı) | `supabase/functions/_shared/cycleDate.ts:131-134`; kullanım `generate-gauntlet/index.ts:907` | **İstek gövdesindeki `timezone`** (cihaz IANA), sunucu `new Date()` (`index.ts:899`). `users.timezone` OKUNMUYOR. |
| 18:00 sınırı sabiti | `cycleDate.ts:15` (`CYCLE_HOUR=18`); istemci aynası `unlockClock.ts:19`; sunucu aynası `previousCycle.ts:34` | yerel duvar saati (Intl) |
| `next_cycle_at` | `cycleDate.ts:156-160`; `generate-gauntlet/index.ts:900` | istek tz |
| TZ zorunluluğu | `generate-gauntlet/index.ts:872-891` (`TZ_REQUIRED` 400 + Sentry warning) | — (sessiz fallback yok) |
| `users.timezone` yazımı (write-through, Faz 2a) | `generate-gauntlet/index.ts:184-248, 895`; istemci `gauntletService.ts:173-182, 294` | cihaz |
| Editoryal gün | `generate-gauntlet/index.ts:1024` `editorialDayNumber(date, launch_date)`; `launch_date=2026-09-18`, takvim 100 gün (→ 26 Ara 2026) | cycle tarihi (yerel anahtar) |
| İdempotency (aynı kullanıcı+gün) | `index.ts:967-975` (`user_id,scope,date`) | cycle tarihi |
| `submit-choice` | gün hesaplamaz; satırın `gauntlet.date`'ini kullanır (`submit-choice/index.ts:732, 869`); tz okumaz | satır anahtarı |
| `get-archive-status` | `index.ts:346-379` `cycleDate(tz, now)`; tz: gövde → `users.timezone` → 400 | istek tz / `users.timezone` |
| Önceki döngü (E-21) | `previousCycle.ts:62-69` | istek tz. **İstemci hiç `cycle:'previous'` göndermiyor** (app/components/services/hooks'ta eşleşme yok) → ölü sunucu yolu |
| İstemci "kapı geçti mi" | `GauntletShell/cycleRules.ts:33-38` `shouldRefetch(now, next_cycle_at)`; istemci yerel saatten cycle tarihi HESAPLAMAZ (`cycleRules.ts:7-8`) | sunucunun `next_cycle_at`'i vs cihaz saati |
| 18:00 bildirimi | `pushNotifications.ts:417-429` DAILY trigger `hour: UNLOCK_HOUR(18)` | **cihaz yerel**, yalnız bildirim izni verilmişse (`:389-390`); izin istemi ilk şampiyondan sonra (`_layout.tsx:676-680`) |
| Sunucu push (D-02 18:00 kullanıcı-TZ) | `schedule-notifications/index.ts:1-40` (`users.timezone`) | **`cron.job`'da aktif iş YOK** (aşağıda sorgu) → fiilen ölü |
| `update_streak` | `migrations/109_…sql:711-718` `CURRENT_DATE` | **sunucu UTC**, `users.timezone` yok. Çağıran yalnız `services/gamification.ts:81` ← `hooks/useFeedManager.ts:631` (eski feed/discover). Gauntlet akışında streak yok; profile'da StreakCard bağlı değil (`profile.tsx:89`) |
| `ArchiveDay.date` yorumu | `gauntletService.ts:646` "UTC gün anahtarı" | **bayat yorum** (kod cycle tarihi kullanıyor) |

### 3.2 M2 Faz 2b kararı

**Kısmen uygulanmış, `generate-gauntlet` + `get-archive-status` + Spotlight anahtarı (`78cb757`) için TAM; `update_streak` için YOK.**
Kanıt: `cycleDate.ts` (commit `5fc6a67`, 8 Eki), `generate-gauntlet/index.ts:866-907`, `get-archive-status/index.ts:31-35, 379`, canlı satır eşleşmesi (3.4). Dokümanlar bayat: `docs/05_SPRINTS/ARCHIVE/M2_ZAMAN_MIMARISI.md:35,81` hâlâ "Faz 2b BEKLİYOR/Açık" diyor.

### 3.3 Zaman çizelgesi (yeni kullanıcı) — `cycleDate`/`nextCycleAt` modülü çalıştırılarak üretildi

Referans gün 21 Eki 2026 (DST dışı). Hesap: sunucu modülünün kopyası Node ile çalıştırıldı (scratchpad, repo'ya yazılmadı). "Home" sütunu `cycleRules.ts:1-20` ve `GauntletShell/index.tsx` okumasından.

| Kullanıcı tz | Kurulum (yerel) | Home ne gösterir | Editoryal gün / anahtar | Sonraki dörtlü açılır (yerel) | Streak gün sınırı |
|---|---|---|---|---|---|
| America/Los_Angeles | 10:00 | Hemen oynanabilir gauntlet (bekleme yok) | 33 / 2026-10-20 | 21 Eki 18:00 | Gauntlet'te streak yok. Eski RPC: UTC gece yarısı = LA 17:00 (PDT) |
| America/Los_Angeles | 17:30 | Hemen oynanabilir (dünün anahtarı) | 33 / 2026-10-20 | 21 Eki 18:00 (30 dk sonra) | aynı |
| America/Los_Angeles | 21:00 | Hemen oynanabilir (bugünün anahtarı) | 34 / 2026-10-21 | 22 Eki 18:00 | aynı |
| America/New_York | 10:00 | Hemen oynanabilir | 33 / 2026-10-20 | 21 Eki 18:00 | Eski RPC: NY 20:00 (EDT) |
| America/New_York | 21:00 | Hemen oynanabilir | 34 / 2026-10-21 | 22 Eki 18:00 | aynı |
| Europe/Istanbul (kontrol) | 21:00 | Hemen oynanabilir | 34 / 2026-10-21 | 22 Eki 18:00 | Eski RPC: İstanbul 03:00 |

Ek hesaplar: LA 17:59 → anahtar 10-20, 18:00 → 10-21. DST: NY/LA 31 Eki 21:00 → anahtar 10-31, 1 Kas 10:00 → anahtar 10-31, sonraki 1 Kas 18:00 (`tests/gauntlet/cycleDate.test.ts:223-226` aynı DST'yi test ediyor). Aynı anda (22 Eki 01:00Z) LA/NY/İstanbul/Singapur → hepsi anahtar 10-21.

**Soru:** 18:00 öncesi kuran yeni kullanıcı hemen oynar mı? **Evet.** Kod: `cycleDate` yerel<18 ise dünün yerel tarihini döner (`cycleDate.ts:131-134`); `generate-gauntlet` o anahtar için satır üretir (`index.ts:1024-1050`). Kodda bekleme ekranı yok (`cycleRules.ts:5-6` "bekleme durumu yoktur"; `UnlockCountdown` yalnız champion ekranındaki sayaç satırında, `CycleRow/index.tsx:22,84`). Canlı kanıt: LA kullanıcısı `0847fade` 9 Eki 14:03 yerelde üretti → anahtar 10-08, hemen oynayabildi.

### 3.4 Uyuşmazlık analizi (A5)

- İstemci "18:00 sonrası" kararını kendi vermiyor; sunucunun `next_cycle_at`'ine bakıyor (`cycleRules.ts:33-38`). Aynı tz her iki tarafa da cihazdan geliyor → istemci/sunucu aynı takvimde. Cihaz saati yanlışsa yalnız yenileme zamanı kayar, anahtar değil.
- Ön planda içerik kendiliğinden değişmez (F2.1, `cycleRules.ts:10-19`); geçiş soğuk açılışta ve AppState 'active'te.
- **Kalan kenar durum (UNVERIFIED, kod okumasından):** tz her çağrıda cihazdan geldiği için kullanıcı gün içinde tz değiştirirse (uçuş) yerel anahtar geri/ileri atlayabilir → aynı dörtlüyü iki kez görme veya bir günü atlama mümkün. İdempotency satırı `(user, date)` anahtarlı; yeni tz'de farklı `date` yeni satır üretir. 7 günlük ABD testinde düşük olasılık.
- Eski istemci `timezone` göndermezse 400 `TZ_REQUIRED` (sessiz değil, Sentry warning `index.ts:877-885`); 907/rc5 istemcisi gönderiyor (`gauntletService.ts:294`).

### 3.5 Canlı SQL (A6) — verbatim

Not: aşağıdaki sorguları `select coalesce(string_agg(row_to_json(t)::text, E'\n'),'(0 satır)') from (<SORGU>) t` ile sardım; yalnız iç sorgular verilir.

```sql
select timezone, count(*) from public.users group by 1 order by 2 desc
```
Çıktı (ilk 9 satır; çıktı CLI'da kesildi): UTC 281 · Europe/Istanbul 19 · America/New_York 5 · Asia/Seoul 2 · America/Los_Angeles 2 · Asia/Almaty 1 · Asia/Makassar 1 · Asia/Bishkek 1 · Asia/Singapore 1 … (kalan satırlar görülmedi → UNVERIFIED tam dağılım). 'UTC' kolon DEFAULT'u ile gerçek UTC ayırt edilemez.

```sql
select left(d.user_id::text,8) uid, u.timezone tz, d.date, d.cycle,
  d.generated_at at time zone 'UTC' gen_utc,
  to_char(d.generated_at at time zone u.timezone,'YYYY-MM-DD HH24:MI') gen_local,
  (d.generated_at at time zone 'UTC')::date - d.date as utc_date_minus_key
from public.daily_gauntlets d join public.users u on u.id=d.user_id
where d.scope='personal' and u.timezone not in ('UTC','Europe/Istanbul')
order by d.generated_at desc limit 20
```
Seçilmiş satırlar (3 UTC-dışı kullanıcı + diğerleri):
```
0ca76cc8 America/Los_Angeles  date 2026-10-12  gen_utc 2026-10-13T03:14:37  gen_local 2026-10-12 20:14  utc−key=1   (≥18 yerel → bugünün yerel tarihi)
5143c824 Asia/Singapore       date 2026-10-12  gen_utc 2026-10-13T03:14:37  gen_local 2026-10-13 11:14  utc−key=1   (<18 yerel → dün)
0847fade America/Los_Angeles  date 2026-10-08  gen_utc 2026-10-09T21:03:47  gen_local 2026-10-09 14:03  utc−key=1
7a77bc00 Asia/Seoul           date 2026-10-13  gen_utc 2026-10-14T00:34:16  gen_local 2026-10-14 09:34  utc−key=1
e356eed2 Europe/Kyiv          date 2026-10-18  gen_utc 2026-10-19T13:12:12  gen_local 2026-10-19 16:12  utc−key=1
```
Kontrol (Istanbul): `2026-10-19 18:07 yerel → date 2026-10-19`; `2026-10-19 11:29 yerel → date 2026-10-18`.

```sql
select count(*) n,
  count(*) filter (where d.date = (case when extract(hour from d.generated_at at time zone u.timezone) >= 18
     then (d.generated_at at time zone u.timezone)::date else (d.generated_at at time zone u.timezone)::date - 1 end)) as match_local_cycle,
  count(*) filter (where d.date = (d.generated_at at time zone 'UTC')::date) as match_utc_date
from public.daily_gauntlets d join public.users u on u.id=d.user_id
where d.scope='personal' and d.cycle='current' and u.timezone <> 'UTC' and d.generated_at > '2026-10-10'
```
→ `{"n":21,"match_local_cycle":21,"match_utc_date":10}`.

Ek: `select key,value from app_config where key like '%launch%'` → `launch_date = 2026-09-18`; `select count(*),min(day_number),max(day_number) from editorial_calendar_days` → 100 / 1 / 100.
Ek: `daily_gauntlets` içinde `America/New_York` kullanıcısı satırı yok (5 NY kullanıcısı var, hiçbiri gauntlet üretmemiş) → NY satırları kod+modül çalıştırmasıyla, canlı satırla değil.

### 3.6 Tek satır cevap

**Yeni bir ABD kullanıcısı vaat edilen akşam ritüelini doğru saatte yaşıyor mu? KISMEN.**
Gün sınırı ve sunucu hesabı yerel 18:00'e doğru bağlı (EVET). Ama (a) 18:00 öncesi kuran, "bu akşamın" değil dünün dörtlüsünü hemen alır, bir sonraki 18:00'e kadar başka dörtlü yok; (b) 18:00 hatırlatıcısı yalnız bildirim izni verilmişse var ve izin ilk şampiyondan sonra isteniyor, sunucu push cron'u kapalı; (c) NY kullanıcısıyla canlı doğrulama yok.

## 4. B — Çift anonim kullanıcı

### 4.1 Kod izi
- Tek bootstrap effect'i: `app/_layout.tsx:409-654` (`[]` deps, `:654`). `getSession()` boşsa `signInAnonymously()` (`:465-483`). Aynı effect'te `onAuthStateChange`: `SIGNED_IN`/`INITIAL_SESSION` → `bootstrapAppUser()` (`:537-539`) → `ensureAppUser()` upsert (`auth-utils.ts:73-129`, `onConflict:'auth_id'`).
- `signInAnonymously` çağrı yerleri: `_layout.tsx:471` (ilk açılış), `:568` (TOKEN_REFRESHED + oturum yok), `:605` (SIGNED_OUT recovery). Başka çağıran yok (kod aramasında `.claude/worktrees/paywall-copy` kopyası dışında). StrictMode kullanımı yok (`_layout.tsx` taraması).
- `signInAnonymously` mevcut oturumu kontrol etmiyor; `getSession()` kontrolü ile çağrı arası async boşluk var. Aynı soğuk açılışta iki yol birlikte tetiklenirse (ör. ilk açılış dalı + `bootstrapAppUser` USER_NOT_FOUND → `signOut({scope:'local'})` → SIGNED_OUT dalı `:158-170, :592-640`) birden fazla anonim kimlik açılabilir. Bu yol yalnız ölü-JWT'de çalışır, yeni kurulumda değil.
- Auth user ↔ `public.users` satırı: `ensureAppUser` başarısız/atlanırsa (uygulama hemen kapatılırsa, ağ, `USER_NOT_FOUND`) auth user satırsız kalır. `gate.tsx:71` `getAppUserId()` de satır arıyor (ikinci yol).
- Kural 1/2 notu: `app/gate.tsx:103-105` ve `:125-128` catch'leri log/Sentry yazmıyor (yorum var, boş-catch'e yakın) → bkz. 9.

### 4.2 SQL (verbatim)
```sql
select count(*) as auth_total,
  count(*) filter (where not exists (select 1 from public.users p where p.auth_id=a.id::text)) as no_public_row,
  count(*) filter (where a.is_anonymous) as anon_total,
  count(*) filter (where a.is_anonymous and not exists (select 1 from public.users p where p.auth_id=a.id::text)) as anon_no_row
from auth.users a
```
→ `auth_total 344 · no_public_row 27 · anon_total 261 · anon_no_row 27`.
```sql
select to_char(created_at,'YYYY-MM') m, count(*) total,
  count(*) filter (where not exists (select 1 from public.users p where p.auth_id=a.id::text)) orphan
from auth.users a group by 1 order by 1
```
→ Mar 1/0 · Nis 13/0 · May 159/0 · Haz 19/0 · Tem 18/0 · **Ağu 51/8 · Eyl 37/7 · Eki 46/12** (Eki ≈ %26).
```sql
with x as (select id, created_at, is_anonymous, lag(created_at) over (order by created_at) prev,
  lead(created_at) over (order by created_at) nxt from auth.users)
select left(id::text,8) id8, created_at, is_anonymous,
  (select p.timezone from public.users p where p.auth_id=x.id::text) tz,
  extract(epoch from (created_at-prev)) gap_prev_s
from x where (created_at-prev) < interval '1 second' or (nxt-created_at) < interval '1 second'
order by created_at desc limit 60
```
Çıktı — **tüm zamanda yalnız 2 küme**:
```
f13e3653 2026-10-13T03:14:35.125814Z anon tz=Asia/Singapore     gap_prev 0.000004 s
42a4dfd9 2026-10-13T03:14:35.125810Z anon tz=America/Los_Angeles
be408bd9 2026-10-01T18:51:57.933807Z anon tz=NULL (public satırı yok) gap 0.0517 s
a655125c 2026-10-01T18:51:57.882064Z anon tz=NULL                    gap 0.1090 s
3bf39268 2026-10-01T18:51:57.773053Z anon tz=NULL
```

### 4.3 Hüküm: **bilinmiyor (UNVERIFIED), "istemci yarışı" lehine zayıf, "ayrı cihaz/otomasyon" lehine daha güçlü kanıt**
- 13 Eki çifti: iki kullanıcı **farklı tz** (LA, Singapur) ve ikisinin `public.users` satırı + gauntlet'i var (üretim 03:14:37.035 / .024, 11 ms arayla). Tek cihaz iki farklı IANA tz'ye sahip olamaz → tek kurulumun yarışı DEĞİL. 4 µs fark insan davranışı değil; eşzamanlı betik/inceleme otomasyonu (ör. mağaza inceleme/test altyapısı) olasılığı var — doğrulanamadı.
- 1 Eki üçlüsü: 161 ms içinde 3 anonim, **üçünün de `public.users` satırı yok**. Tek bir uygulama kurulumu olsaydı en az sonuncusu (aktif oturum) `ensureAppUser` ile satır alırdı. Üçünün de satırsız olması uygulama bootstrap'ının hiç çalışmadığını düşündürür (doğrudan Auth API çağrısı/tarama) → istemci yarışına uymuyor. Ama tek cihazda 3 `signInAnonymously`'nin Auth sunucusuna peş peşe ulaşması + uygulamanın hemen kapatılması da kuramsal olarak mümkün (UNVERIFIED).
- Sızıntı oranı (Eki ≈ %26 sahipsiz) bu iki kümeden bağımsız ve çok büyük; kümeler yalnız 5 kimliği açıklar. Hafıza notu ("Hipotez A: bounce, kod hatası yok") bu oturumda yeniden doğrulanmadı.
- Doğrulama önerisi: Sentry'de `flow:anonymous_session_recovery` ve `APP_USER_CREATE_FAILED` olaylarını 1 Eki 18:51 UTC ve 13 Eki 03:14 UTC penceresinde ara; Auth log'larında ilgili `user-agent`/IP.

## 5. C — Apple Ads atıfı

1. `react-native-purchases` **10.0.1** (`package.json` `^10.0.1`; `package-lock.json:13457-13458` `10.0.1`; `node_modules` doğrulandı). Kilit dosyası son 27 Ağu'da değişmiş → 907 bu sürümle derlenmiş olmalı (build kaydı doğrulanmadı, UNVERIFIED).
2. **Evet.** Tip: `node_modules/react-native-purchases/dist/purchases.d.ts:432` `static enableAdServicesAttributionTokenCollection(): Promise<void>` ("Disabled by default"). JS: `dist/purchases.js:925-940` (yalnız iOS, `throwIfNotConfigured` sonra native çağrı). Native: `ios/RNPurchases.m:230-241` `RCT_EXPORT_METHOD(enableAdServicesAttributionTokenCollection)` → `[RCCommonFunctionality enableAdServicesAttributionTokenCollection]` (iOS ≥14.3). Podspec `PurchasesHybridCommon 18.1.0` (`RNPurchases.podspec:28`).
3. `Purchases.configure`: `services/purchaseService.ts:261-264` (`initializePurchases`, `_layout.tsx:392`). AdServices çağrısı **hiçbir yerde yok** (`enableAdServices` kod taraması: 0 sonuç; `app.json` içinde de ek anahtar yok).
4. **OTA ile yapılabilir (JS-only): EVET**, çünkü native method `RNPurchases.m`'de zaten `RCT_EXPORT_METHOD` olarak 907'nin ikilisine derlenmiş (10.0.1 ile derlendiyse). Yeni native build gerekmez. **Sınırlamalar:**
   - `app.json:60-65` `fallbackToCacheTimeout: 0`, `checkAutomatically: ON_LOAD` → yeni kurulum ilk açılışta gömülü paketi çalıştırır; OTA 2. soğuk açılışta devreye girer. İlk açılışta çağrı olmaz; RC'nin token'ı sonradan toplayıp toplayamayacağı UNVERIFIED (RC dokümanı/dashboard ile teyit).
   - Runtime `appVersion` = 2.1.0: OTA 2.1.0 tabanından (`release/2.1.0` / rc5) yayınlanmalı; marka dalındaki native-build 2.1.1 değişiklikleri aynı runtime'ı paylaşıyor ama dal "native build 2.1.1" olarak planlı — OTA'yı hangi daldan keseceğin CTO kararı.
   - `configure`'dan SONRA çağrılmalı (`throwIfNotConfigured`); `initializePurchases` içinde `_rcReady.markReady()` sonrası (`purchaseService.ts:266-267`) doğal yer.
5. Uygulamada olmayan/dashboard'da olanlar: RC Apple Search Ads/AdServices entegrasyonu (dashboard), Apple Ads kampanya hesabı. Uygulama tarafında ek gereken yok (ATT istemi AdServices için gerekmez). Doğrulanamayan: RC'de Apple Ads entegrasyonunun açık olup olmadığı (UNVERIFIED).

## 6. D — Funnel (PostHog)

| Funnel adımı | Event | dosya:satır | Property (timezone?) | Anonim kullanıcıda ateşler mi |
|---|---|---|---|---|
| İlk açılış | `app_launched` (HER açılış; "ilk" işareti yok) | `app/_layout.tsx:361` | yok (timezone yok); super prop: `update_id, update_source, runtime_version` (`:115-119`) | Evet (SDK anonim id) |
| Onboarding | `onboarding_started` / `onboarding_completed` | `app/onboarding.tsx:102` / (completed ayrıca var) | yok | Evet |
| Ekran açıldı (duel gösterilmeden önce) | `gauntlet_viewed` | `GauntletShell/index.tsx:489` | yok | Evet |
| İlk düello gösterildi | `gauntlet_started` (gauntlet başına bir kez) | `GauntletShell/index.tsx:585-591` | `gauntlet_id, algorithm_version, context_*` (tz yok) | Evet |
| İlk seçim | `choice_submitted` | `GauntletShell/index.tsx:1185-1197` | `gauntlet_id, round, film_a/b, latency_ms, context_*` | Evet |
| Şampiyon | `champion_revealed` + `gauntlet_completed` / `champion_viewed` | `:1290-1298` / `:1507-1512` | `champion_film_id`; `minutes_to_next_cycle` | Evet |
| Paywall görüldü | `paywall_viewed` (+ `paywall_triggered`) | `components/paywalls/ContextualPaywall.tsx:47` / `services/conversion/triggerOrchestrator.ts:275` | `variant` / `trigger_type, variant` | Evet |
| Satın alma | `purchase_started` / `purchase_completed` | `services/purchaseService.ts:569, 579` | `package_id, product_id` — **deneme mi/ücretli mi bilgisi yok** | Evet |
| Deneme başladı | **ayrı event yok** (`purchase_completed` içinde karışık) | — | — | — |
| D1 (ertesi yerel gün) | **event yok**; yalnız `app_launched` zaman damgalarından türetilir | — | **timezone property yok** → "yerel gün" PostHog'da kurulamaz | — |

- **distinct_id:** uygulama `identify` yalnız **anonim OLMAYAN** oturumda çağırıyor (`_layout.tsx:228-238`, `if (!isAnonymous)`). Anonim kullanıcıda distinct_id = PostHog SDK'sının kendi cihaz-kalıcı rastgele id'si; Supabase auth id'sine **bağlı değil** (`services/posthog.ts:63-65` yalnız identify/ reset; `reset()` `sessionReset.ts:150`). Kararlılık: kurulum boyunca aynı (SDK kalıcı depo; doğrulanmadı, UNVERIFIED).
- **B'deki çift-kullanıcı PostHog'da kişi bölmez** (distinct_id auth id'den bağımsız). Tersine: aynı kişinin birden çok auth kimliği PostHog'da tek kişi, Supabase'de çok kişi görünür → PostHog↔DB eşleme anahtarı yok. Ayrıca `identity_reset_detected` (`_layout.tsx:443, 624`) kimlik kaybını sinyalliyor.
- **Reklam ↔ organik ayrımı PostHog'da: HAYIR.** Kaynak/kampanya property'si, UTM, `$app_installed` (SDK'da `captureAppLifecycleEvents` açılmamış, `posthog.ts:54`) yok. Apple Ads atıfı yalnız RC tarafında oluşur (AdServices) ve PostHog'a aktarılmaz. `$timezone` SDK'da bulunamadı (UNVERIFIED: PostHog GeoIP `$geoip_time_zone` sunucuda eklenebilir).
- PostHog başlatılamazsa `track` Sentry warning + event düşürme (`posthog.ts:73-76`); init `EXPO_PUBLIC_POSTHOG_KEY` yoksa atlıyor (`:47-53`) — sessiz değil (Sentry warning).

## 7. E — RevenueCat webhook / deneme durumu

1. `INITIAL_PURCHASE|RENEWAL|PRODUCT_CHANGE|UNCANCELLATION` (`revenuecat-webhook/index.ts:497-500`): `users` ← `subscription_tier`, `subscription_active_until = expiration_at_ms` (null=lifetime), `subscription_will_renew=true`, `updated_at` (`:517-526`); `subscriptions` ← `plan, status:'active', expires_at, environment` — **yalnız satır varsa** (`.eq('user_id').in('status',[active,trial,expired,cancelled])`, `:606-615`); satır yoksa `SUBSCRIPTION_ROW_NOT_FOUND` warning + 200 (`:617-638`). `CANCELLATION` (`:813-958`): yalnız `will_renew=false` (refund `CUSTOMER_SUPPORT` ise tier=free). `EXPIRATION` (`:962-1005`): `tier=free, will_renew=false`; `subscriptions.status='expired'` yalnız `status='active'` satırlarda. **`period_type` hiçbir yerde okunmuyor** (dosyada eşleşme yok); `expiration_at_ms` → `users.subscription_active_until` ve (satır varsa) `subscriptions.expires_at` yazılıyor; `trial_used` yazılmıyor.
2. Migration 106 CHECK: `status IN ('free','trial','active','expired','cancelled')`, DEFAULT `'active'` (`106_…sql:47-57`); canlı kısıt aynı (sorgu aşağıda). **Trial değeri var ama webhook onu hiç yazmıyor.** Ek canlı kısıt: `plan IN (weekly, monthly, yearly, annual, lifetime)`, `UNIQUE(user_id)`.
3. Yetki: `submit-choice/index.ts:305-322`, `slot-triple`, `slot-mood-filtered` → **`users.subscription_tier`** okur. `subscriptions.expires_at` yalnız UI'da (`contexts/SubscriptionContext.tsx:241`); `trial_used` yalnız `subscriptionService.ts:95,118,159` (deneme-uygunluk gösterimi). `subscription_active_until` hiçbir yerde yetki için okunmuyor. Sonuç: iptal edilen deneme kullanıcısı tier'ı `EXPIRATION` olayı gelene kadar korur; olay hiç gelmez/başarısız olursa (webhook 500'ü RC yeniden dener, `:994-997`) Plus açık kalır — bitiş tarihine karşı sunucu tarafı bir güvenlik ağı yok. `expires_at=NULL` tek başına yetkiyi etkilemez.
4. SQL (maskeli):
```sql
select left(s.id::text,8) sid, left(s.user_id::text,8) uid, s.plan, s.status, s.trial_used, s.expires_at,
  s.environment, s.created_at, s.updated_at, s.entitlement_id from public.subscriptions s order by s.created_at desc limit 12
```
PRODUCTION satırı: `7de0f199 / a0d7c9ff · annual · status active · trial_used false · expires_at NULL · PRODUCTION · created 2026-10-17T18:55:06.366643 · updated aynı · chosy_plus`. Diğer 6 satır SANDBOX.
```sql
select left(u.id::text,8) uid, u.subscription_tier, u.subscription_active_until, u.subscription_will_renew, u.updated_at
from public.users u where u.id in (select user_id from public.subscriptions where environment='PRODUCTION')
```
→ `a0d7c9ff · annual · active_until 2026-10-24T18:54:58Z · will_renew false · updated 2026-10-17T18:57:04`.
Yorum: `users` webhook ile yazılmış (tier + bitiş = 7 günlük deneme sonu) ama `subscriptions` satırı 18:55:06'da, yani webhook'tan SONRA istemci `upsertSubscription` ile (`subscriptionService.ts:112-121`, `expires_at: null`, `trial_used:false`) oluşturulmuş görünüyor — webhook'un subscriptions UPDATE'i satır yokken 0 satır etkilemiş olmalı (Sentry'de `SUBSCRIPTION_ROW_NOT_FOUND` aranmalı, UNVERIFIED). `will_renew=false` + 18:57 `updated_at` = kullanıcı denemeyi iptal etmiş (CANCELLATION); tier 24 Eki 18:54'e kadar `annual`, ardından `EXPIRATION` ile free olması bekleniyor — **24 Eki'de izlenmeli**.
```sql
select conname, pg_get_constraintdef(oid) def from pg_constraint where conrelid='public.subscriptions'::regclass
```
→ status/plan/environment CHECK'leri, `subscriptions_user_id_key UNIQUE(user_id)`, FK `ON DELETE CASCADE`.

## 8. Bulgular tablosu

| # | dosya:satır | durum | büyüklük |
|---|---|---|---|
| F1 | `app/_layout.tsx:228-238` | Anonim kullanıcıda PostHog `identify` yok; PostHog↔Supabase eşleme anahtarı yok | S–M (CTO kararı: anon id PostHog'a gider mi) |
| F2 | `app/_layout.tsx:361`, `services/posthog.ts:54` | "İlk açılış" ve install event'i yok; `app_launched` her açılışta | S |
| F3 | `services/posthog.ts`, `_layout.tsx:115-119` | Event/super prop'larda timezone ve kaynak (ads/organik) yok | S |
| F4 | `services/purchaseService.ts:261-267` | `enableAdServicesAttributionTokenCollection` çağrılmıyor | S (OTA) |
| F5 | `app.json:60-65` | `fallbackToCacheTimeout:0` → yeni kurulumun 1. açılışı OTA'sız | — (bilgi) |
| F6 | `purchaseService.ts:569-583` | `purchase_completed` deneme/ücretli ayrımı taşımıyor, `trial_started` yok | S |
| F7 | `revenuecat-webhook/index.ts:497-615` | `period_type` okunmuyor; `status` hep `'active'`; `trial_used` yazılmıyor; subscriptions satırı yoksa güncelleme atlanıyor | M |
| F8 | `subscriptionService.ts:112-121` vs webhook | İstemci satırı webhook'tan sonra `expires_at:null` ile açıyor (PRODUCTION satırı) | M |
| F9 | `migrations/109_…:711-718` | `update_streak` UTC (`CURRENT_DATE`); gauntlet'te çağrılmıyor, eski feed'de çağrılıyor | S (şu an etkisiz) |
| F10 | canlı: 27 sahipsiz auth (Eki 12/46) | DB tarafı kurulum sayımı ~%26 eksik; PostHog etkilenmez | M |
| F11 | `cron.job` | `schedule-notifications` / `send-daily-pick` için aktif cron yok | bilgi |

## 9. Reklamdan önce zorunlu düzeltmeler (öneri; uygulanmadı)

1. **Apple Ads atıf çağrısı** — `initializePurchases` içinde configure sonrası `enableAdServicesAttributionTokenCollection()` (hata Sentry'ye). (a) Çağrı yoksa RC'de reklamdan gelen kurulum/satın alma ayrılamaz. (b) OTA (2.1.0 runtime tabanından). (c) **S**. Not: 1. açılış boşluğu (F5) için RC tarafı davranışı önce teyit edilmeli.
2. **PostHog'da kaynak ayrımı + yerel gün** — `first_open` (kurulum başına bir kez, AsyncStorage bayrağı), event'lere/super prop'a `timezone` (IANA) ve kaynak etiketi (AdServices token'ı doğrudan PostHog'a değil; kampanya kimliği için RC subscriber attribute / ya da D1'i RC+DB'den kurma kararı). (a) Aksi hâlde reklam/organik ve ABD yerel-D1 ölçülemez. (b) OTA. (c) **S–M**. **DUR NOKTASI:** yeni olay/özellik tasarımı ürün/analitik sözleşmesi; CTO onayı gerekir.
3. **Anonim kimliği PostHog'a bağlama kararı** (F1) — DB funnel'ı ile PostHog'u kesiştirebilmek için gerekli; gizlilik/politika kararı olduğu için **DUR NOKTASI (CTO)**. (b) OTA. (c) **S**.
4. **Trial/Pro görünürlüğü** — reklam testinin ana metriği "deneme başlatma" ise RC dashboard'unu kaynak alma kararı (kod yok) VEYA webhook'ta `period_type` okuma. Webhook değişikliği Edge Function deploy (OTA değil) ve `status` semantiği = **DUR NOKTASI**. (c) **M**. Minimum: RC dashboard'u deneme metriği için tek kaynak ilan et, Supabase `subscriptions`'a güvenme.

## 10. Reklamı bekletmeyen, yapılması gerekenler

- `update_streak` UTC → kullanıcı-yerel (şu an gauntlet'te kullanılmıyor; streak UI bağlanınca gerekir).
- Webhook `period_type` + `trial_used`; istemci/webhook `subscriptions` yarışı (F7-F8); `EXPIRATION` yedek ağı (ör. `subscription_active_until` geçti mi kontrolü) — 24 Eki'deki gerçek deneme bitişi izlenerek.
- Sahipsiz auth kimliği oranı (F10) ve 1 Eki / 13 Eki kümelerinin Sentry/Auth log incelemesi.
- Bayat dokümanlar: `M2_ZAMAN_MIMARISI.md:35,81` ve `V1_TESTFLIGHT_CHECKLIST.md:71`; yorum `gauntletService.ts:646`.
- İstemci `cycle:'previous'` göndermiyor → `previousCycle.ts`/E-21 sunucu yolu ölü kod.
- NY saat dilimi için canlı doğrulama (ilk NY gauntlet satırı oluşunca 3.5 sorgusunu yeniden çalıştır).

## 11. Kapsam dışı bulgular

- `app/gate.tsx:103-105, 125-128`: catch blokları log/Sentry yazmıyor (Kural 1/2 gerginliği).
- `users.timezone` DEFAULT 'UTC': 281/~315 satır; son 30 günde 56 kullanıcının 31'i 'UTC' (varsayılan veya gerçek, ayrılamaz). Yalnız `generate-gauntlet`/push token yazıyor; gauntlet üretmeyen (21/56) kullanıcıda kolon hiç dolmuyor.
- Sunucu 18:00 push'u (`schedule-notifications`) ve `send-daily-pick`, `watchlist-activation-*`, `posterle` cron'ları `cron.job`'da `active=false` ya da yok. Yalnız yerel hatırlatıcı çalışıyor (izin gerekir).
- `.claude/worktrees/paywall-copy` repo içinde eski bir kopya taşıyor (kod aramalarını kirletir).

## 12. UNVERIFIED listesi ve doğrulama yolu

| Madde | Doğrulama |
|---|---|
| Build 907'nin RN-purchases 10.0.1 ile derlendiği | `eas build:view` / build'in lockfile'ı; ya da cihazda `Purchases.enableAdServices…` çağrısının hata vermediği TestFlight denemesi |
| RC'nin 1. açılışta çağrı olmayınca token'ı sonradan toplayıp toplamadığı | RC dokümanı + test cihazında 2. açılış sonrası RC dashboard'da attribution alanı |
| RC'de Apple Ads entegrasyonunun açık olması | RC dashboard → Integrations/Apple Search Ads |
| NY kullanıcısı canlı satırı | İlk NY gauntlet üretilince 3.5 sorgusu |
| `users.timezone` tam dağılımı | Aynı sorguyu `limit`/`jsonb_agg` ile tek JSON olarak çalıştır |
| 1 Eki / 13 Eki kümelerinin kaynağı | Sentry `anonymous_session_recovery`, `APP_USER_CREATE_FAILED`; Supabase Auth log (IP/UA) |
| PostHog distinct_id kurulum boyunca kararlı mı; `$timezone`/GeoIP | PostHog UI'da bir test cihazının person/props'u |
| `SUBSCRIPTION_ROW_NOT_FOUND` olayının 17 Eki 18:55 civarında olması | Sentry araması `error_code:SUBSCRIPTION_ROW_NOT_FOUND` |
| 24 Eki 18:54 UTC `EXPIRATION` ile PRODUCTION kullanıcısının free'ye düşmesi | O tarihte `users.subscription_tier` ve `subscriptions.status` yeniden sorgula |
| Tz değiştiren (uçuş) kullanıcıda çift/atlanan gün | Test cihazında tz değiştirip `generate-gauntlet` yanıtı karşılaştır |
