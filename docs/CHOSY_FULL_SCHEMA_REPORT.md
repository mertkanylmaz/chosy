# Chosy.ai — Tam Proje Raporu

> **Hazirlanma Tarihi:** 19 Temmuz 2026
> **Durum:** V1.0.2 iOS App Store'da live | V1.1 (Mini Games) release hazirlik asamasinda
> **Hedef Kitle:** Uzman mobile developer onboarding / teknik due diligence

---

## 1. Vizyon ve Problem

### Problem
Kullanicilar her gece "bu gece ne izlesem?" sorusuyla karsi karsiya. 10 farkli streaming platformunda dakikalarca scroll yapiyor, karar yorgunlugu yasiyor ve sonunda ya bir sey izlemeden birakiyor ya da rastgele bir secim yapiyor.

### Cozum
Chosy.ai, genre-bazli degil **duygu-bazli** film oneri yapan bir AI uygulamasi. Kullanici nasil hissettigini yazar, AI 12 boyutlu bir duygu profili cikarir ve bu profili pgvector cosine similarity ile film veritabanina eslestirir. Tinder-tarzi swipe mekanigi ile kesifleri kolaylastirir.

### Farklilik
- Cogu oneri uygulamasi "hangi turu seversin?" diye sorar. Chosy "nasil hissediyorsun?" diye baslar
- 12 sinefil arketip sistemi — kullaniciya bir sinema kimligi kazandirir (retention hook)
- Gunluk mini oyunlar ile engagement — retention metrikleri icin ikinci katman
- Founding Member (ilk 1000 lifetime) scarcity modeli — erken monetization

### Hedef Metrikler
| Metrik | V1.1 Hedef | V1.2 Hedef |
|--------|-----------|-----------|
| DAU | 100+ | 500+ |
| D1 Retention | >40% | >50% |
| D7 Retention | >20% | >30% |
| Session Duration | >3 min | >5 min |
| Trial > Paid | >50% | >60% |

---

## 2. Teknoloji Stack'i

### Frontend
| Teknoloji | Versiyon | Amac |
|-----------|---------|------|
| React Native | 0.81.5 | Cross-platform UI |
| Expo SDK | 54 (managed, `expo-dev-client`) | Build tooling, native API'ler |
| Expo Router | v6 (file-based) | Navigation |
| React | 19.1.0 | UI framework |
| react-native-reanimated | v4.1.1 | 60fps animasyonlar |
| react-native-gesture-handler | 2.28.0 | Swipe gesture'lar |
| i18n-js + expo-localization | | EN + TR lokalizasyon |
| Phosphor Icons | 3.0.6 | Ikon seti |
| expo-image | 3.0.11 | Performansli gorsel render |
| expo-haptics | | Dokunsal geri bildirim |

### Backend
| Teknoloji | Amac |
|-----------|------|
| Supabase (PostgreSQL) | Ana veritabani, auth, RLS |
| pgvector extension | 384-dim cosine similarity arama |
| Supabase Edge Functions (Deno) | 24 serverless fonksiyon |
| Claude API (@anthropic-ai/sdk) | Mood parsing (TasteProfile cikarma) |
| TMDb API | Film data, posterler, credits |

### Monetization & Analytics
| Teknoloji | Amac |
|-----------|------|
| RevenueCat (react-native-purchases) | Abonelik yonetimi |
| PostHog (posthog-react-native) | Urun analitigi, A/B test |
| Sentry (@sentry/react-native) | Crash raporlama |

### Build & Deploy
| Teknoloji | Amac |
|-----------|------|
| EAS Build | iOS/Android native build |
| EAS Submit | App Store/Play Store gonderim |
| expo-updates | OTA guncelleme |
| expo-dev-client | Gelistirme build'i (Expo Go degil) |

---

## 3. Uygulama Mimarisi

### 3.1 Routing Yapisi (Expo Router — File-based)

