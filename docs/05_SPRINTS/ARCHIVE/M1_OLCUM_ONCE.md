# M1 — Ölçüm Önce

**Başlangıç:** 18 Ağustos 2026
**Bağlı bible maddesi:** D-01, D-04, E-04, K-38, K-39

## Amaç
Production'a çıkmadan ölçüm hazır olsun. Sıra sapması bilinçli düzeltildi:
bu iş E-01 değil **D-01** gereğidir — "ölçüm ve kimlik en başa alınır".
Gauntlet kullanıcıya ulaşmadan önce event sözlüğü, hata izlenebilirliği ve
algoritma sağlık görünürlüğü yerinde olmalı.

## Kapsam

### Ölçüm (event sözlüğü)
- **Gauntlet/champion çekirdeği** — `gauntlet_viewed` · `gauntlet_started` ·
  `choice_submitted` · `choice_rejected` · `context_changed` ·
  `gauntlet_completed` · `champion_revealed`
  (`components/gauntlet/GauntletShell`, `ContextBar`) — commit 7217639
- **Watch feedback (C.4)** — `watched_prompted` · `watched_confirmed` ·
  `watched_not_yet` (`PendingWatchFeedbackCard`) — commit 49b4355
- **Auth / paywall / DNA / watchlist** — `auth_prompt_viewed` ·
  `auth_prompt_completed` · `onboarding_step_completed` ·
  `onboarding_completed` · `archetype_revealed` · `retake_quiz_completed` ·
  `dna_viewed` · `paywall_viewed` · `purchase_started` ·
  `purchase_completed` · `restore_completed` — commit a9c311a

### Bağlam ve izlenebilirlik
- `ChoiceResult` sözleşmesine `gauntlet_id` + `algorithm_version` bağlandı
  (`services/gauntletService.ts`, `submit-choice/index.ts`) — commit a8cfda5.
  Sözleşme genişlemesi gauntlet-contract prosedürüyle yapıldı.
- Sentry `release` / `dist` alanları eklendi (`app/_layout.tsx`) — commit c222742
- EAS native source map: **otomatik**, Sentry Expo plugin üzerinden — ek iş gerekmedi
- `v_algorithm_daily` view (D-04, migration 092) — commit c0b162d.
  Admin UI inşa edilmedi (D-04 kararı), yerine SQL view + PostHog dashboard.

## Kapsam DIŞI
- **OTA update source map'i** — ayrı bir workflow gerektirir, teknik borca
  kaydedildi (commit 07a6f1a)
- **`save_for_later` / `provider_clicked` event'leri** — ilgili CTA'lar henüz
  yok; C.9b / C.9c ile birlikte eklenecek

## Bonus bulgu — güvenlik taraması (P0/P1)

Ölçüm altyapısı kurulurken yapılan view/RLS taramasında üç view'ın
`anon` ve `authenticated` rollerine açık olduğu, PII sızdırdığı bulundu.
Üçü de aynı turda kapatıldı, ardından **kök neden** düzeltildi.

| Migration | İş | Commit |
|---|---|---|
| 093 | `v_mood_searches_recent` PII sızıntısı kapatıldı (P0) | 0e22b5c |
| 094 | `user_swipe_history` PII sızıntısı kapatıldı (P0) | fd18685 |
| 095 | `detective_daily_scores` erişimi daraltıldı (P1) | 2163274 |
| 096 | **Kök neden:** `public` şemada varsayılan `anon`/`authenticated` erişimi kapatıldı (proje-bootstrap default privilege kuralı) | fd99ffa |
| 097 | Kasıtlı-açık view'lara (`v_posterle_daily_stats`, `public_daily_puzzles`) koruma notu | 62d0da0 |
| 098 | Default-privilege test view'ı temizlendi | fd99ffa (096 ile aynı commit) |

İlgili doküman commit'leri: 2373c88 (bulgunun teknik borca kaydı),
f3c60b7 (tarama çözüldü olarak işaretlendi + `supabase_admin` boşluğu kaydı).

**Kalan boşluk:** `supabase_admin` default privilege'ı migration'la
kapatılamıyor — Dashboard veya Supabase support gerekiyor. Açık madde olarak
durum devrine taşındı (commit f3c60b7).

## DUR NOKTALARI
| # | Soru | Cevap | Tarih |
|---|---|---|---|
| 1 | OTA source map şimdi mi kurulsun? | Hayır — native source map yeterli, OTA ayrı workflow gerektiriyor, teknik borca kaydedildi | 18 Ağu 2026 |
| 2 | `generation_status` kolonu yokken view neyi "tamamlandı" sayacak? | `champion_film_id IS NOT NULL` **vekil sinyal** olarak kullanılır; K-37 state machine'i hiç implement edilmemiş, migration 092 başlığına not düşüldü | 18 Ağu 2026 |
| 3 | 3 view sızıntısı bulununca ne yapılsın — sprint dışı mı bırakılsın? | Hepsi hemen kapatıldı (P0/P1) ve kök neden de düzeltildi | 18 Ağu 2026 |

## Doğrulama
| Komut | Beklenen | Sonuç |
|---|---|---|
| `npm run typecheck` | Baseline: 14 hata, hepsi `scripts/` altında | ✅ 14 hata, hepsi `scripts/` |
| `supabase db push` (092-098) | Migration'lar sırayla uygulanmalı | ✅ Uygulandı — canlı en yüksek migration **098** |
| Canlı view erişim kontrolü | 3 view'da `anon`/`authenticated` GRANT kalmamalı | ✅ Kapatıldı (093-095), kök neden 096 |

## Durum
Tamamlandı — 18 Ağustos 2026.
