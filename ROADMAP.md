# Chosy.ai — Roadmap

> V1.0.2 App Store'da live (Mayis 2026)
> Aktif sprint: Mini Games (14-20 Mayis)

---

## V1.1 — Mini Games & Daily Engagement ← AKTİF

> Hedef: Gunluk uygulama girisi + session time artisi
> Sprint: 14-20 Mayis 2026 | Deadline: 20 Mayis yatirimci toplantisi

### 1.1.0 Game Altyapisi
- [ ] `app/games/` route yapisi + Games Hub ekrani
- [ ] `services/gameService.ts` — puzzle fetch, score submit, streak
- [ ] `services/gameTypes.ts` — shared types
- [ ] Supabase migration: `daily_puzzles` + `game_scores` tablolari
- [ ] `components/games/GameShell/` — ortak wrapper (header, progress, actions)
- [ ] `components/games/ResultCard/` — sonuc + share + streak
- **Owner:** CTO
- **Est:** 1.5 session

### 1.1.1 Imposter (Kim Yok?)
- [ ] Film afisi + 4 oyuncu ismi (3 gercek, 1 sahte)
- [ ] Tek hak mekanigi — yanlis = oyun biter, ekran kirmizi
- [ ] Sahte oyuncu secimi: ayni genre/donem filmlerden benzer taninirlik
- [ ] TMDb credits data kullan (fetchMovieCredits mevcut)
- [ ] Sonuc ekrani + paylasim karti
- **Owner:** CTO (impl) + CDO (spec)
- **Est:** 1.5 session
- **Bagimlilik:** 1.1.0

### 1.1.2 5 Ipucu (Pinpoint)
- [ ] 5 ipucu: en soyuttan en somuta (1=zor, 5=kolay)
- [ ] Her yanlis tahminde sonraki ipucu acilir
- [ ] Ipucu uretimi: Claude API veya pre-generated (films tablosundan metadata)
- [ ] Film arama/autocomplete input (searchMovies mevcut)
- [ ] "Kusursuz Tahmin" rozeti (ilk ipucunda bilen)
- [ ] Sonuc ekrani + emoji grid paylasim
- **Owner:** CTO (impl) + CDO (spec)
- **Est:** 2 session
- **Bagimlilik:** 1.1.0

### 1.1.3 Acimasiz Elestiri
- [ ] Gercek veya AI-uretilmis 1 yildiz komik yorum goster
- [ ] Kullanici filmi tahmin eder (arama/autocomplete)
- [ ] TMDb reviews API fonksiyonu ekle VEYA Claude API ile satirik yorum uret
- [ ] Sonuc ekrani + komik yorum paylasim karti
- **Owner:** CTO (impl) + CDO (spec) + CMO (yorum icerigi)
- **Est:** 2 session
- **Bagimlilik:** 1.1.0

### 1.1.4 Games Hub & Navigation
- [ ] Home ekranina "Gunun Oyunlari" widget
- [ ] Games Hub: 3 oyun karti + streak/skor ozeti
- [ ] Tab bar'dan veya home'dan erisim
- **Owner:** CTO + CDO
- **Est:** 1 session
- **Bagimlilik:** 1.1.1, 1.1.2, 1.1.3

---

## V1.2 — Streaming & Visual Games

> Hedef: "Nerede izlerim?" + gorsel oyunlar
> Tahmini: 2-3 hafta (post-investor)

### 1.2.1 Streaming Availability
- [ ] TMDB watch/providers entegrasyonu
- [ ] Film detayda "Watch on..." butonlari
- [ ] TR + US provider destegi

### 1.2.2 Pikselli Afis (Oyun #4)
- [ ] Bulanik afis → her yanlis tahminde netlesir
- [ ] Progressive blur/pixelation efekti
- [ ] Paylasim karti

### 1.2.3 Renk Paleti (Oyun #5)
- [ ] Film renk paleti cikarimi
- [ ] 5 renk cubugu + metin ipuclari
- [ ] Estetik paylasim karti

### 1.2.4 Push Notifications
- [ ] Gunluk oyun hatirlatmasi
- [ ] Streak kaybi uyarisi

---

## V1.3 — Deep Games & Social

> Hedef: Hardcore sinefil oyunlari + sosyal katman

### 1.3.1 Kare Kare (Oyun #6)
- [ ] Film detay kareleri → progressive reveal

### 1.3.2 Film Zinciri (Oyun #7)
- [ ] Aktor-film-aktor graf baglantisi
- [ ] Autocomplete arama + path validation

### 1.3.3 Social Features / Film Buddy
- [ ] Arkadas ekleme, liste paylasma
- [ ] Film buddy eslesmesi (degerlendirilecek)

### 1.3.4 Android Launch
- [ ] EAS Android build + Google Play

---

## Backlog

- Landing page (chosy.ai)
- Letterboxd/IMDb import
- iOS Widget (Today's Pick + Gunun Oyunu)
- Apple Watch companion
- AI sohbet modu
- Leaderboard / global ranking
- Affiliate revenue

---

## Basari Metrikleri

| Metrik | V1.1 Hedef | V1.2 Hedef |
|--------|-----------|-----------|
| DAU | 100+ | 500+ |
| D1 Retention | >40% | >50% |
| D7 Retention | >20% | >30% |
| Games Played/Day | 2+ per user | 3+ per user |
| Game Share Rate | >10% | >20% |
| Session Duration | >3 min | >5 min |
| Trial > Paid | >50% | >60% |
| App Store Rating | >4.5 | >4.7 |
| Crash-free | >99% | >99.5% |
