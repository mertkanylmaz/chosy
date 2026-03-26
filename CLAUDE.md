# MoodFlix — Proje Kuralları (v3)

## Proje Nedir
Duygu ve kişisel deneyim tabanlı film öneri uygulaması.
Kullanıcı serbest metin yazar, AI bunu 12 boyutlu profile çevirir,
pgvector ile en uygun filmleri bulur, TikTok+Tinder hibrit kartlarla sunar.

> **Not:** App store görünen adı `Chosy.ai` (app.config.ts / app.json), kodda
> ve iletişimde proje `MoodFlix` olarak anılır.

---

## Tech Stack
- **Mobil:** React Native 0.83.2 + Expo SDK 55 (managed workflow)
- **Router:** Expo Router v7 (file-based routing, `expo-router: ~55.0.4`)
- **Runtime:** React 19.2.0
- **Backend:** Supabase (PostgreSQL + pgvector + Auth + Edge Functions)
- **AI:** Claude API (`@anthropic-ai/sdk: ^0.78.0`) — MVP'de rule-based fallback
- **Navigasyon:** Bottom Tab (4 sekme: Feed, Watchlist, Mood, Profile)
- **Animasyon:** react-native-reanimated **v4.2.1** + react-native-gesture-handler ~2.30.0
- **Haptic:** expo-haptics ~55.0.8
- **Dış API:** TMDb API (film verileri)
- **i18n:** i18n-js + expo-localization (İngilizce varsayılan, Türkçe opsiyonel)
- **Build:** Development build kullan (`expo-dev-client`), Expo Go değil

---

## Kod Kuralları
- TypeScript kullan, `any` tipi YASAK
- Fonksiyonel component yaz, class component YASAK
- Her component kendi klasöründe: `ComponentName/index.tsx` + `styles.ts`
- Dosya isimleri: componentler PascalCase, yardımcılar camelCase
- Import sırası: React → kütüphaneler → yerel dosyalar (aralarında boş satır)
- Her fonksiyon ve component üstüne JSDoc yorum yaz
- Console.log bırakma; `utils/logger.ts` kullan (`__DEV__` kontrolü içeride)
- Hata yönetimi: try-catch ile sarma, kullanıcıya anlamlı mesaj göster
- Stil: `StyleSheet.create` kullan, inline style YASAK
- Tüm sabit metinler i18n üzerinden (`locales/en.json`, `locales/tr.json`)
- `Theme.xxx` kullan — `Radius`, `Spacing`, `Typography`, `Shadows` **@deprecated**

---

## Klasör Yapısı (Gerçek — Mart 2026)

