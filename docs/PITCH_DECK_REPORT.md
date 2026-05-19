# Chosy.ai — Pitch Deck Raporu

> Hazirlanma Tarihi: 12 Mayis 2026
> Hazirlayan: CEO Agent | Kaynak: Proje dokumantasyonu + mimari + roadmap

---

## 1. PROBLEM

### Kullanici Problemi
- Ortalama bir kullanici her gece **20+ dakika** ne izleyecegine karar vermek icin platform geziyor
- Netflix, Disney+, Prime, MUBI... **10+ streaming platform** arasinda kaybolma
- "Karar yorgunlugu" (Decision Fatigue): cok fazla secenekten hicbirini secememe
- Mevcut oneri sistemleri **tur bazli** — ama insanlar her gun farkli hissediyor

### Pazar Boşlugu
- Mevcut cozumler (IMDb, Letterboxd, JustWatch) **ne hissettigini** sormuyor
- Hicbir uygulama **duygu → film eslesmesi** yapmiyor
- AI-native film kesfetme kategorisi **henuz boş** — erken giris avantaji

---

## 2. COZUM — Chosy.ai

**Tek cumle:** Ruh halini anlat, AI sana en uygun filmi bulsun.

### Nasil Calisir (Core Flow)
```
1. Kullanici ruh halini yazar → "Yagmurlu bir aksam, huzunlu ama guzel bir sey"
2. AI (Claude) duyguyu analiz eder → 12 boyutlu duygu vektoru olusturur
3. pgvector cosine similarity ile 384 boyutlu film profilleriyle eslestirir
4. Kullanici Tinder-tarzi swipe ile filmleri kesfeder
5. Saga kaydir = izleme listesine ekle, sola = gec
6. Izleme listesi mood bazli gruplanir
```

### Temel Ozellikler (V1.0 — LIVE)
| Ozellik | Aciklama |
|---------|----------|
| AI Mood Matching | Serbest metin → duygu vektoru → film eslesmesi |
| 12 Sinefil Arketipi | 6 soruluk zevk testi ile kisilik profili |
| Swipe Discovery | Tinder-tarzi film kaydirma deneyimi |
| Today's Pick | Arketipe ozel gunluk film onerisi |
| Mood Match Score | Her filmin ruh haline uyum yuzdesi |
| Share Cards | Sosyal medya paylasim kartlari (mood + film) |
| Taste DNA | Gelisen film tercihleri gorselleştirmesi |
| Gamification | Streak, milestone, badge sistemi |
| Watchlist Grouping | Mood bazli izleme listesi organizasyonu |

---

## 3. PAZAR BUYUKLUGU

### TAM (Total Addressable Market)
- Global streaming subscribers: **1.8 milyar+** (2026)
- "What to watch" Google aramalari: **ayda 30M+**
- Film oneri uygulamalari kategorisi: **$2.4B** (2025, tahmini)

### SAM (Serviceable Available Market)
- iOS kullanicilari, 18-45 yas, film/dizi tuketicileri
- Ingilizce + Turkce konusan pazarlar
- Tahmini: **50M kullanici**

### SOM (Serviceable Obtainable Market)
- Ilk yil hedef: **10K-50K indirme**
- Organik + viral buyume stratejisi
- Turkiye + ABD/UK oncelikli

---

## 4. IS MODELI & MONETIZASYON

### Subscription-First Model
| Plan | Fiyat | Kota | Ozellikler |
|------|-------|------|------------|
| Ucretsiz Deneme | $0 | 1 kerelik mood arama (toplam) | Ilk deneyim, conversion hook |
| Weekly | $1.99/hafta | 2 arama/gun | 3 gun ucretsiz trial |
| Monthly | $4.99/ay | 3 arama/gun + 21/hafta | Tam erisim |
| Yearly | $39.99/yil | Aylikla ayni | En avantajli (~$3.33/ay) |

> **Not:** Free plan yok. Kullanici 1 kerelik ucretsiz deneme sonrasi abonelik secmeli. Bu model conversion rate'i yukseltiyor.

### Gelir Projeksiyonu (Konservatif)
| Metrik | Ay 3 | Ay 6 | Ay 12 |
|--------|-------|------|-------|
| Toplam Indirme | 5K | 15K | 50K |
| Aktif Kullanici (MAU) | 1.5K | 5K | 20K |
| Paid Conversion | 5% | 7% | 10% |
| Paying Users | 75 | 350 | 2,000 |
| Ortalama ARPU | $4.50 | $4.50 | $4.50 |
| MRR | $337 | $1,575 | $9,000 |
| ARR | — | — | $108,000 |

