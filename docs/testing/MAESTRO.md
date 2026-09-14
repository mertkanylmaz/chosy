# Maestro E2E — K-42 Offline Senaryoları

Kaynak fizibilite: `docs/investigations/E2E_TEST_FIZIBILITE.md`. Bu doküman
kurulan altyapının **nasıl çalıştırılacağını** anlatır.

## Kapsam

8 senaryodan **4'ü** otomatize koşuluyor, 1'i (Senaryo 7) referans
flow olarak yazıldı ama koşulmuyor (`.maestro/`):

| Dosya | Senaryo |
|---|---|
| `k42-01-cold-start-offline.yaml` | Soğuk başlangıç, tam offline, beyaz ekran kontrolü |
| `k42-02-cache-today-offline.yaml` | Online açılış → offline → `cache_today`'den oynanabilirlik |
| `k42-04-offline-selection.yaml` | Offline seçim yapma → kuyruğa yazılma (dondurma) |
| `k42-05-sync-on-reconnect.yaml` | Bağlantı geri gelince kuyruk senkronizasyonu (CANLI reconnect listener) |
| `k42-07-permanent-error.yaml` | 4xx kalıcı ret → kuyruk kaydı atılır (**koşulmuyor**, aşağıya bak) |

`k42-07` `.eas/workflows/e2e-test.yml`'ın `flow_path` listesinde **bilerek
yoktur**: Maestro Cloud ücretli ve bu senaryo CI bütçesine alınmadı. Dosya
aşağıdaki **manuel test adımlarının** makine-okunur referansıdır — yerelde
`maestro test .maestro/k42-07-permanent-error.yaml` ile elle koşulabilir.

**Kapsam dışı (manuel kalacak):** Senaryo 3 (`cache_stale`), 6 (12 saatlik
yaş sınırı), 8 (`inFlight` guard). Sistem saati manipülasyonu gerektiriyor
— adımlar için aşağıdaki "Manuel test adımları" bölümüne bak.

## Test-only override mekanizması (DUR NOKTASI onaylı)

`setAirplaneMode` iOS'ta hiçbir zaman gerçek network etkisi yaratmıyor
(Maestro'nun resmi kısıtı — simülatörde yok, gerçek cihazda etkisiz). Bunun
yerine aşağıdaki parçalardan oluşan bir test-only override kuruldu:

### 1. Tek doğruluk kaynağı: `utils/e2eTestMode.ts`

```ts
export function isE2ETestMode(): boolean {
  return process.env.EXPO_PUBLIC_APP_ENV === 'e2e-test';
}
```

Bu değişken **yalnızca `preview-e2e` build profilinde** set edilir
(`eas.json`). Production/preview/preview-store/development build'lerinde
hiç yoktur — `isE2ETestMode()` oralarda her zaman `false` döner, mevcut
davranış birebir korunur. `process.env.EXPO_PUBLIC_APP_ENV` bu fonksiyonun
DIŞINDA hiçbir yerde okunmaz.

**Güvenlik sınırı kanıtı** (her değişiklikte tekrar çalıştırılmalı):

```powershell
node -e "
const eas = JSON.parse(require('fs').readFileSync('eas.json','utf8'));
for (const name of ['production','preview','preview-store']) {
  console.log(name, '->', JSON.stringify(eas.build[name]).includes('e2e-test'));
}
"
# Üçü de false dönmeli.
```

`eas.json` → `submit.preview-e2e` **artık vardır** (aşağıdaki TestFlight
internal akışı). Güvenlik sınırı submit bloğunun yokluğuna DEĞİL, yalnızca
`EXPO_PUBLIC_APP_ENV=e2e-test`'in tek profile hapsedilmiş olmasına dayanır:
`isE2ETestMode()` tek doğruluk kaynağıdır ve her override onun altında
guard'lıdır. Yukarıdaki üç `false` bu sınırın kanıtıdır.

### 2. Deep-link tabanlı sahte ağ durumu: `services/networkStatus.ts`

`preview-e2e` build'inde gerçek NetInfo aboneliği yerine bir custom URL
scheme dinlenir:

- `chosy://e2e/set-offline` → `currentOnline = false`
- `chosy://e2e/set-online` → `currentOnline = true`

İki ayrı okuma yolu var:
- **Canlı** (`Linking.addEventListener('url', ...)`): uygulama ZATEN
  ÇALIŞIRKEN gelen link'leri yakalar (Senaryo 5'in reconnect testi bunu
  kullanır).
