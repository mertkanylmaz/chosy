# E2E Test Altyapısı Fizibilite Raporu

**Mod:** Salt okunur keşif. Hiçbir bağımlılık kurulmadı, hiçbir dosya/kod değiştirilmedi.
**Tarih:** 5 Eylül 2026.
**Bağlam:** K-42 (offline senaryolar) ve K-49 (RevenueCat sandbox state'leri) cihaz
testini otomatikleştirme ihtiyacı.

---

## 1. Proje tipi tespiti

- **Managed workflow, native klasör commit edilmemiş.** `git ls-files android/`
  boş döndü ve `.gitignore`'da `ios/`|`android/` girdisi yok — yani `android/`
  klasörü repoda **yok**, sadece bu makinede yerel bir `expo prebuild`/`expo
  run:android` kalıntısı olarak duruyor (untracked). `ios/` klasörü hiç yok.
- `app.json` içinde native modüller (`expo-apple-authentication`,
  `expo-notifications`, `@sentry/react-native/expo`, `netinfo` — bağımlılık
  olarak var ama config plugin listesinde değil) **config plugin** üzerinden
  entegre — bu, managed/CNG (Continuous Native Generation) akışının tipik
  imzası.
- `eas.json`'da `development`, `development:device`, `preview`,
  `preview-store`, `production` profilleri var; hiçbiri `"buildType":
  "development"` dışında yerel Xcode/Gradle build'i varsaymıyor — tüm build'ler
  EAS Build bulut sunucularında koşuyor.
- **Sonuç:** Bu proje native klasörleri repoya sokmadan EAS Build ile CNG
  akışını kullanıyor. Detox kurulumu **yerel Xcode build'i ile değil**, EAS
  Build çıktısı (`.app`/`.apk`) üzerinden kurulmalı.

## 2. Detox fizibilitesi

**Kaynak:** [Detox Environment Setup](https://wix.github.io/Detox/docs/introduction/environment-setup/), [Expo — Running E2E tests on EAS Build](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)

- Detox'un **resmi Expo desteği yok**: "There is no special support for Expo
  projects in Detox, and we do not maintain any Expo-specific code." Expo
  entegrasyonu topluluk kaynaklı.
- Resmi önerilen yol: Detox'u Expo managed flow'a değil, **EAS Build
  çıktısına** bağlamak — `.detoxrc.json` içinde binary path'i EAS build
  artifact'ine işaret eder, build komutu `eas build --profile detox-test
  --local --clear-cache` gibi bir profil çağırır.
- **Versiyon uyumu:** Detox resmi olarak React Native **0.77.x–0.84.x**
  aralığını destekliyor. Projenin RN sürümü **0.81.5** — aralık içinde,
  uyumlu.
- **Kritik blocker — macOS zorunluluğu:** iOS simülatör testi için
  `applesimutils` gerekiyor ve bu **yalnızca macOS'ta** (Homebrew üzerinden)
  kurulabiliyor. EAS Build bulutta derlese bile, Detox'un simülatörü
  sürüp test koşturması **yerel bir Mac** gerektiriyor. Şu an ortam Windows —
  bu, Detox'un iOS tarafını devre dışı bırakan ya da bir Mac/cloud-Mac
  runner (GitHub Actions macOS runner, MacStadium vb.) gerektiren bir
  kısıt.
- Android tarafında native olmayan (yani salt JS) RN app'ler için Detox
  "şu an desteklenmiyor" notu var, ama bu proje native RN app olduğu için
  bu kısıt bizi etkilemiyor.

## 3. Maestro fizibilitesi

**Kaynak:** [Expo — Run E2E tests on EAS Workflows with Maestro](https://docs.expo.dev/eas/workflows/examples/e2e-tests/), [Expo Blog — Maestro Cloud in CI workflow](https://expo.dev/blog/expo-now-supports-maestro-cloud-testing-in-your-ci-workflow), [Maestro Docs — React Native](https://docs.maestro.dev/get-started/supported-platform/react-native)

- Expo'nun **resmi ve güncel önerisi** bu: EAS Workflows içine gömülü
  `maestro` job tipi ile hem build hem test aynı YAML pipeline'ında
  (`.eas/workflows/*.yml`) çalışıyor. Kurulum sadece proje kökünde bir
  `.maestro/` klasörü + YAML flow dosyaları gerektiriyor — **native
  klasör, macOS runner veya Homebrew bağımlılığı yok.**
  - Detay: iOS profili `"simulator": true` ile `.app`, Android
    `"buildType": "apk"` ile `.apk` üretiyor; ikisi de EAS sunucularında
    derlenip test job'ına aktarılıyor.
- **Maestro Cloud** entegrasyonu da mevcut ve CI workflow'una gömülebiliyor
  — bulutta emulator/simulator koşturuyor, yerel/gerçek cihaz zorunlu değil.
- Native modül gerektirmiyor (Detox'un aksine kaynağa instrumentation
  enjekte etmiyor, UI hiyerarşisi üzerinden çalışıyor) — bu da mevcut
  managed/CNG kurulumla sürtünmesiz uyum demek.
- **Sonuç:** Bu proje için kurulum yükü Detox'a kıyasla belirgin şekilde
  daha düşük: macOS/Homebrew bağımlılığı yok, EAS zaten kullanılan bulut
  altyapısı, resmi Expo dokümantasyonu doğrudan bu projenin akışına
  (managed + EAS Build) yazılmış durumda.

## 4. StoreKit Configuration file fizibilitesi (K-49 için)

**Kaynak:** [RevenueCat Community — Local StoreKit testing](https://community.revenuecat.com/sdks-51/local-storekit-testing-can-purchase-but-everything-else-fails-3376), [RevenueCat Docs — Sandbox Testing](https://www.revenuecat.com/docs/test-and-launch/sandbox), [RevenueCat Docs — Apple App Store Sandbox](https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store), [Apple WWDC22 — What's new in StoreKit testing](https://developer.apple.com/videos/play/wwdc2022/10039/)

- **Kritik ön koşul:** "Only apps that are built and run directly by
  Xcode can use StoreKit configuration files." EAS Build çıktısı bir
  `.app`/`.ipa` dosyasıdır, Xcode'un doğrudan derleyip çalıştırdığı bir
  hedef değildir — yani **StoreKit Config dosyası EAS Build üzerinden
  otomatize edilemez**, yalnızca bir Mac'te Xcode scheme'ine bağlanıp
  doğrudan simülatörde/cihazda çalıştırılan build'lerde işler. Bu da
  Detox'taki macOS gereksinimiyle aynı temel kısıtı taşıyor, üstelik
  daha da katı: CI'da otomatikleştirilebilir bir yol resmi olarak
  belgelenmemiş.
- **StoreKit Config'in simüle edebildiği durumlar** (Xcode → Debug →
  StoreKit → Manage Transactions üzerinden):
  - ✅ Renewal/expiration hızlandırma (test amaçlı kısa periyot)
  - ✅ Billing Grace Period ve Billing Retry ("Fail Next Renewal" ile
    tetiklenir, Transaction Manager'da lifecycle: Purchased → Grace
    Period → Billing Retry → Expired izlenebilir)
  - ⚠️ Refund/revocation — Transaction Manager arayüzü transaction'ları
    görüntüleyip manipüle etmeye izin veriyor ama resmi dokümantasyonda
    refund/revoke akışının davranışı ayrıntılı belgelenmemiş; RevenueCat
    tarafı ayrıca şunu belirtiyor: **cancellation ve refund event'leri
    receipt'e yazılmıyor ve RevenueCat dashboard'da görünmüyor** — SDK
    yalnızca "aktif abonelik kalmadığını" algılayıp entitlement'ı restart'ta
    kaldırıyor. Yani StoreKit Config ile refund/revoked state'i **App
    tarafında** simüle edilebilir ama RevenueCat webhook/dashboard
    tarafında **doğrulanamaz**.
- **Gerçek Apple sandbox'ın simüle EDEMEDİĞİ durum:** Grace period —
  "There is no grace period in sandbox." Yani K-49'daki 6 state'ten
  grace period **yalnızca StoreKit Config ile test edilebilir**, gerçek
  sandbox hesabıyla test edilemez.
- **Gerçek Apple sandbox'ın simüle EDEBİLDİĞİ ama StoreKit Config'in
  eksik bıraktığı durum:** Restore — RevenueCat dashboard'a müşteri
  silinse bile Apple tarafında satın alma geçmişi kalıyor, restore bunu
  yeniden senkronize ediyor; bu davranış sunucu tarafı (App Store
  receipt validation) gerektirdiği için StoreKit Config'te (yerel,
  sahte transaction store) tam karşılığı yok. Ayrıca **webhook/server-
  to-server notification testleri** StoreKit Config'te çalışmıyor —
  "Nothing comes from Apple's servers if you're testing on a storekit
  config file."

### K-49'un 6 state'i için özet tablo

| State | StoreKit Config (Xcode) | Gerçek Apple Sandbox |
|---|---|---|
| Restore | Kısmi (lokal transaction store, server round-trip yok) | ✅ Tam (gerçek receipt validation) |
| Expiration | ✅ | ✅ (hızlandırılmış: 1 ay→5dk) |
| Grace Period | ✅ (tek yol — sandbox'ta yok) | ❌ Sandbox'ta mevcut değil |
| Billing Issue / Retry | ✅ | ⚠️ Sınırlı, topluluk raporlarında tutarsız |
| Refund | ⚠️ App'te simüle edilir, RevenueCat'e yansımaz | ✅ Ama receipt/dashboard gecikmeli |
| Revoked | ⚠️ Aynı kısıt — dashboard'a yansımıyor | ✅ |

## 5. Tahmini kurulum maliyeti

| Yaklaşım | Tahmini ilk kurulum | Yeni CLAUDE.md/convention kuralı | Not |
|---|---|---|---|
| **Detox** | 12–20 saat | 3–4 (macOS runner zorunluluğu, `.detoxrc.json` EAS profili, Homebrew/applesimutils bakımı, RN sürüm uyumu takibi) | macOS/Mac erişimi yoksa **uygulanamaz** — bu proje Windows üzerinde geliştiriliyor |
| **Maestro (EAS Workflows)** | 4–8 saat | 1–2 (`.maestro/` flow konvansiyonu, workflow YAML dosyası) | Mevcut EAS altyapısıyla doğrudan uyumlu, macOS gerektirmiyor |
| **StoreKit Config** | 3–6 saat (bir kez, Mac üzerinde) + CI'a bağlanamaz | 2 (hangi state'lerin StoreKit Config'te test edileceği, hangilerinin gerçek sandbox'ta doğrulanacağı ayrımı) | **Otomasyona sokulamaz** — yalnızca elle, Xcode'dan, bir Mac'te çalıştırılabilir |
| **Gerçek Apple Sandbox (mevcut süreç)** | 0 (zaten kullanılıyor) | 0 | Grace period test edilemiyor, webhook/dashboard gecikmeleri var |

---

## CTO'ya Tavsiye

**Maestro > Detox.** Bu proje EAS Build'e dayanan saf managed/CNG bir Expo
projesi; Detox'un hem resmi desteksizliği hem de iOS simülatör testi için
zorunlu macOS/Homebrew (`applesimutils`) bağımlılığı, geliştirme ortamı
Windows olan bu proje için ciddi bir sürtünme ve büyük olasılıkla bir Mac
runner (GitHub Actions macOS ya da MacStadium gibi ücretli bir hizmet)
kiralamayı gerektiriyor. Maestro ise doğrudan EAS Workflows içine gömülü,
native klasör ya da macOS gerektirmiyor ve zaten kullanılan EAS altyapısıyla
sürtünmesiz — K-42'nin offline senaryoları için önerilen yol budur.

**StoreKit Config, gerçek sandbox'ın yerine değil, tamamlayıcısı olarak
kullanılmalı — ve otomatikleştirilemez.** K-49'daki 6 state'ten yalnızca
**grace period** StoreKit Config'te test edilebiliyor (gerçek sandbox'ta hiç
yok), ama bu sadece Xcode'dan elle çalıştırılan bir build'de mümkün — CI'a
sokulamaz, dolayısıyla Detox/Maestro pipeline'ının bir parçası olamaz.
Refund/revoked state'leri StoreKit Config'te app tarafında tetiklenebilir
fakat RevenueCat dashboard/webhook'una yansımadığı için K-49'un asıl amacı
olan "RevenueCat sandbox state'lerinin doğrulanması" için **gerçek sandbox
hesabı zorunlu** kalıyor. Öneri: restore/expiration/billing-issue/refund/
revoked için gerçek sandbox sürecine devam edilsin, grace period için
tek seferlik (otomasyonsuz) bir StoreKit Config oturumu yeterli.

**Açık soru — CTO onayı gerekir:** Bu ekipte/CI'da bir Mac (fiziksel veya
GitHub Actions macOS runner/cloud) mevcut mu? Maestro EAS Workflows'ta
macOS gerekmese de, StoreKit Config'in tek seferlik manuel testi için
en az bir Mac'e erişim şart. Bu yoksa StoreKit Config seçeneği tamamen
elenir ve K-49 tamamen gerçek sandbox sürecine bağlı kalır.

**Kapsam dışı hatırlatma:** Bu rapor hiçbir kurulum/bağımlılık eklemedi.
Maestro'ya geçiş kararı onaylanırsa bir sonraki adım ayrı bir task olarak
`.maestro/` flow'larının ve `.eas/workflows/*.yml` pipeline'ının
oluşturulmasıdır — CLAUDE.md'ye "yeni bağımlılık" onay süreci gereğince.
