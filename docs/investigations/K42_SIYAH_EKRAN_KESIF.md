# K-42 — Uçak modunda siyah ekran keşfi

**Tarih:** 18 Eylül 2026
**Mod:** SALT OKUNUR. Hiçbir kod/migration/deploy değişmedi.
**Tetikleyici:** preview-e2e build 901, TestFlight, GERÇEK uçak modu.
Belirti: kart/gauntlet gelmiyor, siyah ekran.

---

## Yönetici özeti

1. **Build 901'de gerçek NetInfo'ya HİÇ abone olunmuyor.** `preview-e2e`
   profili `EXPO_PUBLIC_APP_ENV=e2e-test` set ediyor (`eas.json`); bu durumda
   `networkStatus.ts:144-153` yalnızca deep-link dinleyicisini kuruyor ve
   `NetInfo.addEventListener` satırına (152) **hiç ulaşılmıyor**. Gerçek uçak
   modunda `currentOnline` sonsuza kadar `true` kalıyor. "E2E dalı gerçek
   NetInfo yoluna sızdı mı" sorusunun cevabı: **evet — hem de en sert biçimde,
   gerçek yol bu build'de hiç bağlanmıyor.**
2. **Ama cache fallback zinciri bundan bağımsız.** `cache_today` / `cache_stale`
   kararı ağ durumuna değil, `parseInvokeError`'ın `status === null` çıktısına
   bakıyor (`gauntletService.ts:249, 321-346`). Yani (1) tek başına siyah
   ekranı açıklamıyor. Kırılan şey, **bağlantı geri geldiğinde otomatik
   toparlanma** (`GauntletShell/index.tsx:474-478` → `subscribeToReconnect`).
3. **Siyah ekranın en güçlü açıklaması bir BEKLEME PENCERESİ, eksik bir dal
   değil.** Uçak modunda `ensureAuthSession()` (`gauntletService.ts:158-170`)
   içindeki `getSession()` + `refreshSession()` zinciri, auth-js 2.105.1'in
   backoff'u yüzünden `functions.invoke` daha çağrılmadan **~60 saniyeye kadar
   bloke olabiliyor**. O süre boyunca ekran `bootstrapping` iskeletinde kalıyor.
   Aynı stall `gate.tsx:57`'de routing kararından önce bir kez daha yaşanıyor.
4. **Cache'in yazıldığını/kullanıldığını doğrulayacak hiçbir saha kanıtı yok.**
   Başarılı yazma hiçbir iz bırakmıyor (`gauntletCache.ts:105-128` yalnızca
   HATA dalında log atıyor), cache-hit sinyali ise `logger.warn`
   (`gauntletService.ts:339`) — ve `logger.warn` prod'da no-op
   (`utils/logger.ts:34-36`). Release build'de "cache oluştu mu" sorusunun
   cevabı **ölçülemez durumda.**
5. **Gerçek NetInfo yolunun otomatik test kapsamı sıfır.** k42-01/02 deep-link
   sahte-offline'ı sürüyor; o modda `isOnlineFromState` / `handleStateChange`
   (`networkStatus.ts:69-73, 102-104`) **erişilemez kod**. Kısmi kapsam değil,
   hiç kapsam yok.

---

## Bulgular tablosu

