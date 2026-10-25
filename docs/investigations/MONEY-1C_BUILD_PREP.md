# MONEY-1C — 29 Eki preview build ön kontrolü

Tarih: 25 Eki 2026 · Dal: `feat/money-1c` (HEAD `3a8ae48`) · Yalnız kod/config/EAS salt-okuma; **hiçbir şey değiştirilmedi, build/OTA/deploy yok.**
Kaynaklar: `eas.json`, `app.json`, `app.config.ts`, `app/_layout.tsx`, `services/appConfigFlags.ts`; `eas channel:list`, `eas branch:list`,
`eas update:list`, `eas build:list`, `eas env:list`, `eas build:version:get` (hepsi okuma); PostHog HogQL; 25 Eki mantıksal export'u (`app_config.jsonl`).

## 0. Özet — karar/onay bekleyen bulgular

| # | Bulgu | Önem | Gereken |
|---|---|---|---|
| B1 | Bu dalın `app.json` sürümü **2.1.2**; 2.1.2 App Store'da yayında → aynı sürüm için TestFlight build'i reddedilir (kapanmış train). 24 Eki'de bu yüzden geçici 2.1.3 (#914, `44849a9`) alındı; o commit bu dalda YOK | **Yüksek** (build'i bloke eder) | Sürüm kararı (§3) |
| B2 | `preview` ve `production` EAS ortamları aynı Supabase projesine (canlı `xpcwihldlnlmyopjubdc`), aynı PostHog/Sentry/RevenueCat anahtarına bakıyor; olaylarda ortam ayrımı etiketi yok | Orta (veri karışır) | Test olaylarını `$app_build` ile ayır (§2) |
| B3 | `mood_offer_testers` satırı canlıda ZATEN dolu (`a25917c2-…`); `MONEY-1C_CIHAZ_TEST.md`'nin eski talimatı (`ON CONFLICT … EXCLUDED`) listeyi ezerdi | Orta | Cihaz test belgesi düzeltildi (ekleme komutu) |
| B4 | "OTA 2.1.0'a ulaşmıyor" yorumu **yanlıştı**; kanal/runtime doğru. Ölçü (`ota_update_found`) erişimi ölçmüyor | Bilgi | FAZ3_ROLLOUT §8.1 düzeltildi (§5) |

## 1. Profil, kanal, ortam (eas.json)

| Profil | Kanal | EAS ortamı | Dağıtım | autoIncrement | `APP_ENV` |
|---|---|---|---|---|---|
| `preview` | `preview` | `preview` | internal (ad-hoc) | — | `preview` |
| **`preview-store`** (extends preview) | `preview` | `preview` | **store (TestFlight)** | **true** | `preview` |
| `preview-e2e` (extends preview-store) | `preview` | `preview` | store | false | + `EXPO_PUBLIC_APP_ENV=e2e-test` (**kullanma**: e2e test kipini açar) |
| `production` | `production` | `production` | store | true | `production` |

- 29 Eki build'i için doğru profil: **`preview-store`** (TestFlight internal). `appVersionSource: remote`: uzaktaki son iOS buildNumber **914**
  (`eas build:version:get -p ios -e preview-store`), sonraki **915**. `app.json`'daki `buildNumber: "905"` yok sayılır (EAS uyarısı verir, zararsız).
- Kanal → branch eşleşmesi (EAS): `preview` kanalı → `preview` branch'i (son grup `release/2.1.0-rc5`, runtime 2.1.0); `production` kanalı → `production`
  branch'i. `development` kanalı boş. **2.1.3/2.1.4 runtime'ı için hiçbir branch'te güncelleme yok** → preview build'i yalnız kendi gömülü JS'ini çalıştırır,
  production OTA'ları bu build'e GELMEZ (runtime `appVersion` politikası: `runtimeVersion = sürüm`).
- `app.config.ts` `extra.supabaseUrl/anonKey/tmdb/appEnv`'i `process.env`'den doldurur; `plugins` anahtarı tanımlanmamış (kritik kural korunuyor).
- `expo-updates`: `checkAutomatically: ON_LOAD`, `fallbackToCacheTimeout: 0`, URL `https://u.expo.dev/5c6d10a4-…`. JS tarafında `app/_layout.tsx`
  ayrıca `checkForUpdateAsync` + `fetchUpdateAsync` yapar.

## 2. Supabase ortamı ve veri karışması