```
app/
  _layout.tsx          -> Root layout (provider zinciri + auth listener)
  (tabs)/
    _layout.tsx        -> Bottom tab bar (4 tab, floating pill)
    index.tsx          -> Home (GreetingWidget + ArchetypeCard + DailyPick + MoodCTA)
    mood.tsx           -> Mood input + AI processing + result (3 state machine)
    watchlist.tsx      -> Izleme listesi (2x2 grid + grouped by session)
    profile.tsx        -> Profil, arketip, TasteDNA, stats, settings
  discover.tsx         -> Film swipe feed (STACK screen, tab degil)
  film/[id].tsx        -> Film detay (slide_from_bottom modal)
  gate.tsx             -> Auth guard (anonim -> /auth'a redirect)
  auth.tsx             -> Apple Sign-In (zorunlu)
  setup-profile.tsx    -> Username + avatar secimi
  onboarding.tsx       -> 3 intro slide + 6 soru calibration + archetype reveal
  paywall.tsx          -> 3 plan subscription UI + purchase + restore
  lifetime.tsx         -> Founding Member ozel satis (scarcity counter)
  referral.tsx         -> Davet programi (milestone rewards)
  games/
    _layout.tsx        -> Games stack navigator
    index.tsx          -> Games Hub (3 oyun karti)
    imposter.tsx       -> Sahtekar oyunu
    pinpoint.tsx       -> 5 Ipucu oyunu
    roast.tsx          -> Replik Tahmin oyunu
```

### 3.2 Provider Zinciri

```
GestureHandlerRootView
  > SafeAreaProvider
    > LanguageProvider        (i18n: EN + TR, AsyncStorage persisted)
      > MoodProvider          (currentProfile, filters, lastMoodText)
        > SubscriptionProvider (RevenueCat tier, quota)
          > ThemeProvider
            > Stack           (Expo Router)
```

### 3.3 State Management

**Context-based** (Redux/Zustand yok):

| Context | Sorumluluk | Key State |
|---------|-----------|-----------|
| `MoodContext` | Mood analiz sonucu, filtreler | `currentProfile`, `filters`, `lastMoodText`, `lastSessionFilms` |
| `LanguageContext` | Dil secimi, ceviri | `locale`, `t()` fonksiyonu |
| `SubscriptionContext` | Abonelik durumu, kota | `tier`, `isActive`, `checkQuota()` |

**AsyncStorage** (local persistence):
- Gunluk kota sayaclari (`quota_{userId}_{type}_{date}`)
- Daily pick cache (`daily_match_v1_{userId}_{date}`)
- AI tercihleri (energy/pace/depth sliders)
- Dil secimi (`moodflix_language`)
- Onboarding tamamlandi flag'i

---

## 4. Core Data Flow

### 4.1 Mood-to-Film Pipeline

```
Kullanici mood yazar ("yagmurlu bir aksam icin sicak bir sey")
  |
  v
mood.tsx: state = 'input' -> "Find My Movie" butonuna basar
  |
  v
quotaEngine.checkAndConsumeQuota() — AsyncStorage + RevenueCat tier check
  |  [kota asildiysa -> paywall.tsx'e redirect]
  v
Edge Function: parse-mood
  |  POST /functions/v1/parse-mood
  |  Body: { mood_text, locale }
  |  -> Claude API (Anthropic SDK)
  |  -> 12 boyutlu TasteProfile JSON doner
  |  -> mood_searches tablosuna INSERT (searchId uretir)
  |  -> Tematik keyword extraction (search_keywords)
  v
MoodContext.setMoodResult(profile, filters)
  |  state = 'processing' -> AIProcessingOverlay animasyonu
  v
state = 'result' -> MoodProfileResult gosterilir
  |
  v
"Browse Movies" -> navigate('/discover')
  |
  v
useFeedManager hook aktif olur:
  1. Preload cache kontrol (recommendationPreload.ts)
  2. tasteProfileToVector() -> 384-dim vektor
  3. match_films_v3 RPC (hybrid: mood vector + user vector)
  4. Progressive filter relaxation (4 deneme)
  5. LLM reranker (ilk batch, tematik mood'larda)
  6. Quality gate (relative score filter + 8 film cap)
  7. SwipeCardStack'e filmler yuklenir
  |
  v
Swipe Right -> watchlist INSERT + user vector guncelleme
Swipe Left  -> skip (user vector guncelleme)
Session end -> 8 film gosterilince MoodDeckSummary
```

### 4.2 Vector Encoding Sistemi

**Tek Kaynak:** `services/vectorEncoder.ts` — Baska hicbir dosyada vektor kodlama yapilmaz.

**384-dim vektor layout:**