- **Soğuk başlangıç** (`Linking.getInitialURL()`): uygulama BİZZAT o
  link'le başlatılmışsa (Senaryo 1/2/4'ün "stopApp → openLink" adımı) —
  canlı event hiç ateşlenmez, bu yol olmadan ilk istek her zaman "online"
  varsayımıyla giderdi (yarış durumu).

`isE2ETestMode()` false olan her build'de bu modül **birebir eskisi gibi**
gerçek NetInfo'ya abone olur — yeni dal yalnızca `preview-e2e`'de çalışır.

### 3. Gerçek isteği kesme: `services/supabase.ts`

Sahte offline durumu tek başına hiçbir şeyi engellemez — `gauntletService.ts`
ağ durumunu HİÇ sormaz, yalnız gerçek `fetch`'in başarılı/başarısız
olmasına bakar. Bu yüzden Supabase client'ının `global.fetch`'i override
edildi: `isE2ETestMode()` VE sahte-offline iken TÜM supabase istekleri
(auth dahil) `TypeError: Network request failed` ile reddedilir — gerçek
bir RN network kopmasının attığı hatanın BİREBİR AYNISI, yeni bir hata tipi
YOK. Bu sayede `gauntletService.ts`'in `parseInvokeError`'ı bunu gerçek bir
kesintiden ayırt edemez, cache fallback zinciri (`cache_today` →
`cache_stale` → hata) kendi kodunda hiç dokunulmadan tetiklenir.

`isE2ETestMode()` false olan her build'de gerçek `fetch` olduğu gibi
çağrılır — davranış farkı yok.

### 4. 18:00 (`UNLOCK_HOUR`) bypass: `GauntletShell`

```ts
if (__DEV__) return true;
if (isE2ETestMode()) return true;
return new Date().getHours() >= UNLOCK_HOUR;
```

Yalnız `preview-e2e`'de saat kapısı atlanır — Maestro flow'ları günün her
saatinde koşabilir. Diğer tüm build'lerde (production dahil) bu dal ölü
koddur.

### 5. Sahte kalıcı sunucu hatası: `force-4xx` (Senaryo 7)

Sahte-offline bir **transport** hatası taklit eder (`status: null` →
`GauntletFetchError` → kayıt kuyrukta KALIR). Senaryo 7 bunun tersini
ister: sunucuya ULAŞILDI ve **kalıcı** bir hata döndü → kayıt ATILIR.
İkinci mod bunun içindir.

- `chosy://e2e/force-4xx` → sonraki Edge Function istekleri **400** döner
- `chosy://e2e/clear-error` → kapatır, gerçek `fetch`'e dönülür

**Neden 400** (tahmin değil, koddan okundu): `gauntletOfflineQueue.ts:224`
yalnız `GauntletHttpError && status >= 500`'ü geçici sayar; bunun dışındaki
her `GauntletHttpError` kalıcıdır → `{ status: 'dropped', reason:
'rejected' }`. `401` KULLANILAMAZ — `gauntletService.ts:369` onu
`GauntletAuthPendingError`'a saptırır (bootstrap penceresi, kayıt korunur).
`400` kuyruk kodunun kendi yorumunda kalıcı örnek olarak sayılıyor
("400 geçersiz gövde").