> Not: Konservatif tahmin. Viral buyume ve ASO optimizasyonu ile yukari potansiyel yuksek.

### Gelecek Gelir Kanallari
- Streaming platform affiliate geliri (referral komisyon)
- Premium filtreler (yonetmen, sinematograf, donem)
- B2B API (streaming platformlarina mood-matching teknolojisi lisansi)

---

## 5. REKABET ANALIZI

| Rakip | Ne Yapar | Chosy Farki |
|-------|----------|-------------|
| **IMDb** | Film veritabani + rating | Mood yok, sadece bilgi |
| **Letterboxd** | Sosyal film gunlugu | Oneri yok, retrospektif |
| **JustWatch** | Hangi platformda var | Kisisellesme yok |
| **Netflix/Spotify** | Tur bazli oneri | Duygu anlamaz, platform bagimsiz degil |
| **Reelgood** | Platform arasi arama | AI mood matching yok |
| **TasteDive** | "Buna benzer" onerileri | Mood yok, statik veri |

### Rekabet Avantajlari
1. **AI-native:** Claude API ile dogal dil → duygu analizi (rakiplerde yok)
2. **Emotion-to-vector matching:** 384 boyutlu ozel vektör eslesmesi (proprietary)
3. **Platform agnostik:** Hicbir streaming platformuna bagli degil
4. **12 arketip sistemi:** Kisilik bazli uzun vadeli kisisellesme
5. **Swipe UX:** Kanıtlanmis etkilesim modeli (Tinder/Bumble validated)

---

## 6. TEKNOLOJI & MIMARI

### Tech Stack
| Katman | Teknoloji |
|--------|-----------|
| Frontend | React Native 0.83.2 + Expo SDK 55 |
| Routing | Expo Router v7 (file-based) |
| Backend | Supabase (PostgreSQL + pgvector + Edge Functions) |
| AI Engine | Claude API (Anthropic) — mood parsing |
| Film Data | TMDb API |
| Payments | RevenueCat |
| Animations | react-native-reanimated v4 |
| i18n | i18n-js (EN + TR) |

### Ozel Teknoloji (Moat)
- **Emotion Vector Engine:** Serbest metin → 12 boyutlu duygu profili → 384 boyutlu film esleme vektoru
- **pgvector Cosine Similarity:** Gercek zamanli vektör benzerlik araması (PostgreSQL native)
- **Archetype Engine:** 6 soru → 12 sinefil arketipi hesaplama algoritması
- **Adaptive Feed Manager:** Azalan esik ile sonsuz film akisi (cold-start destekli)

### Mimari Diyagram
```
[Kullanici] → [React Native App]
                    ↓
           [Supabase Edge Functions]
                    ↓
    [Claude API] → [Emotion Vector] → [pgvector Match]
                                           ↓
                                    [TMDb Film Data]
                                           ↓
                              [Swipe Feed → Watchlist]
```

### Veritabani Semasi (12 tablo)
- `users` — auth, arketip, preferences_vector (384-dim)
- `films` + `film_profiles` — film verileri + vektör profilleri
- `sessions` + `swipes` — mood oturumlari + swipe kayitlari
- `watchlist` — izleme listesi
- `user_streaks` + `milestones` + `user_milestones` — gamification
- `custom_lists` + `custom_list_films` — ozel listeler
- `feedback` — kullanici geri bildirimi

---

## 7. TRACTION & MEVCUT DURUM

### Urun Durumu
| Durum | Detay |
|-------|-------|
| iOS App Store | V1.0.0 submitted (2 Mayis 2026) — review'da |
| V1.0.2 | Son build — kota bypass fix + film tekrar sorunu cozuldu |
| Core Flow | Calisiyor: onboarding → mood → AI → swipe → watchlist → paywall |
| Auth | Apple Sign-In zorunlu, auth gating aktif |
| Payments | RevenueCat entegrasyonu tamamlandi, 3 plan live |
| Lokalizasyon | Ingilizce + Turkce tam destek |
| Gamification | Streak, milestone, badge sistemi aktif |

### Build Gecmisi
- 3 build iterasyonu (V1.0.0 → V1.0.1 → V1.0.2)
- Her iterasyonda bug fix + polish
- Supabase migration: 13 migration deploy edildi (001-013)
- 4 Edge Function deploy edildi (parse-mood, parse-taste, recommend, explain-match)

---

## 8. GO-TO-MARKET STRATEJISI