| Segment | Indeks Araligi | Boyut | Kodlama |
|---------|---------------|-------|---------|
| emotional_state | 0-63 | 64 | 8 duygu x 8 tekrar (surekli [0,1]) |
| energy_level | 64-71 | 8 | Surekli deger x 8 tekrar |
| pace_preference | 72-95 | 24 | One-hot (slow/medium/fast) x 8 |
| visual_style | 96-135 | 40 | One-hot (5 stil) x 8 |
| thematic_depth | 136-143 | 8 | Surekli deger x 8 tekrar |
| ending_preference | 144-183 | 40 | One-hot (5 tercih) x 8 |
| era_preference | 184-199 | 16 | Normalize yil araligi x 8 |
| cultural_context | 200-239 | 40 | Bloom-filter hash |
| avoid_signals | 240-279 | 40 | Bloom-filter hash |
| narrative_style | 280-311 | 32 | One-hot (4 stil) x 8 |
| social_context | 312-343 | 32 | One-hot (4 durum) x 8 |
| rewatch_tolerance | 344-351 | 8 | Boolean x 8 tekrar |
| padding | 352-383 | 32 | Sifir dolgusu |

**12 Boyutlu TasteProfile:**

```typescript
interface TasteProfile {
  emotional_state: {
    joy, sadness, anger, fear,
    surprise, disgust, anticipation, trust  // Plutchik modeli
  };
  energy_level: number;           // 0.0 - 1.0
  pace_preference: 'slow' | 'medium' | 'fast';
  visual_style: 'minimalist' | 'cinematic' | 'experimental' | 'lush' | 'raw';
  thematic_depth: number;         // 0.0 - 1.0
  ending_preference: 'hopeful' | 'bittersweet' | 'open' | 'tragic' | 'triumphant';
  era_preference: { from: number; to: number };
  cultural_context: string[];
  avoid_signals: string[];
  narrative_style: 'linear' | 'nonlinear' | 'anthology' | 'dialogue-driven';
  social_context: 'alone' | 'couple' | 'friends' | 'family';
  rewatch_tolerance: boolean;
}
```

### 4.3 Recommendation Pipeline (3 Nesil)

**match_films v1:** Temel pgvector cosine similarity
**match_films v2:** + per_director_cap (3) + curation tier boost + archive penalty
**match_films v3 (aktif):** + hybrid (mood vector + user preference vector blend) + keyword boost + exclude_archive

**Hybrid Blend Mekanigi:**
- Yeni kullanici (< 6 sinyal): `mood_weight=1.0, user_weight=0.0` (mood-only)
- 6+ sinyal: dinamik agirlik hesabi (signals arttikca user_weight artar)
- User vector: swipe davranislari + calibration birikimi (Edge Function recompute)

**LLM Re-ranker:**
- Sadece ilk batch'te + tematik keyword varsa calisir
- `rerank-films` Edge Function -> Claude API
- Vektor uzayinin yakalayamadigi kavramsal anlami doldurur
- 8 saniye timeout, fail durumunda orijinal siralamaya doner

**Progressive Filter Relaxation (4 Deneme):**
1. Strict: similarity >= 0.45, rating >= user_filter, era filtresi
2. Rating gevsetme: similarity >= 0.42, rating >= 6.0
3. Era kaldir: similarity >= 0.40, rating >= 5.5
4. Son sans: similarity >= 0.38, filtre yok

**Quality Gate:**
- Relative score floor: en iyi skorun %55'inin altini eliyor
- Final cap: maksimum 8 film (quality > quantity)

### 4.4 Archetype Engine

12 sinefil arketip, ağırlıklı özellik skoru ile hesaplanır:

| ID | Arketip | Baskin Ozellikler |
|----|---------|------------------|
| 1 | Adrenalin Bagimlisi | Yuksek enerji, hiz, korku, ham gorsel |
| 2 | Zihin Bukucu | Derin tema, surpriz, deneysel, nonlinear |
| 3 | Gozyasi Hirsizi | Uzuntu, yavas, bittersweet/tragic |
| 4 | Gulumseme Avcisi | Neşe, umut, hafif tema, hiz |
| 5 | Umutsuz Romantik | Guven, cift, bittersweet |
| 6 | Karanlik Yolcu | Korku, tiksinti, trajik, yalniz |
| 7 | Gorsel Sair | Estetik (lush), derin, yavas |
| 8 | Nostalji Bekcisi | Eski donem, rewatch, sicak |
| 9 | Kaos Elcisi | Ofke, surpriz, ham, anti-kahraman |
| 10 | Huzur Gezgini | Dusuk enerji, yavas, guven |
| 11 | Gerceklik Dedektifi | Derin, ham, diyalog-odakli |
| 12 | Fantastik Hayalperest | Beklenti, neşe, lush, epik |

