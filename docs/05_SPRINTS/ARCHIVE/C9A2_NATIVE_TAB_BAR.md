# C.9a-2 — Native Tab Bar (K-04)

**Başlangıç:** 17 Ağustos 2026
**Bağlı bible maddesi:** K-04

## Amaç
Tab bar'ı native API'ye (`expo-router/unstable-native-tabs`) taşımak. K-04:
"Tab bar native-feeling. Custom glass taklidi yok; sistemin Liquid Glass
davranışı kullanılır." Custom pill şekli, custom shadow, Reanimated bounce ve
dot indicator bilinçli olarak bırakılıyor — native API bunları expose etmiyor.

## Kapsam
- **Faz 1 — araştırma (read-only):** SDK 54'teki `unstable-native-tabs` API
  yüzeyinin envanteri; hangi custom davranışın native tarafından karşılandığı,
  hangisinin kaybedileceği. Senaryo A/B/C analizi ve CTO'ya sunumu
- **CTO kararı: Senaryo A** — tam native geçiş
- **Faz 2 — implementasyon:** `app/(tabs)/_layout.tsx` custom `Tabs` +
  `AnimatedTabIcon` yerine `NativeTabs` / `Icon` / `Label` kullanacak şekilde
  yeniden yazıldı (258 satır → 71; net −226 satır)
- `DESIGN_SYSTEM.md` — cam katmanı tablosuna tab bar istisnası notu eklendi
  (tab bar artık `GlassSurface`/`BlurView` tabanlı custom cam taklidinden çıktı)

## Kapsam DIŞI
- **Senaryo B** — ikon adapter araştırması (Phosphor ikonlarını native tab
  bar'a taşıyacak ara katman). Senaryo A seçildiği için açılmadı; ikonlar SF
  Symbols'a eşlendi
- **`discoverEnabled` flag'inin remount riski düzeltmesi** —
  `docs/TEKNIK_BORC.md`'ye tetikleyici koşuluyla kaydedildi. Flag bugün K-02
  gereği hep `false` olduğu sürece tetiklenmiyor

## DUR NOKTALARI
| # | Soru | Cevap | Tarih |
|---|---|---|---|
| 1 | Senaryo A / B / C hangisi? | **A** — tam native geçiş | 17 Ağu 2026 |
| 2 | `discoverEnabled` remount riski nasıl ele alınsın? | Kabul edildi (Seçenek 1) — `docs/TEKNIK_BORC.md`'ye tetikleyici koşuluyla kaydedildi, kod düzeltmesi yapılmadı | 17 Ağu 2026 |

## İkon Eşlemesi (Phosphor → SF Symbols)
| Tab | Önce (Phosphor) | Sonra (SF Symbol: default / selected) |
|---|---|---|
| Home | `Sparkle` | `sparkle` / `sparkles` |
| Discover (gizli) | `Compass` | `safari` / `safari.fill` |
| Profile | `User` | `person` / `person.fill` |

## Bilinen Risk (devredildi)
`discoverEnabled` flag'i `NativeTabs.Trigger`'ın `hidden` prop'una async fetch
sonrası set ediliyor. expo-router dokümantasyonu: tab'lar görünürken
gizlenmemeli — navigator remount + state kaybı riski. Flag bugün hep `false`
(K-02) olduğu için tetiklenmiyor.
⚠️ `discover_tab_enabled` `app_config`'te `true` yapılmadan önce düzeltilmeli.
Doğru çözüm: flag'i `(tabs)` layout mount olmadan **önce** (boot/gate
aşamasında) çözüp initial render'a sabit değer olarak geçirmek.
Kayıt: `docs/TEKNIK_BORC.md`.

## Doğrulama
| Komut | Beklenen | Sonuç |
|---|---|---|
| Cihaz — tab bar görünümü | Native tab bar render olmalı | ✅ Doğrulandı |

## Commit Referansları
- f8e9b36 — tab bar native API'ye (`NativeTabs`) geçirildi — Senaryo A (Faz 2)

## Durum
Tamamlandı — 18 Ağustos 2026 (kod 17 Ağu, cihaz doğrulaması 18 Ağu).