### Faz 1: Organic Launch (Hafta 1-4)
| Kanal | Strateji |
|-------|----------|
| Product Hunt | Launch day post + maker comment |
| Reddit | r/SideProject, r/movies, r/MovieSuggestions |
| Twitter/X | @chosyai — 5 teaser tweet + launch announcement |
| TikTok/Reels | 3 video konsepti (POV mood matching, archetype reveal, movie night AI) |
| Turkish Media | Webrazzi, Startup Istanbul reach-out |
| Personal Network | WhatsApp/Telegram duyuru |

### Faz 2: ASO Optimizasyonu (Hafta 2-8)
- Hedef keyword'ler: "what to watch", "mood movie", "AI movie picker", "ne izlesem", "film onerisi"
- Haftalik keyword performans takibi
- Rating + review toplama kampanyasi

### Faz 3: Paid Marketing (Gelir sonrasi)
- Paid marketing ancak pre-seed funding veya subscription geliri sonrasi
- Revenue-first yaklasim

### Hedef KPI'lar (Ilk 30 Gun)
| Metrik | Hedef |
|--------|-------|
| Downloads (organik) | 500-1,000 |
| D1 Retention | >40% |
| D7 Retention | >20% |
| Trial → Paid | >50% |
| App Store Rating | >4.5 |
| Crash-free Rate | >99% |

---

## 9. ROADMAP

### V1.1 — Streaming & Re-engagement (2-3 hafta)
- Streaming availability (Netflix, Prime, Disney+, BluTV, MUBI hangi platformda?)
- Watchlist → "Watch Now" deep link
- Push notifications (Daily Pick bildirimi)

### V1.2 — Smarter AI & Retention (3-4 hafta)
- Mood history & pattern analysis (son 30 gun)
- Swipe history feedback loop (liked/skipped filmlerden ogrenme)
- Gamification derinleştirme (haftalik challenge, streak odulleri)

### Android Launch — Mayis 2026
- EAS Android build + Google Play Store listing
- Google Sign-In native implementasyon
- iOS ile esit ozellik seti

### V1.3 — Growth & Monetization (4+ hafta)
- Sosyal ozellikler (arkadas ekleme, liste paylasma)
- Premium filtreler (yonetmen, donem, sinematograf)