**Hesaplama:** `score = sum(weight_i * feature_i) / sum(weight_i)` — en yuksek skor kazanir.
**Esik:** `MIN_SCORE_THRESHOLD = 0.35` altinda arketip atanamaz.

Her arketipin kanonical TasteProfile'i var — cold-start daily pick icin kullanilir.

---

## 5. Veritabani Semasi

### 5.1 Supabase PostgreSQL + pgvector

**50 migration dosyasi** (001-050), kronolojik gelisim.

### 5.2 Ana Tablolar

```sql
-- Kullanicilar
users (
  id UUID PK,
  auth_id TEXT UNIQUE,           -- Supabase Auth UID
  display_name TEXT,
  username TEXT,
  avatar_id INTEGER,
  archetype_id INTEGER,          -- 1-12 sinefil arketip
  preferences_vector vector(384), -- Birikimli kullanici profili
  subscription_tier TEXT,         -- free/monthly/annual/lifetime
  subscription_expires_at TIMESTAMPTZ,
  total_interactions INTEGER,
  onboarding_completed BOOLEAN,
  push_token TEXT,
  created_at, updated_at
)

-- Film katalogu (~2500+ film)
films (
  id UUID PK,
  tmdb_id INTEGER UNIQUE,
  title TEXT,
  year INTEGER,
  poster_url TEXT,
  backdrop_url TEXT,
  overview TEXT,
  genres TEXT[],
  runtime INTEGER,
  vote_average FLOAT,
  director TEXT,
  country TEXT[],
  imdb_id TEXT,
  imdb_rating FLOAT,
  curation_tier TEXT,  -- 'core' | 'extended' | 'archive'
  tmdb_keywords TEXT[],
  metadata_json JSONB,
  created_at, updated_at
)

-- Film profil vektorleri (her film icin 384-dim)
film_profiles (
  id UUID PK,
  film_id UUID FK -> films,
  profile_vector vector(384),    -- Film'in duygu profili
  dimensions_json JSONB,          -- Okunabilir boyutlar
  created_at, updated_at
)

-- Mood arama kayitlari
mood_searches (
  id UUID PK,
  user_id UUID FK -> users,
  mood_text TEXT,
  parsed_profile JSONB,
  search_keywords TEXT[],
  recommended_film_ids UUID[],
  rpc_version TEXT,
  error_code TEXT,
  latency_ms INTEGER,
  token_count INTEGER,
  searched_at TIMESTAMPTZ
)

-- Watchlist
watchlist (
  id UUID PK,
  user_id UUID FK -> users,
  film_id UUID FK -> films,
  added_from_session UUID FK -> sessions,
  mood_text TEXT,
  watched BOOLEAN DEFAULT false,
  created_at
  UNIQUE(user_id, film_id)
)

-- Swipe kayitlari
swipes (
  id UUID PK,
  session_id UUID FK -> sessions,
  film_id UUID FK -> films,
  direction TEXT CHECK ('left'|'right'|'up'),
  timestamp
)

-- Gamification
user_streaks (user_id, current_streak, longest_streak, last_activity_date)
milestones (id, key, threshold, reward_type, reward_value)
user_milestones (user_id, milestone_id, achieved_at)

-- Oyun tablolari
daily_puzzles (id, game_id, puzzle_date, puzzle_data JSONB, ...)
game_scores (id, user_id, puzzle_id, score, completed, attempts, ...)

-- Referral sistemi
referrals (id, referrer_id, referred_id, status, milestone_level, ...)

-- Remote config
app_config (key TEXT PK, value JSONB, ...)

-- Taste signals (user vector recompute icin)
user_taste_signals (id, user_id, signal_type, film_id, weight, ...)
```

### 5.3 Key RPC'ler

| RPC | Amac |
|-----|------|
| `match_films` | v1: temel vektor similarity araması |
| `match_films_v2` | + director cap, tier boost |
| `match_films_v3` | + hybrid blend, keyword boost, archive exclusion |
| `update_streak` | Streak guncelle (gamification) |
| `check_milestones` | Milestone kontrol |
| `get_user_stats` | Profil istatistikleri |
| `get_swipe_history` | Swipe gecmisi |
| `get_watchlist_grouped` | Session'a gore gruplu watchlist |

### 5.4 RLS (Row Level Security)

