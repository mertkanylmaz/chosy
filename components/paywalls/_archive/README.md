# Arşivlenmiş paywall varyantları

Bu klasördeki bileşenler **silinmedi, dondurulmadı — arşivlendi.** Ölü varyant
temizliği turu, 26 Eylül 2026 (bible v1.22, §9 "Ölü paywall varyantları").

`tsconfig.json` `exclude` listesinde olduğu için typecheck kapsamı dışındadır;
hiçbir yerden import edilmedikleri için bundle'a da girmezler.

| Bileşen | Neden arşivlendi |
|---|---|
| `PaywallWatchlistFull` | Tetikleyicisi (`watchlist_full`, `custom_list_attempt`) hiçbir yerden gönderilmiyordu. Flag'i de yoktu — tek kilidi emitter yokluğuydu. |
| `PaywallRouletteLimit` | Üç kat kapalı (`games_enabled.roulette=false`, `paywall_roulette_limit=false`, CTA state'i). Roulette Product OS §436'ya göre **kaldırılacak**, açılmayacak. |
| `PaywallStreakMilestone` | `streak_milestone` hiç gönderilmiyordu; tek dolaylı yol `game_perfect_streak` ve onun çağıranları dondurulmuş 4 oyun. Flag `false`. |

## Geri getirme (her biri için)

1. Klasörü `components/paywalls/` altına taşı (`git mv`).
2. `@/components/paywalls/PaywallBase` import'u konumdan bağımsızdır, dokunma.
3. `services/conversion/types.ts` → `PaywallVariantName`'e adı geri ekle
   (`watchlist_full` için ayrıca `TriggerType` + `TriggerEvent` girdileri).
4. `services/conversion/triggerOrchestrator.ts` → `triggerToVariant`'ta
   `null` dönüşünü kaldır, varyant adını döndür. Flag gerekiyorsa
   `VARIANT_CONFIG_KEYS`'e + `services/remoteConfig.ts` `SAFE_DEFAULTS`'a
   anahtarı geri ekle (`app_config` satırları DB'de **duruyor**).
5. `components/paywalls/ContextualPaywall.tsx` → import + `case` geri ekle.
6. `roulette_limit` için: `IMMEDIATE_TRIGGERS` üyeliği de geri gelmeli.
7. `streak_milestone` için: A/B deneyi `paywall_streak_v1` (`abTesting.ts`) ve
   `triggerToExperiment` eşlemesi silinmişti, gerekiyorsa geri ekle.

i18n anahtarları (`contextPaywall.watchlist*` · `contextPaywall.roulette*` ·
`contextPaywall.streak*`) **silinmedi** — `en.json` ↔ `tr.json` paritesi
korunuyor, geri getirmede ek iş yok.