**Neden yalnız `/functions/v1/`** (sahte-offline'dan farklı olarak TÜM
istekler değil): auth token yenilemesine 400 dönmek supabase-js'in yerel
oturumu düşürmesine yol açabilirdi; test o zaman ölçmek istediğinden
(submit-choice'ın kalıcı reddi) başka bir yolu ölçerdi. Auth trafiği
gerçek `fetch`'e gider.

`gauntletService.ts`'e DOKUNULMADI — hata sınıflandırma mantığı aynı,
yalnız girdisi değişiyor. Yanıt gerçek bir `Response` nesnesidir, yani
supabase-js onu normal yoldan `FunctionsHttpError` (`context` dolu) olarak
üretir; `parseInvokeError` gerçek bir sunucu 400'ünden ayırt edemez.

`isE2ETestMode()` false olan her build'de bu dal hiç değerlendirilmez —
deep-link aboneliği bile kurulmaz (`networkStatus.ts` → `ensureSubscription`).

## ⚠️ Bilinen kırılganlık — soğuk başlangıç penceresi

`k42-01/02/04/05` flow'larının hepsi şu sırayı izliyor: `launchApp
clearState:true` (bir an gerçek online varsayımıyla açılır) → `stopApp`
(hemen kapat) → `openLink chosy://e2e/set-offline` (offline bilgisiyle
soğuk yeniden başlatma). `stopApp`'a kadar geçen pencerede TEORİK olarak
bir `generate-gauntlet` isteği tamamlanıp cache yazabilir —
GauntletShell'in kendi 401 bootstrap penceresi (taze anonim oturumda
`public.users` satırı henüz hazır olmayabilir) bunu pratikte olası
kılmıyor ama DETERMİNİSTİK DEĞİL. Bu flow'lar flaky çıkarsa önce bunu
düşünün; kalıcı çözüm GauntletShell'in mount-time fetch'ini de
`resolveIsOnline()`'ın ilk-link kontrolüne bağlamak olurdu — bu, onaylanan
kapsamın (networkStatus.ts + supabase.ts + GauntletShell'in yalnız
UNLOCK_HOUR satırı) DIŞINA çıkar, ayrı bir DUR NOKTASI gerektirir.

## Yerel çalıştırma

```powershell
npm run e2e:install    # Maestro CLI kurar (curl | bash — Windows'ta Git
                        # Bash veya WSL2 gerekir, native PowerShell'de
                        # curl|bash çalışmaz; Java 17+ ön koşuldur)
maestro --version

npm run e2e:test        # .maestro/ altındaki TÜM flow'ları bağlı iOS
                        # simülatör/cihaza koşar (preview-e2e build'i)

maestro test .maestro/k42-01-cold-start-offline.yaml   # tek flow
```

## EAS Workflows ile çalıştırma

`.eas/workflows/e2e-test.yml` **otomatik tetikleyicisi yok** — bilinçli
olarak yalnız elle tetiklenir:

```powershell
eas workflow:run .eas/workflows/e2e-test.yml
# veya
npm run e2e:workflow
```

Bu workflow `eas.json`'daki `preview-e2e` profiliyle (preview-store'dan
extends, `EXPO_PUBLIC_APP_ENV=e2e-test`) bir iOS build alır, sonra
`flow_path` listesindeki 4 flow'u sırayla koşar. `k42-07` bu listede
değildir (Maestro Cloud ücretli).

## TestFlight internal dağıtım (`submit.preview-e2e`)

`preview-e2e` build'i artık TestFlight'a gönderilebilir:

```powershell
eas build --profile preview-e2e --platform ios
eas submit --profile preview-e2e --platform ios
```

**Internal-only.** Build App Store Connect'teki ekip üyelerine düşer;
Apple Beta App Review'dan muaftır ve external test grubuna **eklenmez**.
Bu build App Store'a **release olarak asla gönderilmez** — güvenlik sınırı
submit bloğunun yokluğu değil, `EXPO_PUBLIC_APP_ENV=e2e-test`'in yalnız bu
profilde set edilmiş olmasıdır (yukarıdaki kanıt komutu).