| Tablo | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| users | Self only (auth_id) | Self | Self | - |
| films | Public | service_role | service_role | - |
| film_profiles | Public | service_role | service_role | - |
| sessions | Owner only | Owner | - | - |
| swipes | Owner (via session) | Owner | - | - |
| watchlist | Owner | Owner | Owner | Owner |
| mood_searches | Owner | Owner | Owner | - |

### 5.5 Indexes

- **IVFFlat** on `film_profiles.profile_vector` (cosine, lists=100) — ana arama index'i
- **IVFFlat** on `users.preferences_vector` (cosine, lists=100) — surprise picks
- **B-tree** on tum FK sutunlari (user_id, session_id, film_id)

---

## 6. Edge Functions (24 Serverless Fonksiyon)

### 6.1 Core AI Pipeline
| Fonksiyon | Amac | Tetikleyici |
|-----------|------|------------|
| `parse-mood` | Mood text -> TasteProfile (Claude API) | Mood arama |
| `parse-taste` | Taste tercihleri -> filtre parametreleri | Calibration |
| `recommend` | Vector + filtre -> film listesi | Discover |
| `explain-match` | Film-mood eslesmesi aciklamasi | Film detay |
| `rerank-films` | LLM ile tematik yeniden siralama | Ilk batch |
| `recompute-user-vector` | Taste signals -> preferences_vector | Cron / trigger |

### 6.2 Monetization
| Fonksiyon | Amac |
|-----------|------|
| `check-quota` | Sunucu tarafli kota kontrol |
| `revenuecat-webhook` | RC event isleme |
| `process-lifetime-purchase` | Lifetime satis + founding member |
| `lifetime-counter` | Kalan lifetime slot sayaci |
| `winback-sequencer` | Churned user re-engagement |

### 6.3 Engagement
| Fonksiyon | Amac |
|-----------|------|
| `schedule-notifications` | Push bildirim zamanlama |
| `send-notifications` | Push bildirim gonderme |
| `send-daily-pick` | Gunluk film onerisi push |
| `watchlist-activation` | Watchlist hatirlatma push |
| `process-referral` | Referral milestone isleme |
| `sync-trending` | Haftalik trending film senkron |

### 6.4 Game Backend
| Fonksiyon | Amac |
|-----------|------|
| `curate-posterle` | Posterle puzzle uretimi |
| `get-posterle` | Gunluk puzzle getir |
| `submit-posterle` | Puzzle sonuc kaydi |
| `slot-pure-random` | Slot random secim |
| `slot-mood-filtered` | Slot mood-filtrelenmiş |
| `slot-triple` | Slot uclu esleme |

### 6.5 Hesap Yonetimi
| Fonksiyon | Amac |
|-----------|------|
| `delete-account` | GDPR uyumlu hesap silme |

---

## 7. Abonelik & Monetization

### 7.1 Plan Yapisi

| Tier | Fiyat | Gunluk Arama | Game/Oyun | Watchlist | Slot |
|------|-------|-------------|-----------|-----------|------|
| Free | $0 | 3 | 1/oyun | 30 film | 8 |
| Monthly | $6.99/ay | 15 | Sinirsiz | Sinirsiz | Sinirsiz |
| Annual | $39.99/yil | 25 | Sinirsiz | Sinirsiz | Sinirsiz |
| Lifetime | $89.99 (tek) | 50 | Sinirsiz | Sinirsiz | Sinirsiz |

**Lifetime siniri:** Ilk 1000 adet (Founding Member)

### 7.2 RevenueCat Entegrasyonu

- **Entitlements:** `chosy_plus` (monthly/annual), `chosy_lifetime`
- **Offerings:** `default` (main paywall), `lifetime_founding` (founding member)
- **Webhook:** Supabase Edge Function (`revenuecat-webhook`)
- **Product ID'leri:** `com.chosy.monthly`, `com.chosy.annual`, `com.chosy.lifetime`
- **Eski ID uyumlulugu:** `chosyai_weekly` -> `weekly_legacy`

### 7.3 Kota Sistemi

**Client-side (V3):** RPC bypass — AsyncStorage sayac + RevenueCat tier detection.

```
checkAndConsumeQuota(userId, 'search')
  1. getTierFromRevenueCat() -> tier
  2. TIER_LIMITS[tier].dailySearchLimit -> limit
  3. AsyncStorage getUsedCount -> used
  4. used >= limit ? { allowed: false } : { allowed: true, increment }
```