`eas env:list preview` ile `eas env:list production` (anahtar değerleri çıktıda kısaltılarak okundu; gizli değerler zaten gösterilmez): `EXPO_PUBLIC_SUPABASE_URL =
https://xpcwihldlnlmyopjubdc.supabase.co` **her ikisinde de**; anon key, PostHog host/key, Sentry DSN, RevenueCat iOS key, Google client id'leri, TMDb key
de aynı. Yani preview build'i **canlı veritabanında, gerçek kota/kullanıcı tablolarıyla** çalışır; RevenueCat satın almaları TestFlight'ta sandbox'tır.
- **Ayrı staging YOK** (karar/mimari konusu, şimdi dokunulmaz). Sonuç: test aramaları gerçek `mood_searches` satırı yazar, kota düşürür.
- Olay ayrımı: `app_env`/`APP_ENV` PostHog'a super property olarak GİTMİYOR (kod taraması: `appEnv` yalnız `app.config.ts`'te). Ayırmak için PostHog'un
  otomatik `$app_build` özelliği kullanılır: test build'i **≥ 915**, production 2.1.2 = 912. Sentry'de `release` = `chosy-ai@2.1.x` + `dist` (buildNumber).
- `Updates.channel` Sentry'ye `update_channel` etiketi olarak yazılıyor ama 14 günlük aggregate sorguda bu etiket **boş** döndü (tüm sürümlerde); etiket
  gerçekten yazılıyor mu doğrulanmadı — küçük telemetri sorusu, build'i bloke etmez.

## 3. Sürüm sorunu (B1) — karar gerekli

- Durum: `build/preview-2.1.3` dalı = `44849a9` ("TestFlight için geçici sürüm 2.1.3 (BİRLEŞTİRME)"), yalnız `app.json` sürümü 2.1.3. Bu commit `feat/money-1c`'de **yok**
  (`git merge-base --is-ancestor` → hayır). `feat/money-1c` ile arasındaki tek içerik farkı: `app.json` 2.1.2↔2.1.3 ve `package.json`'da iki `test:mood-claim*` script'i.
- Build'in kaynağı `feat/money-1c` olacaksa `app.json` sürümü ≥ 2.1.3 olmalı (aksi hâlde 2.1.2 kapalı train hatası). Seçenekler (karar sizin):
  (a) `feat/money-1c` üstüne `44849a9`'u dosya düzeyinde al ya da `app.json` sürümünü 2.1.3 yapan küçük bir "build(preview)" commit'i ekle, build'i ondan al;
  (b) `build/preview-2.1.3` dalına `feat/money-1c`'yi birleştir (CLAUDE.md: `build/preview-2.1.3` dalına commit atılmaz — bu yüzden (a) önerilir);
  (c) 2.1.4 gibi yeni geçici sürüm. 2.1.3 zaten TestFlight'ta (#914) olduğundan aynı sürüme yeni build numarası (915) yüklenebilir; 2.1.3 App Store'a çıkmadığı varsayılırsa (doğrulanmadı) train açıktır.
- **Runtime sonucu:** sürüm 2.1.3 → runtime 2.1.3. 2.1.3 için OTA yayımlanmadığından build, içine gömülü JS'ini (money-1c commit'i) çalıştırır; OTA gerekmez.
- Bu belgede kod/sürüm değişikliği YAPILMADI.

## 4. `mood_offer` bayrağı preview build'de nasıl açılıyor