### ⚠️ Build numarası bandı: 900+

`preview-e2e` profilinde `"autoIncrement": false`'tur ve build numarası
**CTO tarafından elle, 900+ bandından** set edilir.

- **Amaç:** App Store Connect'te e2e build'leri release build'lerden tek
  bakışta ayırmak.
- **Neden `app.json` değil:** `cli.appVersionSource` = `remote`, yani build
  numarası uzak sunucudan yönetilir; `app.json`'daki `ios.buildNumber`
  dikkate alınmaz. Bant ayrımı bu yüzden build anında elle verilir.
- Release profilleri (`production`) kendi `autoIncrement: true` bandında
  kalır; 900+ bandına hiç girmez.

```powershell
# e2e build'i alırken numara elle sorulur (autoIncrement kapalı) — 900+ ver:
eas build --profile preview-e2e --platform ios
```

## Manuel test adımları

Otomatize edilmeyen senaryolar. Hepsi `preview-e2e` build'i gerektirir.

### Senaryo 7 — 4xx kalıcı ret (`k42-07-permanent-error.yaml` referansı)

1. Uygulamayı temiz aç, gauntlet ekranını gör (cache dolsun).
2. Uygulamayı kapat, `chosy://e2e/set-offline` ile soğuk aç.
3. Bir postere dokun → "Your pick is waiting..." görünmeli (kuyrukta).
4. `chosy://e2e/force-4xx` aç (uygulama ÇALIŞIRKEN — canlı link).
5. `chosy://e2e/set-online` aç → reconnect flush tetiklenir.
6. **Beklenen:** submitChoice 400 alır → `GauntletHttpError(400)` →
   kuyruk kaydı ATILIR, "Your pick is waiting..." kaybolur ve tur
   İLERLEMEZ (seçim sunucuya yazılmadı). Sentry'de
   `GAUNTLET_QUEUE_REJECTED` görünmeli.
7. `chosy://e2e/clear-error` ile modu kapat.

### Senaryo 3 — `cache_stale` (cihaz saati)

1. Online aç, gauntlet'i gör (cache_today yazılır).
2. Uygulamayı kapat. Ayarlar → Genel → Tarih ve Saat → otomatiği kapat,
   tarihi **1 gün ileri** al.
3. `chosy://e2e/set-offline` ile soğuk aç.
4. **Beklenen:** dünün kopyası `cache_stale` kaynağıyla gösterilir
   (beyaz ekran veya hata YOK).
5. Saati otomatiğe geri al.

### Senaryo 6 — 12 saatlik kuyruk yaş sınırı (cihaz saati)

1. Senaryo 4'ü uygula (offline seçim → kuyrukta bekliyor).
2. Uygulamayı kapat, cihaz saatini **13 saat ileri** al.
3. `chosy://e2e/set-online` ile aç → flush tetiklenir.
4. **Beklenen:** `MAX_AGE_MS` (12 saat) aşıldığı için kayıt gönderilmeden
   atılır (`dropped/expired`), Sentry'de `GAUNTLET_QUEUE_EXPIRED`.
5. Saati otomatiğe geri al.

## Neden testID yok, ekran yüzdesi kullanılıyor

Proje genelinde `testID` kullanılmıyor. Poster dokunuşları bu yüzden
`tapOn: point: "25%, 55%"` gibi ekran yüzdesiyle hedefleniyor — film
başlıkları günlük değiştiği için sabit metinle hedeflenemez. Metin
tabanlı seçiciler (`assertVisible: "Which one tonight?"` vb.)
`locales/en.json`'daki sabit `t()` string'lerine karşılık geliyor; dil
değişikliği bu flow'ları kırar — şimdilik yalnız EN locale hedefleniyor.
