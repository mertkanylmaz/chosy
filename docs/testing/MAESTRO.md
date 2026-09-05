# Maestro E2E — K-42 Offline Senaryoları

Kaynak fizibilite: `docs/investigations/E2E_TEST_FIZIBILITE.md`. Bu doküman
kurulan altyapının **nasıl çalıştırılacağını** anlatır.

## Kapsam

8 senaryodan **4'ü** otomatize edildi (`.maestro/`):

| Dosya | Senaryo |
|---|---|
| `k42-01-cold-start-offline.yaml` | Soğuk başlangıç, tam offline, beyaz ekran kontrolü |
| `k42-02-cache-today-offline.yaml` | Online açılış → offline → `cache_today`'den oynanabilirlik |
| `k42-04-offline-selection.yaml` | Offline seçim yapma → kuyruğa yazılma (dondurma) |
| `k42-05-sync-on-reconnect.yaml` | Bağlantı geri gelince kuyruk senkronizasyonu (CANLI reconnect listener) |

**Kapsam dışı (manuel kalacak):** Senaryo 3 (`cache_stale`), 6 (12 saatlik
yaş sınırı), 7 (4xx kalıcı ret), 8 (`inFlight` guard). Sistem saati
manipülasyonu veya sunucu hatası enjeksiyonu gerektiriyor.

## Test-only override mekanizması (DUR NOKTASI onaylı)

`setAirplaneMode` iOS'ta hiçbir zaman gerçek network etkisi yaratmıyor
(Maestro'nun resmi kısıtı — simülatörde yok, gerçek cihazda etkisiz). Bunun
yerine 3 parçalı bir test-only override kuruldu:

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
# Üçü de false dönmeli. eas.json submit bloğunda 'preview-e2e' YOKTUR —
# bu profil App Store'a asla gönderilemez.
```

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
extends, `EXPO_PUBLIC_APP_ENV=e2e-test`) bir iOS build alır, sonra 4
flow'u sırayla koşar.

## Neden testID yok, ekran yüzdesi kullanılıyor

Proje genelinde `testID` kullanılmıyor. Poster dokunuşları bu yüzden
`tapOn: point: "25%, 55%"` gibi ekran yüzdesiyle hedefleniyor — film
başlıkları günlük değiştiği için sabit metinle hedeflenemez. Metin
tabanlı seçiciler (`assertVisible: "Which one tonight?"` vb.)
`locales/en.json`'daki sabit `t()` string'lerine karşılık geliyor; dil
değişikliği bu flow'ları kırar — şimdilik yalnız EN locale hedefleniyor.