**Fail-open strateji:** Hata durumunda kullaniciyi kilitlemez (engagement > enforcement).

### 7.4 Referral Programi

Milestone bazli odul:
- 1 davet: 1 hafta premium
- 3 davet: ekstra arama hakki
- 5 davet: 1 ay premium
- 10 davet: lifetime upgrade

---

## 8. Tasarim Sistemi ("Premium Bumble")

### 8.1 Felsefe
Bumble'in bagimlilik yaratan swipe UX'i + sinema-derece premium estetik. Cebinizdeki luks sinema salonu.

### 8.2 Renk Paleti

**Core:**
- `#0A0A0A` (zinc-950) — App background
- `#18181B` (zinc-900) — Card surfaces
- `#27272A` (zinc-800) — Elevated UI

**Accent (Dual System):**
- `#8B5CF6` (violet-500) — Primary CTA, aktif tab, ana etkilesimler
- `#D4A843` (gold) — Rating, premium badge, ozel highlight

**Semantic:**
- `#22C55E` (green) — Swipe right / watchlist add
- `#EF4444` (red) — Swipe left / skip
- `#3B82F6` (blue) — Izlendi isareti

### 8.3 Tipografi

| Stil | Font | Boyut | Kullanim |
|------|------|-------|---------|
| Display | PlayfairDisplay | 28-32 | Film detay basligi (TEK YER) |
| H1 | Inter | 24 Bold | Ekran basliklari |
| H2 | Inter | 20 SemiBold | Section header |
| Body | Inter | 14 Regular | Ana icerik |
| Caption | Inter | 12 | Meta bilgi |
| Rating | PlayfairDisplay | 16 Bold | Film puani (gold) |

**Kural:** Inter is kaldir. PlayfairDisplay SADECE film basligi ve rating numarasi icin. Butonlarda, labellarda veya body text'te ASLA.

### 8.4 Component Spec'leri

**SwipeCard:**
- Tam poster, 3:4 aspect ratio, ekranin ~%85'i
- Alt %40 gradient: transparent -> bg-primary
- 2 kart arka plan: scale(0.95) + scale(0.90), blur(2px)
- Swipe overlay: yesil "+" / kirmizi "x" / mavi goz (0->0.3 opacity)

**Tab Bar:**
- 4 tab: Home / Mood / Watchlist / Profile
- Aktif: violet-500 icon (filled) + 11px bold label
- Pasif: zinc-500 icon (outline), label yok
- Height: 83px, position: absolute
- **Her ekranda `paddingBottom: 83` zorunlu**

**Animasyon Standartlari:**
- Swipe takip: 1:1 parmakla, rotation = distance x 0.08 (max 12 derece)
- Swipe esigi: 120px yatay, 100px dikey
- Haptic: light (swipe baslangic), medium (esik gecisi), heavy (aksiyon)
- Skeleton shimmer: 1.5s sonsuz pulse

### 8.5 Ikon Sistemi
69 custom PNG ikon — `assets/icons/` klasorunde, `constants/icons.ts`'den register ediliyor.

Kategoriler: EmotionIcons, ArchetypeIcons, MoodIcons, AvatarIcons, GamificationIcons, CalibrationIcons, TasteDNAIcons

---

## 9. Oyun Sistemi (V1.1 — 3 Oyun)

### 9.1 Altyapi
- `services/gameService.ts` — puzzle fetch, score submit, streak
- `services/gameTypes.ts` — shared types
- `components/games/GameShell/` — ortak wrapper (header, progress, actions)
- `components/games/ResultCard/` — sonuc + share + streak
- Supabase: `daily_puzzles` + `game_scores` tablolari

### 9.2 Oyunlar

**Imposter (Sahtekar):**
- Film afisi + 4 oyuncu ismi (3 gercek, 1 sahte)
- Tek hak — yanlis = oyun biter, ekran kirmizi
- Sahte oyuncu: ayni genre/donem filmlerden benzer taninirlik

**5 Ipucu (Pinpoint):**
- 5 ipucu: en soyuttan en somuta
- Her yanlis tahminde sonraki ipucu acilir
- Film arama/autocomplete input
- "Kusursuz Tahmin" rozeti

**Replik Tahmin:**
- 100+ curated film repligi (movieQuotes.ts)
- 4 deneme hakki: replik + 3 ipucu
- Film arama/autocomplete

### 9.3 Kota
- Free: gunluk 1 oyun/tur
- Premium: sinirsiz
- **Fail-open:** Hata durumunda oyun engagement oncelikli

