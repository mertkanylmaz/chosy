# V1.0.3 Regression Test Checklist

## BUG #1 — Onboarding re-trigger fix
- [ ] Yeni user signup → onboarding gorur
- [ ] Logout → tekrar login → onboarding GORMEMELI
- [ ] App sil, tekrar yukle, ayni Apple ID ile login → onboarding GORMEMELI
- [ ] DB: users.onboarding_completed_at NOT NULL (tamamlanan user icin)

## BUG #2 — Premium manage subscription
- [ ] Free user → Settings → "Upgrade Premium" → paywall acilir
- [ ] Premium user → Settings → "Manage Subscription" → iOS subscription settings acilir
- [ ] Premium user → upgrade akisina yanlistikla dusmez

## BUG #3 — Quota decrement fix
- [ ] Free user → 1 mood arama → remaining = 0, paywall
- [ ] Monthly user → 3 mood arama → 4. denemede QuotaExhausted
- [ ] Arama sonrasi kalan hak sayisi azaliyor (UI guncelleniyor)
- [ ] recordMoodSearch basarisiz olursa sonuc gosterilmez (hata mesaji)
- [ ] DB: mood_searches tablosunda her arama icin yeni satir

## BUG #4 — Clear watchlist fix
- [ ] Watchlist'e 3 film ekle → Settings → Clear → onay → watchlist bos
- [ ] Cancel basinca silinmemeli
- [ ] Basarili silme sonrasi alert gosterilir
- [ ] Watchlist tab'a donunce bos liste gorulur

## Genel
- [ ] TypeScript: yeni hata yok (pre-existing'ler haric)
- [ ] App acilis akisi: gate → auth → tabs (normal)
- [ ] i18n: EN ve TR metinler dogru
