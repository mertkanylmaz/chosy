# MONEY-1C — 29 Eki preview build ön kontrolü

Tarih: 25 Eki 2026 · Dal: `feat/money-1c` (HEAD `3a8ae48`) · Yalnız kod/config/EAS salt-okuma; **hiçbir şey değiştirilmedi, build/OTA/deploy yok.**
Kaynaklar: `eas.json`, `app.json`, `app.config.ts`, `app/_layout.tsx`, `services/appConfigFlags.ts`; `eas channel:list`, `eas branch:list`,
`eas update:list`, `eas build:list`, `eas env:list`, `eas build:version:get` (hepsi okuma); PostHog HogQL; 25 Eki mantıksal export'u (`app_config.jsonl`).

## 0. Özet — karar/onay bekleyen bulgular

| # | Bulgu | Önem | Gereken |
|---|---|---|---|
| B1 | ~~Sürüm 2.1.2 kapanmış train~~ **ÇÖZÜLDÜ (karar 25 Eki 13:05):** `app.json` 2.1.3, iOS buildNumber 915, commit `70942b2`; `build/preview-2.1.3`'e commit yok | ~~Yüksek~~ kapandı | Build alınmadı (onay bekler) |
| B2 | `preview` ve `production` EAS ortamları aynı Supabase projesine (canlı `xpcwihldlnlmyopjubdc`), aynı PostHog/Sentry/RevenueCat anahtarına bakıyor; olaylarda ortam ayrımı etiketi yok | Orta (veri karışır) | Test olaylarını `$app_build` ile ayır (§2) |
| B3 | `mood_offer_testers` canlıda dolu; tek kimlik (`a25917c2-…`) **premium sandbox (lifetime) anonim hesaba** ait (§4.1) → ücretsiz akış testi için yetersiz | Orta | Ayrı ücretsiz test hesabı kimliği eklenmeli (ezme yok) |
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

## 3. Sürüm sorunu (B1) — karar verildi (25 Eki 13:05)

- Durum: `build/preview-2.1.3` dalı = `44849a9` ("TestFlight için geçici sürüm 2.1.3 (BİRLEŞTİRME)"), yalnız `app.json` sürümü 2.1.3. Bu commit `feat/money-1c`'de **yok**
  (`git merge-base --is-ancestor` → hayır). `feat/money-1c` ile arasındaki tek içerik farkı: `app.json` 2.1.2↔2.1.3 ve `package.json`'da iki `test:mood-claim*` script'i.
- Build'in kaynağı `feat/money-1c` olacaksa `app.json` sürümü ≥ 2.1.3 olmalı (aksi hâlde 2.1.2 kapalı train hatası). Seçenekler (karar sizin):
  (a) `feat/money-1c` üstüne `44849a9`'u dosya düzeyinde al ya da `app.json` sürümünü 2.1.3 yapan küçük bir "build(preview)" commit'i ekle, build'i ondan al;
  (b) `build/preview-2.1.3` dalına `feat/money-1c`'yi birleştir (CLAUDE.md: `build/preview-2.1.3` dalına commit atılmaz — bu yüzden (a) önerilir);
  (c) 2.1.4 gibi yeni geçici sürüm. 2.1.3 zaten TestFlight'ta (#914) olduğundan aynı sürüme yeni build numarası (915) yüklenebilir; 2.1.3 App Store'a çıkmadığı varsayılırsa (doğrulanmadı) train açıktır.
- **Runtime sonucu:** sürüm 2.1.3 → runtime 2.1.3. 2.1.3 için OTA yayımlanmadığından build, içine gömülü JS'ini (money-1c commit'i) çalıştırır; OTA gerekmez.
- Bu belgede kod/sürüm değişikliği YAPILMADI.

**Uygulandı (25 Eki 13:05):** seçenek (a), yalnız `app.json` etkisi (`version` 2.1.3, `ios.buildNumber` 915) `feat/money-1c`'e `70942b2` ile eklendi; `package.json`'daki `test:mood-claim` ve `test:mood-claim-concurrency` script'leri bu dalda zaten vardı (build/preview-2.1.3'te yoktu). `buildNumber` değeri EAS remote sayacında (`autoIncrement`) yok sayılır; tutarlılık için 915 yazıldı. Build ALINMADI.