| # | Dosya:satır | Bulgu | Kanıt seviyesi | S/M/L |
|---|---|---|---|---|
| K42-A | `services/networkStatus.ts:144-153` | `isE2ETestMode()` true iken erken `return` deep-link dalında; `NetInfo.addEventListener` (152) hiç çağrılmıyor. Build 901 bu build. | Kod okundu, kesin | M |
| K42-B | `services/networkStatus.ts:227-242` | `refreshIsOnline()` e2e modunda NetInfo'ya sormadan `currentOnline` dönüyor (satır 231). "Karar anında tazele" güvencesi bu build'de yok. | Kod okundu, kesin | S |
| K42-C | `components/gauntlet/GauntletShell/index.tsx:474-478` | `subscribeToReconnect` gerçek uçak modu → normal moda geçişte ateşlenmiyor (K42-A sonucu). Kuyruktaki seçim ve donmuş ekran kendiliğinden çözülmüyor. | K42-A'dan türetildi | M |
| K42-D | `services/gauntletService.ts:158-170` | `ensureAuthSession()` offline'da ~60 sn'ye kadar bloke olabiliyor (zincir aşağıda). Bu süre boyunca `bootstrapping` iskeleti görünüyor. | Kütüphane kodu okundu; **cihazda ölçülmedi** | L |
| K42-E | `app/gate.tsx:57` | Aynı stall routing kararından ÖNCE bir kez daha. `decide()` için üst sınır/timeout yok — yalnız MIN_SPLASH alt sınırı (satır 31, 49-52). | Kod okundu, kesin | M |
| K42-F | `services/gauntletCache.ts:105-128` | Başarılı cache yazımı hiçbir iz bırakmıyor. Yazma hiç denenmemiş olabilir ve bu görünmez. | Kod okundu, kesin | S |
| K42-G | `services/gauntletService.ts:275-277, 291-298` | `cacheOwnerId()` null dönerse cache **hiç yazılmıyor** ve bu tamamen sessiz (`if (ownerId)` guard'ı, satır 276). Süresi dolmuş oturum / orphan auth'ta tam olarak bu olur. Kural 1 sınırında. | Kod okundu, kesin | S |
| K42-H | `services/gauntletService.ts:339` + `utils/logger.ts:34-36` | Cache-hit sinyali `logger.warn` → prod'da no-op. `cache_today`/`cache_stale` kullanımı sahada görünmez. | Kod okundu, kesin | S |
| K42-I | `.maestro/k42-01-cold-start-offline.yaml`, `k42-02-cache-today-offline.yaml` | İkisi de `chosy://e2e/set-offline` sürüyor. Gerçek NetInfo yolu bu flow'larda **erişilemez kod**. Kör nokta doğrulandı. | Kod + flow okundu, kesin | M |
| K42-J | `app/gate.tsx:103-105, 136-140`; `services/entryService.ts:47, 74` | Boş catch blokları (`// Hata sessizce geç`). Soğuk başlangıç yolu üzerindeler. CLAUDE.md kural 1-2. | Kod okundu, kesin | S |

---

## Kök neden hipotezi

### Elenen: "fallback UI hiç render edilmiyor"

`GauntletShell` **beş durumun hepsinde görünür bir dal render ediyor**:
`before_18` (910-919), `bootstrapping` + `loadError` (921-953),
`completed_today` (956-997), savunma dalı (1000-1015), oyun görünümü
(1021-1094). Boş `View` dönen bir yol yok.
`SentryErrorBoundary` de yakalanan bir crash'te görünür bir kart gösteriyor
(`components/ErrorBoundary/index.tsx:61-88`), boş ekran değil.

**Sonuç: "eksik conditional" ve "sessizce yutulan crash" senaryoları K-42
zincirinin kendi kodunda doğrulanamadı.** Siyah ekranın kaynağı render
dalları değil.

### Ayakta kalan hipotez: auth yenileme stall'ı (K42-D / K42-E)

Zincir `node_modules/@supabase/auth-js@2.105.1` içinden birebir okundu:

1. `gauntletService.ts:159` → `supabase.auth.getSession()`
2. `GoTrueClient.js:2353-2355` — oturum, süresi dolmadan **EXPIRY_MARGIN_MS
   önce** "expired" sayılıyor. `constants.js:5-12`:
   `AUTO_REFRESH_TICK_THRESHOLD (3) × AUTO_REFRESH_TICK_DURATION_MS (30 sn)`
   = **90 saniye**.
3. `GoTrueClient.js:2381` — expired ise `getSession()` **kendi içinde**
   `_callRefreshToken()` çağırıyor, yani ağ isteği atıyor.
4. `GoTrueClient.js:3759-3775` — `_refreshAccessToken` ağ hatasında
   exponential backoff ile yeniden deniyor (200, 400, 800 … ms), üst sınır
   `AUTO_REFRESH_TICK_DURATION_MS` = **30 saniye** duvar saati.
5. Dönen `session` null olduğu için `gauntletService.ts:161-169`'daki
   `isExpiredOrSoon` true oluyor → `refreshSession()` → **aynı 30 sn'lik
   döngü ikinci kez.**

Toplam: `supabase.functions.invoke('generate-gauntlet')` satırına
(`gauntletService.ts:237`) varmadan önce **~60 saniyeye kadar** bekleme.
`gate.tsx:57` aynı `getSession()`'ı çağırdığı için soğuk başlangıçta bu
pencere bir kez daha yaşanıyor.

O pencerede kullanıcının gördüğü:

- gate aşamasında `LoadingScreen` (film şeridi animasyonu),
- ardından `GauntletShell` `bootstrapping` iskeleti
  (`index.tsx:937-953`) — ink zemin üzerinde `Colors.bgElevated` rengini
  0.4-0.7 opaklıkta taşıyan iki dikdörtgen
  (`components/SkeletonLoader/index.tsx:53-56`).

Yani ekran teknik olarak "siyah" değil, **çok düşük kontrastlı ve uzun süreli
bir bekleme durumu**. Kullanıcı raporuyla uyumlu, ama **cihazda ölçülmedi** —
bu hipotez henüz kanıt değil.

### Neden deep-link testlerinde yakalanmadı

Sahte-offline modunda `supabaseFetch` (`services/supabase.ts:79-83`) isteği
`TypeError` ile anında düşürüyor; auth-js bunu da retryable saydığı için
backoff **orada da** işliyor. Fark, gerçek uçak modunda iOS'un ek
DNS/bağlantı gecikmesi eklemesi. Asıl mesele şu: **k42-01/02 flow'ları hiçbir
zaman gerçek cihazda yeşil görülmedi** (bkz. commit `bd0ccc3`: k42-07
"referans, CI'da koşulmuyor"), dolayısıyla bu bekleme penceresi hiçbir turda
ölçülmedi.

---

## Ölçülmüş sayılar

Build 901'in gerçekten e2e bayrağını taşıdığı doğrulandı:

```
$ node -e "console.log(JSON.stringify(require('./eas.json').build['preview-e2e']))"
{"extends":"preview-store","env":{"EXPO_PUBLIC_APP_ENV":"e2e-test"},"autoIncrement":false}
```

`utils/e2eTestMode.ts:16` → `process.env.EXPO_PUBLIC_APP_ENV === 'e2e-test'`.
`autoIncrement:false` + 900+ build bandı (commit `0376ba7`) → **build 901 =
preview-e2e = `isE2ETestMode()` true.**

auth-js sabitleri (`node_modules/@supabase/auth-js/dist/main/lib/constants.js`):

```
AUTO_REFRESH_TICK_DURATION_MS = 30 * 1000               // satır 5
AUTO_REFRESH_TICK_THRESHOLD   = 3                       // satır 8
EXPIRY_MARGIN_MS              = 3 * 30_000 = 90_000     // satır 12
NETWORK_FAILURE.MAX_RETRIES   = 10                      // satır 19
```

Sürümler: `@supabase/supabase-js` 2.105.1, `@supabase/auth-js` 2.105.1.

---

## DUR NOKTASI gerektiren maddeler

1. **K42-A düzeltmesi mimari karardır.** "E2E build'inde gerçek NetInfo'ya da
   abone ol, deep-link onun ÜSTÜNE yazsın" demek, daha önce DUR NOKTASI ile
   onaylanmış Maestro iOS override tasarımını değiştirir (gerekçesi
   `networkStatus.ts:106-121` yorumunda kayıtlı).
2. **K42-D için timeout/abort eklenmesi yeni bir pattern'dir.** Auth
   çağrılarına süre sınırı koymak ya da `bootstrapping` iskeletine bir "hâlâ
   deniyoruz" eşiği eklemek, kod tabanında bugün olmayan bir davranış.
3. **K42-F/H için cache telemetrisi** yeni bir ölçüm noktası açar (PostHog
   olayı mı, Sentry breadcrumb mı) — kanal seçimi ürün kararı.
4. **K42-I için gerçek NetInfo yolunu test etmek** yeni test altyapısı
   gerektirir (Maestro iOS'ta uçak modunu süremiyor). Kapsam kararı CTO'nun.

---

## Doğrulanamayanlar

- **Sentry sorgusu yapılamadı (iş kalemi 4 YAPILMADI).** Bu oturumda Sentry MCP
  bağlı değil — repoda `.mcp.json` yok ve `ToolSearch` ile erişilebilir bir
  Sentry aracı bulunamadı.
  Elle aranacak sorgu, `app/_layout.tsx:69-81`'den okundu:
  `release:chosy-ai@<app.json version>` **VE** `dist:901`.
  Dikkat: satır 77 `environment` değerini `__DEV__ ? 'development' :
  'production'` olarak set ediyor — yani **preview-e2e build'i Sentry'ye
  `production` ortamı olarak düşüyor**, ayrı bir e2e ortamı yok.
  Bakılacak etiketler: `error_code:GAUNTLET_OFFLINE`,
  `error_code:GAUNTLET_AUTH_EXHAUSTED`, `flow:anonymous_session_recovery`,
  `boundary:root`.
- **Cihazda hiçbir ölçüm yapılmadı.** K42-D'deki ~60 sn bir ÜST SINIR'dır,
  gözlem değil. Doğrulama yolu: uçak modunda açılıştan ilk görünür metne kadar
  geçen süreyi kronometreyle ölçmek.
- **Cache'in cihazda yazılıp yazılmadığı bilinmiyor** (K42-F/H: ölçüm noktası
  yok). Bu yüzden "cache_stale hiç oluşmadı mı, yoksa oluştu da gösterilmedi
  mi" sorusu **açık**.
- **Edge Function'ların canlı sürümü doğrulanmadı** — repodaki kod okundu,
  deploy edilmiş sürüm okunamadı.
