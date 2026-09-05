# Maestro E2E — K-42 Offline Senaryoları

Kaynak fizibilite: `docs/investigations/E2E_TEST_FIZIBILITE.md`. Bu doküman
kurulan altyapının **nasıl çalıştırılacağını** anlatır; mimari kararların
gerekçesi için fizibilite raporuna bakın.

## Kapsam

8 senaryodan **4'ü** otomatize edildi (`.maestro/`):

| Dosya | Senaryo |
|---|---|
| `k42-01-cold-start-offline.yaml` | Soğuk başlangıç, tam offline, beyaz ekran kontrolü |
| `k42-02-cache-today-offline.yaml` | Online açılış → offline → `cache_today`'den oynanabilirlik |
| `k42-04-offline-selection.yaml` | Offline seçim yapma → kuyruğa yazılma (dondurma) |
| `k42-05-sync-on-reconnect.yaml` | Bağlantı geri gelince kuyruk senkronizasyonu |

**Kapsam dışı (manuel kalacak):** Senaryo 3 (`cache_stale`, 12+ saat eski
kayıt), Senaryo 6 (12 saatlik yaş sınırı aşımı), Senaryo 7 (4xx kalıcı ret),
Senaryo 8 (`inFlight` guard, eşzamanlı flush çakışması). Bu 4'ü sistem saati
manipülasyonu veya sunucu hatası enjeksiyonu gerektiriyor — Maestro'nun UI
katmanından tek başına simüle edemeyeceği durumlar.

## ⚠️ İki kritik ön koşul

### 1. Cihaz saati 18:00 sonrası olmalı

`GauntletShell` release build'de (`__DEV__ === false`) gauntlet'i yalnız
18:00'den (`UNLOCK_HOUR`, `components/gauntlet/GauntletShell/index.tsx:84`)
sonra çağırır. Maestro build'leri (`e2e-test` profili, `preview`'dan extends)
release-mode JS bundle çalıştırdığı için bu kapı gerçek saate bakar. 18:00
öncesi çalıştırılan flow'lar "before_18" metnini görür, offline yolunu hiç
test etmeden yeşil döner — **sonuç yorumlanamaz** (K-42'nin TestFlight cihaz
doğrulamasında yaşanan aynı kör nokta, bkz. `TEKNIK_BORC.md` E-11).

Bu bilinçli olarak kod veya `app_config` ile bypass **edilmedi** — gate'e
bir test-override eklemek yeni bir davranış dalı (mimari değişiklik) olur ve
CLAUDE.md'nin "yeni pattern → DUR ve sor" sınırına girer. Flow'ları 18:00
sonrası çalıştırın (yerel veya CI runner'ının saat dilimi neyse ona göre).

### 2. Yalnızca Android

`setAirplaneMode` **Android dışında etkisizdir**: iOS simülatöründe uçak
modu diye bir kavram yok, gerçek iOS cihazda da komut hatasız geçer ama ağı
kapatmaz (Maestro'nun resmi kısıtı). Bu 4 flow'un tamamı ağ kapatmaya
dayandığı için **iOS'ta bu senaryolar hâlâ manuel test gerektiriyor** — R-D
öncesi TestFlight cihaz doğrulamasının parçası olarak kalmaya devam eder.

## Yerel çalıştırma

```powershell
npm run e2e:install    # Maestro CLI kurar (curl | bash — Windows'ta Git
                        # Bash veya WSL2 gerekir, native PowerShell'de
                        # curl|bash çalışmaz; Java 17+ ön koşuldur)
maestro --version       # kurulum doğrulama

npm run e2e:test        # .maestro/ altındaki TÜM flow'ları bağlı Android
                        # emulator/cihaza koşar (18:00 sonrası!)

maestro test .maestro/k42-01-cold-start-offline.yaml   # tek flow
```

Yerel koşum, geliştirme makinesinde bağlı bir Android emulator/cihaz ve
üzerinde kurulu bir build (`npm run build:preview` veya `e2e-test` profiliyle
alınmış bir `.apk`) gerektirir.

## EAS Workflows ile çalıştırma

`.eas/workflows/e2e-test.yml` **otomatik tetikleyicisi yok** (her push'ta
koşmaz) — bilinçli olarak yalnız elle tetiklenir:

```powershell
eas workflow:run .eas/workflows/e2e-test.yml
# veya
npm run e2e:workflow
```

Bu workflow `eas.json`'daki `e2e-test` build profiliyle (preview'dan extends,
`android.buildType: apk`) bir Android build alır, sonra 4 flow'u o build
üzerinde sırayla koşar. Otomatik push tetikleyicisi eklenmedi — CTO ilk
koşumu manuel değerlendirdikten sonra `on:` bloğu (`pull_request` veya
`workflow_dispatch`) ayrı bir onayla eklenebilir.

## Neden testID yok, ekran yüzdesi kullanılıyor

Proje genelinde `testID` kullanılmıyor (taranan `components/gauntlet/`
içinde sıfır). Poster dokunuşları bu yüzden `tapOn: point: "25%, 55%"` gibi
ekran yüzdesiyle hedefleniyor — film başlıkları günlük değiştiği için sabit
metinle hedeflenemez, `PosterTile`'ın tek erişilebilirlik bilgisi de
(`accessibilityLabel`) film başlığını içeriyor. Metin tabanlı seçiciler
(`assertVisible: "Which one tonight?"` vb.) `locales/en.json`'daki sabit
`t()` string'lerine karşılık geliyor; dil değişikliği bu flow'ları kırar —
şimdilik yalnız EN locale hedefleniyor.