```
moodflix/
├── app/                              # Expo Router sayfaları
│   ├── (tabs)/                       # Tab navigasyon grubu
│   │   ├── _layout.tsx               # Bottom tab bar (4 sekme, animasyonlu)
│   │   ├── index.tsx                 # Feed — film discovery (TikTok+Tinder)
│   │   ├── watchlist.tsx             # Watchlist — kaydedilen filmler
│   │   ├── mood.tsx                  # Mood girişi + filtreler + AI + sonuç
│   │   └── profile.tsx               # Profil + istatistikler + dil seçimi
│   ├── film/
│   │   └── [id].tsx                  # Film detay (slide_from_bottom)
│   ├── +html.tsx                     # Web HTML wrapper
│   ├── +not-found.tsx                # 404 handler
│   ├── _layout.tsx                   # Root layout — font + auth + providers
│   ├── entry.tsx                     # Entry router — onboarding kontrolü
│   ├── gate.tsx                      # İlk rota bekçisi
│   ├── modal.tsx                     # Modal ekran
│   ├── onboarding.tsx                # İlk kullanım (bir kez gösterilir)
│   └── splash.tsx                    # Splash screen
│
├── components/                       # Paylaşılan UI componentleri
│   ├── AIProcessingOverlay/          # AI analiz overlay (index.tsx + styles.ts)
│   ├── EmptyState/                   # Boş feed durumu (index.tsx + styles.ts)
│   ├── Entry/                        # Onboarding entry componentleri
│   │   ├── EmotionalHook/            # Duygusal bağlantı adımı
│   │   ├── InstantGratification/     # Anında ödül adımı
│   │   └── InteractiveStart/         # Etkileşimli başlangıç adımı
│   ├── ErrorState/                   # Hata durumu (index.tsx)
│   ├── FeedbackModal/                # Film geri bildirim modalı (index.tsx + styles.ts)
│   ├── FilmDetail/                   # Film detay içeriği (index.tsx + styles.ts)
│   ├── FilterChips/                  # Parametre filtre chip'leri (index.tsx + styles.ts)
│   ├── Lumi/                         # AI karakter animasyonu
│   │   ├── index.tsx                 # Lumi ana component
│   │   ├── LumiParticles.tsx         # Parçacık animasyonu
│   │   └── styles.ts
│   ├── MoodInput/                    # Mood yazma alanı + emoji (index.tsx + styles.ts)
│   ├── MoodProfileResult/            # Mood profil sonuç kartları (index.tsx + styles.ts)
│   ├── Profile/                      # Profil ekranı alt componentleri
│   │   ├── AIControls/               # AI ayar kontrolleri
│   │   ├── DiscoveryStats/           # Keşif istatistikleri
│   │   ├── MoodTimeline/             # Mood geçmişi zaman çizelgesi
│   │   ├── SwipeIntelligence/        # Swipe analitik
│   │   ├── TasteDNA/                 # Zevk DNA görselleştirme
│   │   ├── TonightPick/              # Bu geceye öneri
│   │   └── WatchlistPreview/         # Watchlist özet
│   ├── SkeletonLoader/               # Yükleme placeholder (index.tsx + styles.ts)
│   ├── StaggeredFilmCard/            # Kademeli animasyonlu kart (index.tsx)
│   ├── SurpriseCard/                 # Sürpriz film kartı (index.tsx + styles.ts)
│   ├── SwipeCard/                    # Swipe kart sistemi
│   │   ├── index.tsx                 # Ana export
│   │   ├── SwipeableCard.tsx         # Tek kart + gesture
│   │   ├── SwipeCardStack.tsx        # Kart yığını
│   │   └── styles.ts
│   ├── ExternalLink.tsx
│   ├── SkeletonLoader/
│   ├── StyledText.tsx
│   └── Themed.tsx
│
├── services/                         # API ve iş mantığı
│   ├── cache.ts                      # Response önbelleği
│   ├── entryService.ts               # Entry/onboarding mantığı
│   ├── feedback.ts                   # Geri bildirim gönderme
│   ├── index.ts                      # Servis export'ları
│   ├── matchExplanation.ts           # Eşleşme skoru açıklama
│   ├── profileService.ts             # Kullanıcı profil yönetimi
│   ├── recommendationStore.ts        # Öneri önbelleği
│   ├── recommendations.ts            # Vektör eşleştirme + filtreler
│   ├── supabase.ts                   # Supabase client init
│   ├── tasteParser.ts                # Mood → 12 boyutlu profil (rule-based)
│   ├── tmdb.ts                       # TMDb API entegrasyonu
│   ├── userProfile.ts                # Kullanıcı tercih vektörü
│   ├── vectorEncoder.ts              # Profil → 384 boyut vektör (TEK KAYNAK)
│   └── watchlist.ts                  # Watchlist CRUD (NOT: watchlistService.ts değil)
│
├── contexts/                         # React context'ler
│   ├── LanguageContext.tsx           # i18n — LanguageProvider + useLanguage()
│   └── MoodContext.tsx               # Mood profil + filtreler — MoodProvider + useMood()
│
├── hooks/                            # Custom React hook'lar
│   ├── index.ts
│   ├── useFeedManager.ts             # Feed state + sayfalama + preload
│   ├── useFeedState.ts               # Feed yükleme durumları
│   ├── useHybridSwipe.ts             # Swipe gesture mantığı (reanimated worklet)
│   ├── useScalePress.ts              # Buton basma animasyonu
│   └── useStaggeredEntry.ts          # Kademeli giriş animasyonu
│
├── types/                            # TypeScript tip tanımları
│   ├── index.ts                      # Film, TasteProfile, Session, FilmFilters, Swipe, WatchlistItem
│   ├── film.ts                       # Film'e özgü tipler
│   └── profile.ts                    # Profil'e özgü tipler
│
├── constants/                        # Sabitler
│   ├── Colors.ts                     # Renk paleti (named export: Colors)
│   ├── animations.ts                 # BOUNCE_CONFIG, SPRING_CONFIG, FAST_TIMING
│   ├── config.ts                     # API URL'leri (env'den okur)
│   ├── i18n.ts                       # i18n instance + Locale tipi
│   ├── index.ts
│   └── theme.ts                      # Theme objesi (spacing, borderRadius, typography, shadow)
│
├── locales/                          # Çeviri dosyaları
│   ├── en.json                       # İngilizce (~8.8 KB)
│   └── tr.json                       # Türkçe (~9 KB)
│
├── utils/                            # Yardımcı fonksiyonlar
│   ├── filmFilters.ts                # Filtre yardımcı fonksiyonları
│   ├── haptics.ts                    # Haptic tetikleyiciler (light, medium, strong)
│   ├── logger.ts                     # Debug loglama (__DEV__ kontrolü)
│   └── index.ts
│
├── scripts/                          # Veri pipeline script'leri
│   ├── fetch-films.ts                # TMDb'den film çek
│   ├── profile-films.ts              # Filmleri profilleştir
│   ├── enrich-films.ts               # Film verisi zenginleştir
│   └── seed-database.ts              # Supabase'e aktar
│
├── supabase/
│   ├── functions/                    # Edge Functions
│   │   ├── explain-match/index.ts    # Eşleşme açıklama
│   │   ├── parse-mood/index.ts       # Mood metin parsing
│   │   ├── parse-taste/index.ts      # Zevk profili parsing
│   │   ├── recommend/index.ts        # Film öneri
│   │   └── _shared/rateLimit.ts      # Rate limiting yardımcısı
│   └── migrations/                   # Veritabanı migrasyonları
│       ├── 001_initial_schema.sql
│       ├── 002_feedback.sql
│       ├── 002_match_films.sql
│       ├── 003_fix_match_films_security.sql
│       ├── 004_match_films_filtered.sql
│       ├── 005_enrich_films_columns.sql
│       ├── 006_custom_lists.sql
│       ├── 007_add_total_interactions.sql
│       └── 008_security_rls_update.sql
│
├── assets/
│   ├── fonts/
│   ├── images/
│   └── lumi/                         # Lumi karakter görselleri
│
├── data/                             # Pipeline çıktı dosyaları
│   ├── films-raw.json
│   ├── films-profiled.json
│   └── films-errors.json
│
├── design-reference/                 # UI tasarım görselleri (9 ekran)
├── logs/                             # Log dosyaları
├── .env                              # Gizli — asla commit etme
├── .env.example                      # Örnek env şablonu
├── app.config.ts                     # Expo dinamik config (Chosy.ai / env okur)
├── app.json                          # Expo statik metadata
├── babel.config.js
├── eas.json                          # EAS build profilleri
└── tsconfig.json                     # TypeScript strict mode
```