- Bayrak build'e bağlı DEĞİL; çalışma zamanı verisi: `app_config.mood_offer_enabled` (genel) **veya** oturumdaki `auth.users.id`'nin
  `app_config.mood_offer_testers` (jsonb dizi) içinde olması (`services/appConfigFlags.ts` `isMoodOfferEnabled`; kimlik oturumdan YEREL okunur, ağ yok; değerler
  `services/remoteConfig.ts` üzerinden 5 dk TTL'li tek `select key, value`). Satır yok / geçersiz / okuma hatası / önbellek yok → KAPALI.
- Canlı durum (25 Eki export'u): `mood_offer_enabled = false`, `mood_offer_testers = ["a25917c2-7476-41ea-a7fb-3ffecccf03e6"]`, ayrıca `paywall_lifetime_enabled = false`,
  `paywall_profile_upgrade = false`, `discover_tab_enabled = false`; `free_visible_count` satırı YOK (kodda varsayılan 3).
- Aynı `app_config` canlıdaki herkesin okuduğu yerdir; bu kodu içeren her build aynı listeyi görür. Yani preview build'i kendi başına yüzeyi açmaz; test hesabının
  `auth.users.id`'si listeye EKLENİR (ezilmez): komutlar `MONEY-1C_CIHAZ_TEST.md` §0.3. Genel açma (`mood_offer_enabled=true`) YAPILMAZ.
- Not (kural 6): `app_config` bu görevde değiştirilmedi; ekleme/çıkarma ayrı onaylı bir iş.

## 5. OTA neden 2.1.0'a "ulaşmıyor" göründü (B4) — kanal/runtime farkı YOK

Bulgular:
1. **Build'ler:** `eas build:list`: tüm 2.1.0 (#902–#907), 2.1.1 (#908–#911) ve 2.1.2 (#912) store build'leri `buildProfile=production`, `channel=production`, `runtimeVersion` = sürüm.
   2.1.0'lar arasında tek istisna #904 (`preview-store`, `preview` kanalı; TestFlight). Yani kanal doğru.
2. **Yayınlar:** `eas update:list --branch production` (son 40 grup): runtime 2.1.0 → 23 grup (sonuncusu "SPOT-2", ~20 Eki), 2.1.1 → 16 grup (sonuncusu "DECK-END-1", dün),
   2.1.2 → 1 grup (dün gece). Hepsi iOS. `production` kanalı yalnız `production` branch'ine bağlı.
3. **Olay nerede atılıyor:** `app/_layout.tsx` (`checkForOTAUpdate`, satır ~364–390): `Updates.checkForUpdateAsync()` → `isAvailable` ise `ota_update_found`; `fetchUpdateAsync()` → `isNew` ise
   `ota_update_fetched`. Ek super property'ler (`update_id`, `update_source`, `runtime_version`) aynı dosyada, PostHog `registerSuperProperties` ile (7a143f6, 29 Eyl). Güncelleme **yokken olay YOK**.
4. **Veri:** 12 aktif 2.1.0 kullanıcısının son açılışları 13–20 Eki (günlere dağılmış: 2/1/3/2/2/2). En yeni 2.1.0 OTA'sı ~20 Eki'de yayımlandı → çoğu yayından ÖNCE açıp bırakmış; bulunacak güncelleme yoktu.
   Yalnız 20 Eki'de açan 2 kişi güncellemeyi buldu+indirdi. Sonuç: düşük `found` sayısı erişim sorunu değil, **2.1.0 grubunun uykuda olması**.
5. **Kullanıcı başına son paket (son 14 gün, aktif):** 2.1.0: 11 `embedded`; 2.1.1: 12 `embedded` + ~11 `ota` (farklı update_id'ler). `embedded` = gömülü paketle açılış; `ON_LOAD` + `fallbackToCacheTimeout: 0`
   nedeniyle OTA **ilk soğuk açılışta indirilir, ikinci soğuk açılışta uygulanır** — tek oturumluk kullanıcılar hep `embedded` görünür.
6. **Faz 3 için sonuç:** OTA yolu çalışıyor ama (a) her runtime için ayrı yayın gerekir (2.1.0, 2.1.1, 2.1.2 — `appVersion` politikası; yayın sırasında `app.json` sürümü hedef runtime olmalı), (b) dönen kullanıcı
   ilk oturumda eski JS'le açılır, (c) JS uyumu: `release/2.1.0-rc5` → HEAD ve `v2.1.1-ota-final` → HEAD arasında `package.json` bağımlılığı/`plugins`/native yapılandırma değişikliği YOK (yalnız test script'leri,
   sürüm, ad ve splash görseli/rengi) → HEAD JS'i 2.1.0/2.1.1 native build'lerle uyumlu görünüyor. Splash değişikliği native olduğundan OTA ile gelmez (zararsız). Bu bir uyumluluk GARANTİSİ değil; yayından önce
   2.1.0/2.1.1 cihazında dene.
7. **Doğru erişim ölçüsü:** her aktif kullanıcının son `update_id`'sinin o runtime'ın en yeni OTA'sına eşitlik oranı (update_id↔grup eşlemesi `eas update:view <group>` ile). FAZ3_ROLLOUT §8.1/§8.2 buna göre güncellendi.

## 6. 29 Eki build öncesi kontrol listesi (hiçbiri çalıştırılmadı)

1. Sürüm kararı (§3) → onay → `app.json` sürümü ≥ 2.1.3 olan commit. Çalışma ağacı temiz, dal doğru.
2. `eas build:version:get -p ios -e preview-store` → 914 (sonraki 915). Başka biri arada build aldıysa numara değişir.
3. `npm run typecheck` (baseline 14), `npm run test:mood-offer` (94), `npm run test:mood-claim` (9) yeşil.
4. Sunucu tarafı (139/140/parse-mood v43) 26 Eki'de uygulanmış ve doğrulanmış olmalı; B3c maddeleri sunucu deploy edilmeden koşulmaz (`CIHAZ_TEST` B3c notu).
5. Test hesabının `auth.users.id`'si `mood_offer_testers`'a EKLENMİŞ (ezme yok); bayrak 5 dk içinde yansır.
6. Build: `eas build -p ios --profile preview-store` (onaylı), TestFlight'a otomatik gider; `--profile preview-e2e` KULLANMA.
7. Cihaz testinden ÖNCE `MONEY-1C_CIHAZ_TEST.md` Bölüm C'yi eski sürüm (2.1.2/2.1.3) varken koş; sonra yeni build'i kur.
8. Test olayları PostHog'da `$app_build ≥ 915` ile ayrılır.