## 4. `mood_offer` bayrağı preview build'de nasıl açılıyor

- Bayrak build'e bağlı DEĞİL; çalışma zamanı verisi: `app_config.mood_offer_enabled` (genel) **veya** oturumdaki `auth.users.id`'nin
  `app_config.mood_offer_testers` (jsonb dizi) içinde olması (`services/appConfigFlags.ts` `isMoodOfferEnabled`; kimlik oturumdan YEREL okunur, ağ yok; değerler
  `services/remoteConfig.ts` üzerinden 5 dk TTL'li tek `select key, value`). Satır yok / geçersiz / okuma hatası / önbellek yok → KAPALI.
- Canlı durum (25 Eki export'u): `mood_offer_enabled = false`, `mood_offer_testers = ["a25917c2-7476-41ea-a7fb-3ffecccf03e6"]`, ayrıca `paywall_lifetime_enabled = false`,
  `paywall_profile_upgrade = false`, `discover_tab_enabled = false`; `free_visible_count` satırı YOK (kodda varsayılan 3).
- Aynı `app_config` canlıdaki herkesin okuduğu yerdir; bu kodu içeren her build aynı listeyi görür. Yani preview build'i kendi başına yüzeyi açmaz; test hesabının
  `auth.users.id`'si listeye EKLENİR (ezilmez): komutlar `MONEY-1C_CIHAZ_TEST.md` §0.3. Genel açma (`mood_offer_enabled=true`) YAPILMAZ.
- Not (kural 6): `app_config` bu görevde değiştirilmedi; ekleme/çıkarma ayrı onaylı bir iş.

### 4.1 Mevcut tester kimliği kime ait (salt-okunur sorgu, 25 Eki)

`mood_offer_testers = ["a25917c2-7476-41ea-a7fb-3ffecccf03e6"]` → `public.users` satırı VAR (`id 0694d435-1feb-44cc-878e-c1c320b15825`):

| Alan | Değer |
|---|---|
| `auth.users` kaydı | var, **anonim** (`is_anonymous = true`, `auth_provider = anonymous`) |
| `created_at` | 2026-10-24 22:25:19 UTC (onboarding tamam 22:25:32) |
| son etkinlik | 2026-10-24 23:42:52 UTC |
| `subscription_tier` | **`lifetime`** |
| `subscriptions` | 1 satır: `plan=lifetime`, `status=active`, `entitlement_id=chosy_plus`, **`environment=SANDBOX`**, 24 Eki 23:43:14 UTC, `expires_at` boş |
| `mood_searches` | 1 satır |
| `legacy_mood_access` | false |

Yorum: dün gece bir TestFlight/sandbox oturumunda oluşturulmuş premium bir test hesabı. `lifetime_sales` tablosunda satır YOK ve `lifetime_sale_number` sayacı (4) bu hesabı saymıyor → abonelik `claim_lifetime_spot` değil, entitlement senkronu (`sync-entitlement`/webhook) yoluyla yazılmış görünüyor (kesin kök neden bu görevde araştırılmadı). Anonim hesap; yeniden kurulumda kimlik kaybolur. **Ücretsiz-hesap yüzeyleri (kilit kartı, ücretsiz arama, davet kartı) bu kimlikle görünmez.** Listeden çıkarma komutu (ÇALIŞTIRILMADI) `MONEY-1C_CIHAZ_TEST.md` §0.3'te.

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

1. Sürüm: `app.json` 2.1.3 / buildNumber 915 (`70942b2`) — YAPILDI. Çalışma ağacı temiz, dal `feat/money-1c` doğrulanır (`build/preview-2.1.3`'e commit yok).
2. `eas build:version:get -p ios -e preview-store` → 914 (sonraki 915). Başka biri arada build aldıysa numara değişir.
3. `npm run typecheck` (baseline 14), `npm run test:mood-offer` (94), `npm run test:mood-claim` (9) yeşil.
4. Sunucu tarafı (139/140/parse-mood v43) 26 Eki'de uygulanmış ve doğrulanmış olmalı; B3c maddeleri sunucu deploy edilmeden koşulmaz (`CIHAZ_TEST` B3c notu).
5. Test hesabının `auth.users.id`'si `mood_offer_testers`'a EKLENMİŞ (ezme yok); bayrak 5 dk içinde yansır.
6. Build: `eas build -p ios --profile preview-store` (onaylı), TestFlight'a otomatik gider; `--profile preview-e2e` KULLANMA.
7. Cihaz testinden ÖNCE `MONEY-1C_CIHAZ_TEST.md` Bölüm C'yi eski sürüm (2.1.2/2.1.3) varken koş; sonra yeni build'i kur.
8. Test olayları PostHog'da `$app_build ≥ 915` ile ayrılır.

## 7. 31 Eki için teslim yolu — seçenekler (KARAR VERİLMEDİ)

Çerçeve: Faz 3'ün **hak değişikliği** (`free` search 3 → 1, `subscription_limits`) yalnız sunucudadır ve bayrak/teslim yolundan bağımsız, anında TÜM istemcilere
uygulanır (FAZ3_ROLLOUT §7). Teslim yolu yalnızca **yeni arayüzün** (kilit kartı, bugünkü ücretsiz arama, `mood_offer` paywall'ı) kime ulaşacağını belirler. Yeni kodu
almamış istemci, limit 1'e inince 2. aramada eski kota duvarı + `QUOTA_EXCEEDED` görür (§5.6). Dolayısıyla asıl karar: **yeni istemci erişimi doğrulanmadan sunucu limiti düşürülmeli mi**
(FAZ3_ROLLOUT §8.2 kuralı: etkilenen grup 2.1.0/2.1.1 ≈ %84 → OTA erişimi doğrulanmadan açma).

### Seçenek A — OTA (üç runtime: 2.1.0, 2.1.1, 2.1.2)

| Konu | İçerik |
|---|---|
| Ne | Faz 3 JS'i `production` branch'ine **üç ayrı** `eas update` olarak yayımla: runtime 2.1.0, 2.1.1, 2.1.2 (politika `appVersion` → runtime = yayın anındaki `app.json` sürümü; yayın sırasında hedef runtime'a göre sürüm ayarlanır — nasıl ayarlandığı geçmiş yayınlarda belgelenmemiş, **dry-run ile doğrulanmalı**). 2.1.3 (TestFlight) bu yolun dışında: kendi gömülü JS'ini taşır. |
| Süre | Dakikalar (yayın) → kullanıcı başına ilk açılışta indirme, **ikinci soğuk açılışta uygulama**. App Review YOK. |
| Kime ulaşır | Yalnız o runtime'ın MEVCUT kurulumlarına. Uykudaki 2.1.0 grubu (12 kişi, son görülme ≤ 20 Eki) ancak uygulamayı açınca alır. |
| Ön koşullar | (1) HEAD JS'inin 2.1.0/2.1.1/2.1.2 native build'leriyle uyumu: §5.6'da bağımlılık/native değişikliği yok, ama cihazda DENENMELİ (her runtime için bir App Store/TestFlight build'i gerek; 2.1.0 build'i kaldıysa). (2) Bayrak KAPALI yayınlanır (`mood_offer_enabled=false`; yalnız tester listesi) → ilk yayında davranış değişmez. (3) Her runtime için `eas update --dry-run` / `eas update:view` ile runtime etiketi doğrulanır. (4) Yayın öncesi `eas update:list` ile her runtime'ın "önceki grubu" not edilir (geri alma hedefi). (5) Ölçüm hazır: aktif kullanıcıların son `update_id`'si = o runtime'ın en yeni grubunun update_id'si (grup→update_id eşlemesi `eas update:view <group>`). |
| Başarı ölçüsü | Son 7 günde aktif kullanıcıların ≥ %70'i en yeni `update_id`'de (FAZ3_ROLLOUT §8.2 önerisi; eşik sizin). `ota_update_found/fetched` sayısı ölçü DEĞİL (§5). |
| Riskler | Tek yayında o runtime'ın TÜM kullanıcısı aynı anda etkilenir (kademeli yayın aracı bu projede kullanılmıyor; EAS "channel rollout" yüzdesi gibi bir seçenek olabilir — **kullanılabilirliği doğrulanmadı**). 3 ayrı yayın = 3 hata fırsatı. Uyku grubu 31 Eki'ye kadar açmazsa güncellenmez. |
| Geri alma | (1) En hızlı: bayrak kapat (`mood_offer_enabled=false`, tester listesi boş) — ≤ 5 dk, istemci güncellemesi gerekmez. (2) Hatalı OTA için: önceki grubu aynı branch/runtime'a yeniden yayımla (`eas update:republish`) ya da gömülü pakete dön (`eas update:rollback`); istemciler bunu da ancak bir sonraki açılış+uygulamada alır. (3) Sunucu limiti: `subscription_limits.free` search değerini eski değere (3) döndür (ayrı onaylı veri işlemi; migration değil). |

### Seçenek B — 2.1.3 ikili (App Store sürümü)

| Konu | İçerik |
|---|---|
| Ne | `production` profiliyle (kanal `production`) 2.1.3 build'i + App Store Connect'te sürüm gönderimi. #915 `preview-store` build'i kanal `preview` taşır ve TestFlight içindir; **mağaza sürümü için ayrı bir `production` build'i** gerekir (buildNumber 916+). |
| Süre | App Review süresi **garanti edilemez** (tipik 1–3 gün, uzayabilir; reddedilirse yeniden gönderim). Ardından kullanıcıların güncellemeyi alması (otomatik güncelleme açıksa günler; kapalıysa hiç). 31 Eki hedefi için en geç ~28 Eki'de gönderilmiş olmalı; bu da 29–30 Eki cihaz testinden ÖNCE gönderim demektir (çelişki: önce test, sonra gönderim istenirse 31 Eki tutmaz). |
| Kime ulaşır | Güncelleyen kullanıcılara. Eski sürümde kalan (özellikle uykudaki 2.1.0/2.1.1) kullanıcıya **ulaşmaz**; onlar için A ya da zorunlu güncelleme gerekir. |
| Ön koşullar | (1) Sunucu 139–142 + parse-mood v43 uygulanmış ve doğrulanmış (27 Eki). (2) Cihaz testi (CIHAZ_TEST A, B, C) TestFlight #915'te geçmiş. (3) Release commit: `production` build'i, test edilen commit'ten alınmalı (aynı JS). (4) App Store Connect metadata/inceleme notları; satın alma/`mood_offer` yeni yüzeyleri için inceleme notu. (5) "Phased release" (7 gün kademeli) kullanılacaksa seçilir. |
| Başarı ölçüsü | `$app_version = 2.1.3` payı artışı (PostHog). |
| Riskler | Review gecikmesi/reddi; kademeli yayın sürüyorken sunucu limiti düşerse henüz güncellemeyen kullanıcılar eski duvarı görür. Mağazada sürümü geri çekmek mümkün değil (yeni sürüm gerekir). |
| Geri alma | İkili geri alınamaz: kademeli yayını duraklat (açıksa), düzeltme sürümü gönder (hızlandırılmış inceleme talep edilebilir). Davranış tarafı: bayrak kapat (≤ 5 dk), sunucu limitini eski değere döndür. OTA ile düzeltme, 2.1.3 için de yayımlanabilir (2.1.3 production kanalındaysa). |

### Birleşim ve sıra (seçenek değil, gözlem)
- A ve B birlikte düşünülebilir: B yeni kurulum/güncelleyenleri, A mevcut 2.1.0/2.1.1/2.1.2 kurulumlarını kapsar. Hangisiyle olursa olsun, sunucu limitini düşürmeden önce
  FAZ3_ROLLOUT §8.2 koşulu (erişim doğrulaması) ve §0 karar kapısı (31 Eki) geçerli: bayrak 1 Kasım'da OTOMATİK açılmaz.
- Üç ön koşul her iki yolda ortak: sunucu 139–142 temiz, cihaz testi geçti, ölçüm sorgusu hazır.
- Bu bölüm bilgi içindir; yol seçimi, yayın ve build onayınız olmadan yapılmaz.