---

## 10. Servis Katmani

### 10.1 Service Dosyalari

| Dosya | Sorumluluk |
|-------|-----------|
| `recommendations.ts` | Vector matching orchestra (1372 satir) |
| `vectorEncoder.ts` | 384-dim vektor kodlama TEK KAYNAK |
| `supabase.ts` | Supabase client init |
| `watchlist.ts` | Watchlist CRUD |
| `quotaEngine.ts` | Client-side kota (AsyncStorage + RC) |
| `subscriptionService.ts` | Abonelik state yonetimi |
| `purchaseService.ts` | RevenueCat satin alma islemleri |
| `dailyMatch.ts` | Gunluk film onerisi (cache + RPC) |
| `archetypeEngine.ts` | 12 arketip skorlama + kanonical profiller |
| `gamification.ts` | Streak + milestones |
| `authService.ts` | Apple Sign-In |
| `homeService.ts` | Home screen data aggregation |
| `tasteParser.ts` | Mood text -> TasteProfile (rule-based fallback) |
| `gameService.ts` | Oyun puzzle/skor CRUD |
| `posthog.ts` | Analytics wrapper |
| `remoteConfig.ts` | Feature flags (Supabase app_config) |
| `userVectorRefresh.ts` | User vector recompute + blend hesabi |
| `moodSearchState.ts` | Module-level searchId/keyword store |
| `recommendationPreload.ts` | Preload cache |
| `tasteSignalService.ts` | Swipe/search sinyalleri kaydi |
| `userProfile.ts` | User vector guncelleme |
| `pushNotifications.ts` | Push bildirim yonetimi |

### 10.2 Hooks

| Hook | Sorumluluk |
|------|-----------|
| `useFeedManager` | Sonsuz film akisi (batch load, preload, swipe handling, phase transitions) |

---

## 11. i18n (Lokalizasyon)

- **Paketler:** `expo-localization`, `i18n-js`
- **Desteklenen diller:** EN (varsayilan), TR
- **Dosyalar:** `locales/en.json`, `locales/tr.json`
- **Provider:** `LanguageContext` — `t(key, options?)` fonksiyonu
- **Kural:** Hardcoded string YASAK — tum UI metinleri `t('key')` uzerinden
- **expo-localization dogrudan import YASAK** — crash riski, LanguageContext kullan

---

## 12. App Store Bilgileri

| Alan | Deger |
|------|-------|
| App Name | Chosy.ai - Mood Movie Finder |
| Bundle ID | com.chosy.ai |
| Kategori | Entertainment (Primary), Lifestyle (Secondary) |
| Yas Sinifi | 12+ |
| Fiyat | Free (In-App Purchases) |
| Dil | English (Primary) + Turkish |
| Auth | Apple Sign-In (zorunlu) |
| Privacy Policy | Notion hosted |
| Support | mertkanylmaz@gmail.com |
| EAS Project ID | 5c6d10a4-12a2-42cc-946b-3baecbe3bc5e |

---

## 13. Bilinen Sorunlar ve Teknik Borc

### 13.1 Aktif Sorunlar

| Sorun | Detay | Etki |
|-------|-------|------|
| `match_films` overload | Yeni overload olusturma YASAK — mevcut imza ile calis | Migration conflict riski |
| Pre-existing TS hatalari | `supabase/functions/`, `ExternalLink.tsx`, `SkeletonLoader`, `watchlist.tsx:122,144` | Build uyarisi, dokunma |
| Google Sign-In | Stub durumda — native rebuild gerekli | V1.1+ icin degerlendirilecek |
| Weekly plan legacy | Eski `chosyai_weekly` product ID geriye uyumluluk | Plan migration gerekebilir |
| Mood searches UPDATE silent fail | RLS + JWT expire race condition — ensureAuthSession() ile workaround | Telemetri kaybi riski |

### 13.2 Kritik Import Kurallari

```typescript
// DOGRU
import { Colors } from '@/constants/Colors'          // Buyuk C — kucuk c crash!
import { Theme } from '@/constants/theme'
import * as watchlist from 'services/watchlist'       // watchlistService.ts DEGIL
import { encodeVector } from 'services/vectorEncoder' // Tek kaynak

// YANLIS / CRASH RISKI
import { Colors } from '@/constants/colors'          // CRASH!
import { something } from 'expo-localization'        // CRASH! LanguageContext kullan
```

