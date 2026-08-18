# C.9a — Nav Yeniden Yapılandırma (3 tab → 2 tab)

**Başlangıç:** 17 Ağustos 2026
**Bağlı bible maddesi:** K-01, K-02

## Amaç
Tab bar'ı 3 tab'dan 2 tab'a (Home + Profile) indirmek: Discover nav'dan
kalkar, `app_config` flag'i ile dondurulur (K-02) — kodu silinmez. `/mood`
route'u dosya olarak var olmaya devam ettiği için deep link / `router.push`
ile hâlâ ekrana düşebiliyordu; buna redirect guard eklendi.

## Kapsam
- `discover_tab_enabled` `app_config` flag'i — migration **091**
  (`supabase/migrations/091_discover_tab_flag.sql`), `supabase db push` ile
  deploy edildi, canlı değer `false` doğrulandı
- `services/appConfigFlags.ts` — flag'in lazy getter'ı (`gameApi.ts` deseni;
  modül seviyesi cache yok, kural 6). Fail-closed: okuma bitene kadar **ve**
  hata durumunda tab gizli kalır
- `app/(tabs)/_layout.tsx` — Discover tab gizleme: `mood.tsx`'in `href`'i
  flag'e göre koşullu `null` (`watchlist.tsx`'teki statik `href: null`
  deseninin flag'e bağlı hali)
- `app/(tabs)/mood.tsx` — dead route guard: `dev-gauntlet.tsx`'teki mevcut
  `<Redirect>` deseni izlenerek erken dönüş. Flag **kesin** `false` döndüğünde
  Home'a (`/(tabs)`) yönlendirir; `null` (henüz çözülmedi) durumunda içerik
  gösterilmeye devam eder

## Kapsam DIŞI
- **K-04 native tab bar** — ayrı sprinte ayrıldı, C.9a-2 olarak yürütüldü
  (bkz. `C9A2_NATIVE_TAB_BAR.md`)
- **`/discover` stack screen'e dokunmak** — C.9b'ye kadar canlı kalmalı, mood
  search akışı hâlâ oradan geçiyor
- Profile / Watchlist restructure (C.9c · C.9d)
- `mood.tsx` içeriği: `TrendingSection` · `UpcomingSection` · `GamesSection` ·
  `DailyPickSection` dokunulmadı — kod donuyor, silinmiyor (K-02)
- `remoteConfig.ts` kural 6 ihlalinin düzeltilmesi — `docs/TEKNIK_BORC.md`'ye
  kaydedildi (commit 17dc82e)

## DUR NOKTALARI
| # | Soru | Cevap | Tarih |
|---|---|---|---|
| 1 | K-04 (native tab bar) aynı sprintte mi kalsın? | Hayır — C.9a-2'ye ayrıldı | 17 Ağu 2026 |
| 2 | `/discover` stack screen'e de redirect eklensin mi? | Hayır — mood search akışını kırar, C.9b'ye bırakıldı | 17 Ağu 2026 |
| 3 | `remoteConfig.ts` kural 6 ihlali şimdi mi düzeltilsin? | Hayır — `docs/TEKNIK_BORC.md`'ye kaydedildi (commit 17dc82e) | 17 Ağu 2026 |

## Doğrulama
| Komut | Beklenen | Sonuç |
|---|---|---|
| `supabase db push` | Migration 091 deploy olmalı | Deploy edildi, canlı değer `false` doğrulandı |
| Cihaz — tab bar | 2 tab görünmeli (Home + Profile) | ✅ Doğrulandı |
| Cihaz — `/mood` | Home'a yönlenmeli | ✅ Doğrulandı |
| Cihaz — mood search → `/discover` swipe | Regresyon olmamalı | ✅ Regresyon yok |

## Commit Referansları
- 17dc82e — `remoteConfig.ts` kural 6 ihlali `TEKNIK_BORC.md`'ye kaydedildi
- 8665a1a — `discover_tab_enabled` `app_config` flag'i (migration 091)
- 575e3b9 — Discover tab gizlendi, `mood.tsx` kodu donduruldu
- 996cdf1 — `/mood` dead route Home'a yönlendiriliyor

## Durum
Tamamlandı — 18 Ağustos 2026 (kod 17 Ağu, cihaz doğrulaması 18 Ağu).
