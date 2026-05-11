# Chosy.ai — Roadmap (Post-MVP)

> V1.0.0 App Store review'da (2 Mayis 2026)
> Asagidaki tum planlar review onayi sonrasi baslar

---

## V1.1 — Streaming & Re-engagement

> Hedef: "Nerede izlerim?" sorusunu coz + gunluk geri cagirma
> Tahmini: 2-3 hafta

### 1.1.1 Streaming Availability
- [ ] TMDB watch/providers API entegrasyonu (veya JustWatch)
- [ ] Film detay sayfasinda "Watch on..." butonlari
- [ ] Turkiye + US provider destegi (Netflix, Prime, Disney+, BluTV, MUBI)
- [ ] Provider ikonlari + deep link (varsa)
- **Owner:** CTO

### 1.1.2 Watchlist > Streaming Deep Link
- [ ] Watchlist'teki filmlere "Watch Now" aksiyonu
- [ ] Provider secim bottom sheet (birden fazla platformda varsa)
- **Owner:** CTO
- **Bagimlilik:** 1.1.1

### 1.1.3 Push Notifications (Daily Pick)
- [ ] expo-notifications + Supabase Edge Function (veya OneSignal)
- [ ] Gunluk "Today's Pick" notification (arketipe ozel)
- [ ] Notification permission flow (onboarding sonrasi)
- [ ] Bildirim tercihleri (profile settings)
- **Owner:** CTO

---

## V1.2 — Smarter AI & Retention

> Hedef: Kisisellesmeyi derinlestir, kullaniciyi bagla
> Tahmini: 3-4 hafta

### 1.2.1 Mood History & Pattern Analysis
- [ ] Mood gecmisi kaydi (son 30 gun)
- [ ] Haftalik mood pattern ozeti (profil ekraninda)
- [ ] "Based on your mood patterns" oneriler
- **Owner:** CTO

### 1.2.2 Gelismis AI Recommendations
- [ ] Swipe history feedback loop (liked/skipped filmlerden ogrenme)
- [ ] preferences_vector guncelleme (her 10 swipe sonrasi)
- [ ] "Because you liked X" aciklamalari
- **Owner:** CTO

### 1.2.3 Gamification Deepening
- [ ] Haftalik challenge sistemi ("Watch 3 films from different decades")
- [ ] Streak odulleri (7, 30, 100 gun)
- [ ] Achievement badge koleksiyonu (profilde goruntuleme)
- [ ] Leaderboard (opsiyonel — sosyal feature ile birlikte)
- **Owner:** CTO + CDO

---

## V1.3 — Growth & Monetization

> Hedef: Organik buyume + ARPU artisi
> Tahmini: 4+ hafta

### 1.3.1 Social Features
- [ ] Arkadas ekleme (invite link)
- [ ] Liste paylasma
- [ ] "X is watching..." activity feed
- **Owner:** CTO

### 1.3.2 Premium Feature Expansion
- [ ] Unlimited mood searches (premium)
- [ ] Advanced filters (director, cinematographer, decade)
- [ ] Custom archetype blending
- [ ] Export watchlist (CSV, Letterboxd import)
- **Owner:** CTO + COO (strateji)

### 1.3.3 Android Launch
- [ ] EAS Android build + test
- [ ] Google Play Store listing
- [ ] Google Sign-In native implementasyon
- **Owner:** CTO

---

## Backlog (Oncelik belirlenmemis)

- Landing page (chosy.ai web sitesi)
- Letterboxd/IMDb import
- Widget (iOS home screen — Today's Pick)
- Apple Watch companion (mood quick-input)
- Yapay zeka sohbet modu ("Tell me more about why this film...")
- Multi-language AI (TR mood input native parsing)
- Affiliate revenue (streaming platform referral)

---

## Basari Metrikleri

| Metrik | V1.1 Hedef | V1.2 Hedef |
|--------|-----------|-----------|
| DAU | 100+ | 500+ |
| D1 Retention | >40% | >50% |
| D7 Retention | >20% | >30% |
| Trial > Paid | >50% | >60% |
| App Store Rating | >4.5 | >4.7 |
| Crash-free | >99% | >99.5% |