---

## Tasarım Sistemi (v3 — Gerçek Token'lar)

### Design Token Kaynakları
- **Renkler:** `import { Colors } from '@/constants/Colors'`
- **Tema (spacing/radius/tipografi/gölge):** `import { Theme } from '@/constants/theme'`
- **Animasyon:** `import { BOUNCE_CONFIG, SPRING_CONFIG, FAST_TIMING } from '@/constants/animations'`

### Renk Paleti (`Colors.*`)
```
Colors.background       '#0A0E27'                    — koyu lacivert (gradient başı)
Colors.backgroundGradient '#0D1B2A'                  — gradient sonu
Colors.card             'rgba(26,31,53,0.8)'          — yarı şeffaf kart yüzeyi
Colors.cardSolid        '#1A1F35'                     — opak kart yüzeyi
Colors.cardBorder       'rgba(212,168,67,0.15)'       — soluk altın kart kenarlığı
Colors.gold             '#D4A843'                     — birincil altın vurgu
Colors.goldDark         '#B8922D'                     — koyu altın
Colors.goldLight        '#F0D78C'                     — açık altın
Colors.goldMid          '#C8A050'                     — orta altın
Colors.goldDim          'rgba(212,168,67,0.12)'       — soluk altın arka plan
Colors.textWhite        '#FFFFFF'                     — birincil metin
Colors.textGrey         '#8A8290'                     — ikincil metin
Colors.textLightGrey    '#B0A8B9'                     — açık gri metin
Colors.imdbYellow       '#F5C518'                     — IMDb badge
Colors.success          '#4ADE80'                     — başarı yeşili
Colors.error            '#FF4444'                     — hata kırmızısı
Colors.tabBarBg         'rgba(10,14,39,0.95)'         — tab bar arka planı
Colors.tabActive        '#D4A843'                     — aktif tab altın
Colors.tabInactive      '#6A6270'                     — pasif tab gri
Colors.overlay          'rgba(10,14,39,0.95)'         — modal/overlay
Colors.chipActiveBg     '#D4A843'                     — chip aktif arka plan
Colors.chipActiveText   '#0A0E27'                     — chip aktif metin
Colors.chipInactiveBorder '#8A8290'                   — chip pasif kenarlık
Colors.chipInactiveText '#8A8290'                     — chip pasif metin
Colors.inputBg          'rgba(26,31,53,0.5)'          — input arka planı
Colors.inputBorder      'rgba(212,168,67,0.3)'        — input kenarlığı
Colors.white10          'rgba(255,255,255,0.1)'       — %10 beyaz yüzey
Colors.white05          'rgba(255,255,255,0.05)'      — %5 beyaz yüzey
```

