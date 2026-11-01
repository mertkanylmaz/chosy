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

## 2.2.1 (CTO kararı, Faz 2-2)

- Mood şampiyonu watch-feedback bu sürümde (2.2.0) YAPILMAZ.
- 2.2.1: **A seçeneği** — sunucu günlük + mood adayını birlikte döndürür, istemci yerel (AsyncStorage)
  son "Watch now / Where" dokunuşuna göre birini sorar. Şema değişikliği yok.
- Kapsam: `generate-gauntlet` + `submit-watch-feedback` (mood setini `choice_events` round 3 / `source='mood'`
  üzerinden doğrular) + `types/gauntlet.ts` eklemesi (eklemeli, CTO onayıyla).
- Öncelik: günlük şampiyon; mood şampiyonu YALNIZ Watch now'a basıldıysa sorulur.
- Açık: `recompute-taste-vector`'ın mood kaynaklı `watch_feedback` satırlarını işleyişi doğrulanacak.
