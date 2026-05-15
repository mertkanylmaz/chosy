# Chosy.ai — Roadmap

> V1.0.2 App Store'da live (Mayis 2026)
> Aktif sprint: Mini Games (14-20 Mayis)

---

## V1.1 — Mini Games & Daily Engagement ← AKTİF

> Hedef: Gunluk uygulama girisi + session time artisi
> Sprint: 14-20 Mayis 2026 | Deadline: 20 Mayis yatirimci toplantisi

### 1.1.0 Game Altyapisi ✅
- [x] `app/games/` route yapisi + Games Hub ekrani
- [x] `services/gameService.ts` — puzzle fetch, score submit, streak
- [x] `services/gameTypes.ts` — shared types
- [x] Supabase migration: `daily_puzzles` + `game_scores` tablolari
- [x] `components/games/GameShell/` — ortak wrapper (header, progress, actions)
- [x] `components/games/ResultCard/` — sonuc + share + streak
- **Owner:** CTO
- **Status:** DONE

### 1.1.1 Imposter (Kim Yok?) ✅
- [x] Film afisi + 4 oyuncu ismi (3 gercek, 1 sahte)
- [x] Tek hak mekanigi — yanlis = oyun biter, ekran kirmizi
- [x] Sahte oyuncu secimi: ayni genre/donem filmlerden benzer taninirlik
- [x] TMDb credits data kullan (fetchMovieCredits mevcut)
- [x] Sonuc ekrani + paylasim karti
- **Owner:** CTO (impl) + CDO (spec)
- **Status:** DONE

### 1.1.2 5 Ipucu (Pinpoint) ✅
- [x] 5 ipucu: en soyuttan en somuta (1=zor, 5=kolay)
- [x] Her yanlis tahminde sonraki ipucu acilir
- [x] Ipucu uretimi: film metadata'dan (yonetmen, oyuncu, genre, yil, konu)
- [x] Film arama/autocomplete input (searchMovies mevcut)
- [x] "Kusursuz Tahmin" rozeti (ilk ipucunda bilen)
- [x] Sonuc ekrani + emoji grid paylasim
- **Owner:** CTO (impl) + CDO (spec)
- **Status:** DONE

### 1.1.3 Replik Tahmin (eski: Acimasiz Elestiri) ✅
- [x] Ikonik film repligi goster (100+ curated quote, movieQuotes.ts)
- [x] Kullanici filmi tahmin eder (arama/autocomplete)
- [x] 4 deneme hakki: replik + 3 ipucu (karakter, oyuncu, yonetmen+yil)
- [x] Sonuc ekrani + paylasim karti
- **Owner:** CTO (impl) + CDO (spec) + CMO (replik icerigi)
- **Status:** DONE

### 1.1.4 Games Hub & Navigation ✅
- [x] Home ekranina "Gunun Oyunlari" widget
- [x] Games Hub: 3 oyun karti + streak/skor ozeti
- [x] Home'dan erisim (games route)
- **Owner:** CTO + CDO
- **Status:** DONE

### 1.1.5 Polish & Release Hazirlik
- [x] Share fonksiyonu (GameShareCard + useShareCapture)
- [x] Error handling (puzzle yuklenememe durumu)
- [x] App Store What's New copy (EN + TR)
- [x] Keywords guncelleme (quiz, game, trivia)
- [ ] Supabase migration 016 deploy (db push)
- [ ] Device test — 3 oyun full flow
- [ ] V1.1.0 EAS build + App Store submit

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