### 13.3 Teknik Borc

- 50 migration dosyasi — schema refactor veya squash potansiyeli
- `recommendations.ts` 1372 satir — service katmanina bolunebilir
- Remote config (app_config) lazy getter pattern — her cagri memoryCache okuyor
- Module-level state (`moodSearchState.ts`) — React state yerine global store
- AsyncStorage-bazli kota sistemi — manipulasyona acik (client-side)
- Curation tier sistemi (core/extended/archive) — 1453 archive film exclude ediliyor
- JS fallback recommendation engine — RPC basarisiz olursa client-side scoring (kalitesiz)

---

## 14. Gelistirme Kurallari

### 14.1 Kod Standartlari
- TypeScript strict — `any` YASAK
- Fonksiyonel component — class component YASAK
- Her component: `ComponentName/index.tsx` + `styles.ts` (ayri klasor)
- `StyleSheet.create` zorunlu — inline style YASAK
- `Theme.xxx` kullan (spacing, borderRadius, typography, shadow)
- `console.log` birakma — `utils/logger.ts` kullan
- JSDoc: her fonksiyon ve component ustune yorum
- Import sirasi: React > kutuphaneler > yerel (aralarinda bos satir)

### 14.2 Build
- `expo-dev-client` kullan — Expo Go DEGIL
- EAS Build profilleri: development, preview, production
- Platform: iOS oncelikli (Android V1.3'te planli)

### 14.3 Test
- `tests/recommendation-quality/` — oneri kalite testleri
- `tests/founder-acceptance/` — founding member acceptance testleri
- `scripts/lint-remote-config.ts` — remote config lint
- `scripts/lint-optimistic-ui.ts` — optimistic UI lint

---

## 15. Roadmap

### V1.1 (Aktif — Mini Games) ✅ Implementasyon tamam, release bekliyor
- 3 oyun: Imposter, 5 Ipucu, Replik Tahmin
- Games Hub + Home widget
- Share + streak tracking

### V1.2 (Planli — Streaming & Visual Games)
- TMDB watch/providers entegrasyonu ("Nerede izlerim?")
- Pikselli Afis oyunu (#4)
- Renk Paleti oyunu (#5)
- Push bildirimler (gunluk oyun + streak uyari)

### V1.3 (Planli — Deep Games & Social)
- Kare Kare oyunu (#6)
- Film Zinciri oyunu (#7)
- Arkadas ekleme, liste paylasma
- Android launch

### Backlog
- Landing page (chosy.ai)
- Letterboxd/IMDb import
- iOS Widget
- Apple Watch companion
- AI sohbet modu
- Leaderboard
- Affiliate revenue

---

## 16. Proje Metrikleri (Yatirimci SQL Sorgulari)

Hazir SQL sorgulari `docs/INVESTOR_METRICS.md`'de:
- User Growth: total users, MAU, DAU, DAU trend, new users/gun
- Revenue: paid users by tier, conversion rate, MRR, ARR, lifetime sales
- Engagement: avg searches/gun, avg games/gun, swipe like rate, watchlist size
- Retention: D1, D7, D30 retention, cohort retention curve
- Viral: K-factor, referral funnel, top referrers
- Games: plays per type, unique players, avg score, completion rate

---

## 17. Dizin Yapisi

```
moodflix/
  app/                     -> Expo Router sayfalar
  components/              -> UI component'ler (klasor bazli)
  constants/               -> Colors, Theme, Archetypes, Icons, i18n, subscriptions
  contexts/                -> React Context'ler (Mood, Language, Subscription)
  hooks/                   -> Custom hooks (useFeedManager)
  services/                -> Business logic (recommendations, watchlist, quota, etc.)
  types/                   -> TypeScript tip tanimlari
  utils/                   -> Yardimci fonksiyonlar (logger, filmFilters, errorHelpers)
  assets/                  -> Gorseller, ikonlar, fontlar
  locales/                 -> en.json, tr.json
  scripts/                 -> Film fetch, profiling, seed, lint
  tests/                   -> Kalite testleri
  supabase/
    migrations/            -> 50 SQL migration (001-050)
    functions/             -> 24 Edge Function
  docs/                    -> Dokumantasyon
  .claude/                 -> Agent brief'leri
  plugins/                 -> Expo config plugins
```

---

*Bu rapor 19 Temmuz 2026 tarihinde proje kaynak kodundan otomatik olarak cikarilmistir.*