### Tema Sabitleri (`Theme.*`)

**Spacing (`Theme.spacing.*`)**
```
xs:4  sm:8  md:12  lg:16  xl:20  xxl:24  xxxl:32
```

**Border Radius (`Theme.borderRadius.*`)**
```
sm:8  md:12  lg:16  xl:20  pill:100
```

**Typography (`Theme.typography.*`)**
```
h1  — fontSize:32, PlayfairDisplay_700Bold
h2  — fontSize:24, PlayfairDisplay_700Bold
h3  — fontSize:18, PlayfairDisplay_700Bold
body    — fontSize:16
bodyGrey — fontSize:14, Colors.textGrey
caption — fontSize:12, Colors.textGrey
gold    — color: Colors.gold
goldBold — fontSize:16, fontWeight:'700', Colors.gold
```

**Shadow (`Theme.shadow.*`)**
```
card — shadowColor:#000, offset:{0,4}, opacity:0.3, radius:8, elevation:5
glow — shadowColor:Colors.gold, offset:{0,0}, opacity:0.4, radius:16, elevation:8
```

### Tipografi
- Başlıklar: `PlayfairDisplay_700Bold` / `PlayfairDisplay_900Black`
- Gövde metin: `Platform.select({ ios:'System', android:'sans-serif' })`
- `@expo-google-fonts/playfair-display` paketi, `app/_layout.tsx`'te `useFonts` ile yüklenir
- 6 ağırlık: 400Regular, 400Italic, 600SemiBold, 700Bold, 700BoldItalic, 900Black

