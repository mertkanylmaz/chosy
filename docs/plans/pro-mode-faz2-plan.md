# Pro Mode Faz 2 — plan özeti (Rev.2)

> Kaynak: proje belgesi `pro-mode-faz2-plan-2026-10-31.md` Rev.2'nin kullanıcı tarafından
> aktarılan özeti. Tam belge diskte bulunamadı; bu dosya yalnız özeti taşır. COMMIT EDİLMEZ.

- Pro Mode → Mood Gauntlet: ayrı kabuk, saf bileşenler günlük gauntlet ile ortak;
  günlük gauntlet tipleri yalnız eklemeli (`types/gauntlet.ts` kilitli).
- Giriş: şampiyon ekranında Spotlight ile geri sayım arasına kart (`useBelowHeight`'a
  eklenecek) + Profil satırı.
- Paywall: Rev.4 hard paywall, yeni offering yok, orkestratöre kaynak etiketi
  `mood_gauntlet_entry`.
- `choice_events.source = 'mood'`.
- PostHog `mood_*` olayları; ham mood metni gitmez.
- Bayrak `mood_gauntlet_enabled` (varsayılan kapalı).
- Canlı `app_config`: `use_hybrid_recommendation=true`, `use_llm_reranker=true`,
  `use_match_films_v2=true`, `mood_offer_enabled=false`.