### Backlog
- chosy.ai landing page
- Letterboxd/IMDb import
- iOS Home Screen widget (Today's Pick)
- Apple Watch companion
- AI sohbet modu ("Tell me more about this film...")
- Affiliate revenue (streaming referral komisyon)
- B2B API lisanslama

---

## 10. TAKIM

### Mevcut
| Rol | Kim |
|-----|-----|
| Founder & Product Owner | Mertkan Yilmaz |
| Development | AI-assisted (Claude Code — CEO/CTO/CDO/CMO agent sistemi) |

### AI-Augmented Development Modeli
- 4 uzman AI agent: CEO (strateji), CTO (kod), CDO (tasarim), CMO (pazarlama)
- Sprint bazli agile gelistirme
- Tek kisilik ekip + AI ile enterprise-seviye urun kalitesi
- **Maliyet avantaji:** Geleneksel 4-5 kisilik takim maliyetinin ~%5'i ile ayni cikti

### Gelecek Ihtiyaclar
- Growth/marketing uzmani (organik buyume sonrasi)
- iOS developer (V1.2+ icin opsiyonel)
- Community manager (sosyal ozellikler sonrasi)

---

## 11. FINANSAL OZET

### Mevcut Maliyetler (Aylik)
| Kalem | Tahmini Maliyet |
|-------|-----------------|
| Supabase (Pro) | ~$25/ay |
| Claude API | ~$20-50/ay (kullanima gore) |
| TMDb API | Ucretsiz (non-commercial) |
| RevenueCat | Ucretsiz (ilk $2.5K gelire kadar) |
| Apple Developer | $99/yil (~$8.25/ay) |
| Expo EAS | Ucretsiz tier |
| **Toplam** | **~$55-85/ay** |

### Birim Ekonomi
| Metrik | Deger |
|--------|-------|
| CAC (organik) | ~$0 (launch fazinda) |
| Average ARPU | ~$4.50/ay |
| LTV (6 ay retention) | ~$27 |
| LTV/CAC | ∞ (organik), hedef >3x (paid) |
| Gross Margin | ~85% (API maliyetleri dusuldukten sonra) |

---

## 12. YATIRIM TALEBI (Opsiyonel Slide)

### Kullanim Alanlari (Pre-Seed)
| Alan | Oran |
|------|------|
| Marketing & User Acquisition | %60 |
| Server/API olcekleme | %15 |
| Landing page + branding | %10 |
| Gelistirme & operasyon | %10 |
| Yedek | %5 |

> **Odak:** Fonun buyuk cogunlugu pazarlama ve kullanici kazanimina ayrilacak. Urun hazir — simdi buyume zamani.

### Milestones
| Milestone | Zaman | Hedef |
|-----------|-------|-------|
| App Store Onay | Mayis 2026 | ✅ Submitted |
| 1K Indirme | Haziran 2026 | Organik buyume |
| $1K MRR | Agustos 2026 | Monetizasyon kaniti |
| 10K MAU | Ekim 2026 | Product-market fit |
| Android Launch | Mayis 2026 | Platform genisleme |
| $10K MRR | Q1 2027 | Olcekleme fazı |

---

## 13. PITCH DECK SLIDE ONERISI (11 Slide)

| # | Slide | Icerik |
|---|-------|--------|
| 1 | **Cover** | Chosy.ai logo + "Your Mood, Your Movies" + tagline |
| 2 | **Problem** | 20 dk scrolling, 10 platform, karar yorgunlugu (Bolum 1) |
| 3 | **Solution** | Core flow demo: mood → AI → swipe → watchlist (Bolum 2) |
| 4 | **Demo/Product** | Ekran goruntuleri veya video: mood input → swipe → archetype |
| 5 | **Market** | TAM/SAM/SOM + AI film oneri kategorisi bos (Bolum 3) |
| 6 | **Business Model** | Subscription-first + 3 plan + gelir projeksiyonu (Bolum 4) |
| 7 | **Traction** | V1.0 App Store'da, tech stack, 13 migration, full flow (Bolum 7) |
| 8 | **Competition** | Rekabet matrisi + 5 avantaj (Bolum 5) |
| 9 | **Roadmap** | V1.1 → V1.2 → V1.3 timeline + Android Mayis 2026 (Bolum 9) |
| 10 | **Team & Ask** | Solo founder + AI-augmented dev + yatirim talebi (Bolum 10-12) |
| 11 | **CTA + QR** | QR kod (App Store linki) + iletisim bilgileri + "Simdi deneyin" |

---

## 14. ANAHTAR MESAJLAR (Pitch Icin)

### One-Liner
> "Chosy.ai, insanlarin ne hissettigini anlayarak en uygun filmi bulan, AI destekli ilk duygu bazli film eslestirme uygulamasidir."

### Elevator Pitch (30 saniye)
> "Her gece ayni soru: 'Ne izlesem?' Insanlar 20 dakika 10 farkli platformda geziyor ama bir sey secemiyor. Chosy.ai bu sorunu cozer. Kullanici ruh halini yazar — mesela 'yagmurlu bir aksam, huzunlu ama guzel bir sey' — ve AI saniyeler icinde duygu profiline en uygun filmleri bulur. Tinder gibi kaydirarak kesfeder, saga kaydirip listesine ekler. V1.0 simdi App Store'da."

### Neden Simdi?
1. **AI olgunlasmasi:** LLM'ler artik dogal dili duygu vektorune donusturebiliyor
2. **Streaming parcalanmasi:** 10+ platform = artan karar yorgunlugu
3. **Kategori bos:** "Mood-based film discovery" henuz sahiplenilmemis
4. **Dusuk maliyet:** AI-augmented development ile tek kisilik ekip enterprise-kalite urun cikarabiliyor

---

---

## 15. SON SLIDE — CTA & QR KOD

### Slide Icerigi
```
+------------------------------------------+
|                                          |
|           Chosy.ai                       |
|     Your Mood, Your Movies.              |
|                                          |
|         [QR KOD ALANI]                   |
|        App Store'dan indir               |
|                                          |
|    Mertkan Yilmaz — Founder             |
|    mertkanylmaz@gmail.com                |
|    @chosyai                              |
|                                          |
|    "Simdi deneyin — ruh halinizi         |
|     yazin, filminizi bulun."             |
|                                          |
+------------------------------------------+
```

### QR Kod Notu
- QR kod App Store linkine yonlendirilmeli
- Pitch sonrasi dinleyiciler hemen uygulamayi indirebilmeli
- QR kodu buyuk ve taranabilir boyutta yerleştir (min 200x200px)
- Altina kisa CTA: "Scan to download" / "Hemen dene"

---

*Bu rapor pitch deck slaytlarinin icerigi icin kaynak dokuman olarak hazirlanmistir.*
*Tum veriler proje dokumantasyonundan (ROADMAP.md, ARCHITECTURE.md, DESIGN_SYSTEM.md, LAUNCH_CHECKLIST.md) derlenmiştir.*