### Tab Bar (Gerçek Implementasyon)
- 4 sekme sırası: **Feed (Home)** → **Watchlist (Bookmark)** → **Mood (Sparkle/Lumi)** → **Profile (Person)**
- Mood sekmesi aktifken: Lumi karakter animasyonu; pasifken: sparkle simgesi
- İkonlar: `expo-symbols` (`SymbolView`) — iOS/Android/Web varyantları
- Aktif tab: `Colors.gold (#D4A843)` + bounce animasyonu (1→1.25→1) + altın dot
- Pasif tab: `Colors.tabInactive (#6A6270)`
- Tab bar: `position:'absolute'`, yükseklik:83, paddingBottom:20, paddingTop:8
- Kenarlık: `Colors.white10` üst çizgi
- İçerik her zaman tab bar'ın üstünde — ekranlarda `paddingBottom` ekle

### Tasarım Referansları
- `design-reference/` klasöründe 9 ekran görseli var
- Yeni ekran tasarlarken bu görselleri birebir referans al
- Piksel uyumu hedefle

---

## Kart Mekanizması (TikTok + Tinder Hibrit)

### Swipe Yönleri
- Aşağı kaydır (DOWN) → sonraki film (TikTok tarzı)
- Sağa kaydır (RIGHT) → watchlist'e ekle
- Sola kaydır (LEFT) → atla

### Swipe Feedback
- Sağa: altın glow + "Saved ✓" overlay, kart sağa tilting
- Sola: gri fade + "Skip" overlay, kart sola tilting
- Aşağı: sonraki film smooth slide up

### Haptic Feedback (`utils/haptics.ts`)
- Her swipe: hafif titreşim (light)
- Watchlist ekleme: orta titreşim (medium)
- Sürpriz film: güçlü titreşim (strong)

### Performans
- Film geçişi < 0.3 saniye
- react-native-reanimated v4 worklet bazlı, 60fps
- Sonraki 2-3 film preload (`hooks/useFeedManager.ts`)
- Image cache: force-cache + fadeDuration: 200

---

## Sonsuz Feed Mantığı

### Aşamalı Keşif (10'ar film blokları)
- Film 1-10: Yüksek eşleşme (similarity > 0.7) — "Tam istediğin filmler"
- Film 11-20: Orta eşleşme (similarity > 0.5) — "Bunları da düşünmemiştim"
- Film 21-30: Düşük eşleşme (similarity > 0.3) — "İlginç keşifler"
- Film 30+: Profil bazlı sürpriz picks — swipe geçmişinden türetilen zevk vektörü

### Sonsuzluk Mekanizması
- 10 film bitince otomatik sonraki 10 yüklenir (`hooks/useFeedManager.ts`)
- Önceki filmlerin ID'leri `exclude_ids` olarak gönderilir
- Her 10'luk blokta similarity eşiği düşer
- 30 film sonrası profil bazlı öneri başlar (mood profilinden bağımsız)

### Sürpriz Kartlar (`components/SurpriseCard/`)
- Her 5-7 filmde bir özel kart:
  - "Hidden Gem 💎" — düşük popülerlik ama yüksek eşleşme
  - "AI thinks you'll love this ⭐" — en yüksek similarity
  - "Unexpected pick 🎲" — farklı türden ama profil uyumlu
- Sürpriz kartların border'ı altın rengi parlasın

### Yeni Mood Seçeneği
- Feed üstünde "New mood" butonu her zaman erişilebilir
- Kullanıcı istediği zaman yeni prompt girebilir
- Yeni prompt → AI Processing → yeni feed başlar (eski sonuçlar temizlenir)

---

## Parametre Sistemi (Scope Daraltma)

### Öncelik Sırası
ÖNCE parametrelerle scope daralt (SQL WHERE), SONRA daraltılmış havuzda vektör similarity çalıştır.

### Filtreler (`mood.tsx` üstünde chip'ler, opsiyonel)
1. Yıl: Classic (pre-1990), 90s, 2000s, 2010s, Recent (2020+), Any
2. IMDb: 7+, 8+, Top 250, Any
3. Bölge: Hollywood, British, French, German, East Asian, Korean, Turkish, Scandinavian, Any
4. Yönetmen: Top 20 listesi + Any

### `match_films` RPC Parametreleri
`query_vector`, `match_count`, `year_from`, `year_to`, `min_rating`, `countries`, `directors`, `exclude_ids`

---

## Ekran Yapısı (Kesinleşmiş)

### 4 Sekme (Tab Sırası Önemli)
1. **Feed** (`index.tsx`): Film kartları — TikTok+Tinder hibrit swipe
2. **Watchlist** (`watchlist.tsx`): Kaydedilen filmler, 2 sütun grid, custom listeler
3. **Mood** (`mood.tsx`): Mood girişi + filtreler + AI Processing + Mood Profile Result + Mood History
4. **Profile** (`profile.tsx`): İstatistikler, TasteDNA, SwipeIntelligence, ayarlar, dil seçimi

### Ayrı Sayfalar
- `film/[id].tsx`: Film detay (slide_from_bottom geçiş)
- `onboarding.tsx`: İlk kullanım (bir kez gösterilir)
- `splash.tsx`: Splash screen
- `entry.tsx`: Onboarding kontrolü — ilk açılışta gate/onboarding'e yönlendirir
- `gate.tsx`: İlk rota bekçisi
- `modal.tsx`: Genel modal ekranı

### ÖNEMLİ: Discover/kartlar ayrı sayfa DEĞİL
- Tüm kart gösterimi **Feed** (`index.tsx`) sekmesinde
- Ayrı bir `discover.tsx` OLMAYACAK, varsa silinecek

---

## Kullanıcı Akışı (Kesinleşmiş)

### Ana Akış
1. Splash → `entry.tsx` → `gate.tsx` → Onboarding (sadece ilk açılış)
2. Mood sekmesi → Filtreler (opsiyonel) + Mood yaz → "Find Movies"
3. AI Processing overlay (`mood.tsx` içinde, 1.5sn animasyon)
4. Mood Profile Result overlay (`mood.tsx` içinde, 4 kart özet)
5. "Browse Movies" → `MoodContext`'e profile kaydet → Feed sekmesine navigate
6. Feed sekmesi: kartları gösterir (10'ar blok, sonsuz feed)
7. Sağa swipe → Watchlist'e eklenir
8. "New mood" butonu (Feed üstünde) → Mood sekmesine geri

### Feed Boş Durumu
- Henüz mood girilmediyse Feed'de:
  "Describe your mood to discover movies" + "Go to Mood" butonu
- `components/EmptyState/` componenti kullanılır

### State Yönetimi
`contexts/MoodContext.tsx`:
```typescript
interface MoodState {
  currentProfile: TasteProfile | null;       // 12 boyutlu profil
  currentFilters: FilmFilters | null;        // Uygulanan filtreler
  presetMoodText: string | null;             // Mood input ön-doldurma
  setMoodResult: (profile, filters) => void; // AI sonrası çağrılır
  clearMood: () => void;                     // Mood sıfırla
  setPresetMoodText: (text) => void;         // Input ön-doldur
}
```
- `app/_layout.tsx` → `MoodProvider` ile sarılı

### Provider Zinciri (`app/_layout.tsx`)
```
GestureHandlerRootView
  → SafeAreaProvider
    → LanguageProvider
      → MoodProvider
        → ThemeProvider
          → Stack
```

### AI Processing ve Mood Profile Result
- Bunlar AYRI SAYFA DEĞİL
- `mood.tsx` içinde conditional render: `state: 'input' | 'processing' | 'result'`
- `processing` → `AIProcessingOverlay` componenti
- `result` → `MoodProfileResult` componenti
- "Browse Movies" → state'i sıfırla, Feed'e navigate

---

## Komponent Durum Tablosu

| Component | Durum | Konum |
|-----------|-------|-------|
| SwipeCard / SwipeCardStack | ✅ Aktif | `components/SwipeCard/` |
| AIProcessingOverlay | ✅ Aktif | `components/AIProcessingOverlay/` |
| MoodInput | ✅ Aktif | `components/MoodInput/` |
| MoodProfileResult | ✅ Aktif | `components/MoodProfileResult/` |
| FilterChips | ✅ Aktif | `components/FilterChips/` |
| FilmDetail | ✅ Aktif | `components/FilmDetail/` |
| Lumi | ✅ Aktif | `components/Lumi/` — tab bar'da + mood ekranında |
| EmptyState | ✅ Aktif | `components/EmptyState/` |
| ErrorState | ✅ Aktif | `components/ErrorState/` |
| FeedbackModal | ✅ Aktif | `components/FeedbackModal/` |
| SurpriseCard | ✅ Aktif | `components/SurpriseCard/` |
| StaggeredFilmCard | ✅ Aktif | `components/StaggeredFilmCard/` |
| SkeletonLoader | ✅ Aktif | `components/SkeletonLoader/` |
| Profile/* (7 alt-component) | ✅ Aktif | `components/Profile/` |
| Entry/* (3 alt-component) | ✅ Aktif | `components/Entry/` |

---

## Mevcut Durum (Mart 2026)
- MVP çalışıyor: mood gir → filmler gelir → swipe → watchlist
- Rule-based film profilleme (Claude API kredisi gelince gerçek profilleme yapılacak)
- 500 film veritabanında, vektörler yüklü
- Anonim auth aktif
- Development build ile test ediliyor
- **UI redesign tamamlandı** (design-reference/ görselleri referans alındı — Mart 2026)
- 4 Supabase Edge Function dağıtılmış: `parse-mood`, `parse-taste`, `recommend`, `explain-match`

### UI Redesign Değişiklikleri (Mart 2026)
- `constants/Colors.ts` — yeni gradient ve glow token'lar eklendi
- `components/AIProcessingOverlay/` — Lumi kaldırıldı, 4 halkalı spiral animasyon
- `components/MoodProfileResult/` — kart tasarımı: icon badge, yeni tipografi, gelişmiş spacing
- `components/SwipeCard/SwipeableCard.tsx` — daire match score, Share/Save label'lı butonlar
- `app/splash.tsx` — 4 halka, altın glow merkez, "MoodFlix" logo
- `app/onboarding.tsx` — altın başlık, buton gölge
- `app/(tabs)/mood.tsx` — history kartı horizontal layout (poster sol)
- `app/(tabs)/watchlist.tsx` — Lumi kaldırıldı, clean header, rounded icon butonlar
- `app/(tabs)/profile.tsx` — mavi gradient header, altın gradient avatar border
- `app/(tabs)/index.tsx` — new mood butonu glow efekti
- `app/(tabs)/_layout.tsx` — tab bar hairline border, label font
- `app/film/[id].tsx` — warm tint backdrop, büyük match dairesi, footer border

---

## 12 Boyutlu Profil Sistemi
1. `emotional_state` — 8 duygu [0-1]: joy, sadness, fear, anger, surprise, disgust, trust, anticipation
2. `energy_level` — 0.0 sakin, 1.0 enerjik
3. `pace_preference` — slow | medium | fast
4. `visual_style` — minimalist, cinematic, experimental, lush, raw
5. `thematic_depth` — 0.0 hafif, 1.0 derin
6. `ending_preference` — hopeful, bittersweet, open, tragic, triumphant
7. `era_preference` — yıl aralığı
8. `cultural_context` — ülke/bölge
9. `avoid_signals` — kaçınılacak temalar
10. `narrative_style` — linear, nonlinear, anthology, dialogue-driven
11. `social_context` — alone, couple, friends, family
12. `rewatch_tolerance` — boolean

Çoklu duygu girdileri AND olarak yorumlanır (OR değil).
Vektör kodlaması: **SADECE** `services/vectorEncoder.ts`, başka dosyada YASAK.

---

## Veritabanı (Supabase)

### Tablolar
- `users`: auth_id, display_name, preferences_vector(384)
- `films`: tmdb_id, title, year, poster_url, overview, genres, director, country, cast_json
- `film_profiles`: film_id FK, profile_vector(384), dimensions_json
- `sessions`: user_id FK, raw_input, parsed_profile_json
- `swipes`: session_id FK, film_id FK, direction
- `watchlist`: user_id + film_id (unique), added_from_session
- `feedback`: user_id, film_id, star_rating, on_point
- `custom_lists`: user_id, name
- `custom_list_films`: list_id FK, film_id (unique per list)

### Migrasyon Durumu (8 dosya, 001–008)
- 001: core tablolar + pgvector
- 002a: feedback tablosu
- 002b: match_films() RPC (not: iki 002 var, çakışma riski)
- 003: match_films güvenlik düzeltmesi
- 004: filtered match_films (yıl, puan, yönetmen, bölge)
- 005: films tablosuna ek sütunlar
- 006: custom_lists
- 007: total_interactions sütunu
- 008: RLS politika güncellemesi

### Auth
- Uygulama açılışında `signInAnonymously()` çağır
- `user_id` her zaman `users` tablosundan al (`auth_id → id` lookup)

### RLS
- Her tabloda aktif
- `films` ve `film_profiles`: herkese okuma
- Diğerleri: `auth.uid()` bazlı sahiplik

---

## Bilinen Sorunlar ve Çözümler

| Sorun | Çözüm | Durum |
|-------|-------|-------|
| `expo-localization` native build gerektirir | `constants/i18n.ts` + `AsyncStorage` ile dil sakla, `LanguageContext` kullan | ✅ Çözüldü |
| TMDb poster URL null gelebilir | `https://image.tmdb.org/t/p/w500/` prefix ekle; null ise placeholder göster | ✅ Çözüldü |
| Watchlist INSERT fazla sütun | Sadece `user_id` ve `film_id` gönder | ✅ Çözüldü |
| `match_films` overload çakışması | Eski imzaları DROP et, tek versiyon bırak | ⚠️ Kontrol gerekebilir |
| Türkçe apostrof (TS hataları) | Backtick veya escape kullan | ✅ Çözüldü |
| Bottom tab bar içeriği kapatır | Her ekranda `paddingBottom: 83` ekle | ✅ Çözüldü |
| Anonim auth yoksa watchlist çalışmaz | `signInAnonymously()` root layout'ta çağrılıyor | ✅ Çözüldü |
| Yeni arama önceki sonuçları karıştırır | `clearMood()` + `exclude_ids` listesi sıfırla | ✅ Çözüldü |
| `source.uri` boş string crash | `poster_url` null/boş ise placeholder Image göster | ✅ Çözüldü |
| `discover.tsx` tab'ı | Bu dosya YOK — feed `index.tsx`'te | ✅ Netleştirildi |
| `watchlistService.ts` import | Doğru dosya: `services/watchlist.ts` | ✅ Netleştirildi |
| `Colors.ts` büyük/küçük harf | `constants/Colors.ts` (büyük C) — import buna göre yap | ✅ Netleştirildi |
| Git: API key | `.env` dosyasına koy, asla koda gömme | ✅ Aktif kural |
| Pre-existing TS hataları | `scripts/`, `supabase/functions/`, `ExternalLink.tsx`, `SkeletonLoader`, `watchlist.tsx:122,144`, `services/` içinde mevcut — yeni kod yazarken dokunma | ⚠️ Mevcut |
