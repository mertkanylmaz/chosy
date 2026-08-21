# CHOSY / MOODFLIX — ENVANTER

> Üretim tarihi: 5 Ağustos 2026 · Sadece okuma denetimi · Branch: `master`

---

## 0. ÖNEMLİ SAPMALAR (önce bunu oku)

| Beklenen | Gerçek |
|---|---|
| `src/services`, `src/screens`, `src/constants` | **`src/` klasörü YOK.** Proje düz kökte: `app/`, `components/`, `services/`, `constants/`, `hooks/`, `contexts/`, `utils/` |
| `films.poster_path`, `films.vote_count` | **Bu kolonlar YOK.** Karşılıkları: `poster_url`, `imdb_votes` / `vote_average` |
| Ayrı "izlenenler" tablosu (`watch_history` vb.) | **Tablo YOK.** İzlendi bilgisi `watchlist.watched_at` kolonunda + cihaz yerelinde AsyncStorage (`chosy_watched_films`) |
| `constants/gameTokens.ts` | **Dosya YOK.** Karşılıkları: `constants/gameThemes.ts` (yeni, untracked) + `constants/gameLayout.ts` |
| CLAUDE.md: "RN 0.83.2 + Expo SDK 55" | package.json: **RN 0.81.5 + expo ^54.0.34** |

---

## 1. YAPI

### supabase/migrations/ — 68 dosya, en yüksek numara **068**

```
001_initial_schema            024_push_notifications        047_paywall_variant_flags
002_feedback                  025_lifetime_tier             048_weekly_trending_schema
003_fix_match_films_security  026_referrals                 049_trending_sync_cron
004_match_films_filtered      027_webhook_columns           050_exclude_archive_match
005_enrich_films_columns      028_imdb_and_curation         051_daily_puzzles_game_system
006_custom_lists              029_search_improvements       052_game_scores_extend
007_add_total_interactions    030_ai_profiling_metadata     053_cinema_dna
008_security_rls_update       031_match_films_v2            054_arcade_runs
009_gamification              032_mood_searches_enrichment  055_game_config_seed
010_watch_history             033_api_rate_limits           056_puzzle_phase_config
011_watchlist_session_rpc     034_match_films_v2_spam_future 057_puzzle_view_strip_imposter
012_auth_profile_fields       035_app_config                058_streak_freeze
013_fix_rls_mood_searches     036_user_taste_signals        059_detective_game
014_fix_fk_references         037_user_vector_refresh       060_daily_chest
015_match_films_randomness    038_match_films_v3            061_progressive_milestones
016_game_tables               039_user_vector_dirty_trigger 062_imposter_confidence_config
017_roulette_picks            040_daily_pick_notifications  063_daily_themes
018_posterle_tables           041_watchlist_activation_...  064_puzzle_view_strip_solution
019_posterle_cron             042_hybrid_activation         065_games_enabled
020_onboarding_completed      043_keyword_boost             066_daily_chest_server
021_quota_system              044_llm_reranker_flag         067_daily_chest_log_fk_fix
022_slot_variants             045_catalog_cleanup           068_dev_reset_allowlist
023_paywall_events            046_era_balance
```

> Not: `010_watch_history.sql` tablo **oluşturmuyor** — sadece `user_swipe_history` VIEW'ı ve
> `get_user_stats`, `get_swipe_history`, `get_mood_timeline` fonksiyonlarını tanımlıyor.

### supabase/functions/ — 31 Edge Function

```
_shared                 get-daily-theme          rerank-films
check-quota             get-posterle             revenuecat-webhook
curate-posterle         lifetime-counter         schedule-notifications
delete-account          parse-mood               send-daily-pick
dev-reset-games         parse-taste              send-notifications
explain-match           process-lifetime-purchase slot-mood-filtered
generate-puzzles        process-referral         slot-pure-random
get-daily-challenge     recommend                slot-triple
get-daily-chest         recompute-cinema-dna     submit-guess
                        recompute-user-vector    submit-posterle
                                                 sync-trending
                                                 watchlist-activation
                                                 winback-sequencer
```

### services/ — 41 dosya (`src/services` değil)

```
analytics.ts          gameApi.ts            profileService.ts     tasteParser.ts
archetypeEngine.ts    gameService.ts        purchaseService.ts    tasteSignalService.ts
authService.ts        gameTypes.ts          pushNotifications.ts  tmdb.ts
auth-utils.ts         gamification.ts       quotaEngine.ts        userProfile.ts
conversion/           history.ts            recommendationPreload.ts userVectorRefresh.ts
dailyMatch.ts         homeService.ts        recommendations.ts    vectorEncoder.ts
entryService.ts       index.ts              recommendationStore.ts watchlist.ts
feedback.ts           lifetimeService.ts    referralService.ts
                      matchExplanation.ts   remoteConfig.ts
                      moodSearchState.ts    roulette.ts
                      offlineQueue.ts       searchFilms.ts
                      posthog.ts            slotService.ts
                                            subscriptionService.ts
                                            supabase.ts
```

### Ekranlar — `app/` (Expo Router, `src/screens` değil)

```
app/_layout.tsx  +html.tsx  +not-found.tsx
app/(tabs)/      _layout · index · mood · profile · watchlist
app/film/[id].tsx
app/games/       _layout · index · cinemetrics · detective · fadein
                 imposter · logline · quoted · spotlight
app/            auth · discover · entry · gate · lifetime · modal · onboarding
                paywall · referral · roulette · setup-profile · watchlist-detail
```

> ⚠️ Eski hafıza notu "`discover.tsx` mevcut değil" **artık geçersiz** — dosya var.

### constants/ — 13 dosya

```
animations.ts  archetypes.ts  Colors.ts  config.ts  gameLayout.ts
gameThemes.ts (untracked)  i18n.ts  icons.ts  index.ts
movieQuotes.ts  quickChips.ts  quotedDatabase.ts  subscriptionPlans.ts  theme.ts
```

### components/games/ — 21 klasör

```
CineMetrics  ConfidenceSelector  DailyChest  DailyRoute  DailyThemeCard
Detective    DnaSummaryCard      DnaXpReveal FilmSearchInput
GameBackdrop (untracked)  GameShell  GameStateView  GlassSurface (untracked)
HintBoard    HubHero  Imposter (ImposterPilot'tan rename)  PlayNextBridge
QuickResult  ResultCard  Spotlight  WhyThisMovie
```

---

## 2. VERİ HAZIRLIĞI

> Sorgular canlı prod DB'ye PostgREST üzerinden (service role) çalıştırıldı.
> `psql` ve aggregate fonksiyonları kapalı olduğu için GROUP BY'lar istemci tarafında hesaplandı.

### 2.1 `curation_tier` dağılımı

| tier | adet | % |
|---|---:|---:|
| archive | 1 528 | 45,0 |
| extended | 948 | 27,9 |
| core | 860 | 25,3 |
| trending | 58 | 1,7 |
| **toplam** | **3 394** | 100 |

> `archive` katmanı `050_exclude_archive_match` ile eşleştirmeden dışlanıyor →
> **öneri havuzu efektif olarak 1 866 film** (core + extended + trending).

### 2.2 `films` eksik veri

| alan | eksik | % |
|---|---:|---:|
| `runtime` | 0 | 0,0 |
| `director` | 510 | 15,0 |
| `poster_url` *(`poster_path` yok)* | 5 | 0,1 |
| `original_language` | 507 | 14,9 |
| `imdb_votes` | 958 | 28,2 |
| `overview` | 0 | 0,0 |
| `year` | 0 | 0,0 |
| **toplam satır** | **3 394** | |

> `director` boşluğu doğrudan `match_films_v2`'nin `per_director_cap` mantığını etkiliyor:
> 510 filmde cap uygulanamıyor.

### 2.3 `film_profiles`

| metrik | değer |
|---|---:|
| toplam satır | 3 393 |
| `profile_vector IS NULL` | **83** |
| vektörsüz oran | %2,4 |
| `films` ile fark | 1 film hiç profil almamış |

> `match_films_v2` `profile_vector IS NOT NULL` filtresi uyguladığı için bu 84 film
> (83 + 1) hiçbir öneride çıkamaz.

### 2.4 Oy dağılımı — `imdb_votes` (istenen `vote_count` kolonu mevcut değil)

`imdb_votes > 0` olan **2 394** film, 5 000'lik dilimler:

| dilim | adet |
|---|---:|
| 0 – 5 000 | 261 |
| 5 000 – 10 000 | 275 |
| 10 000 – 15 000 | 223 |
| 15 000 – 20 000 | 151 |
| 20 000 – 25 000 | 136 |
| 25 000 – 30 000 | 86 |
| 30 000 – 35 000 | 64 |
| 35 000 – 40 000 | 69 |
| 40 000 – 45 000 | 55 |
| 45 000 – 50 000 | 36 |
| **50 000+** | **1 038** |

> Dağılım iki tepeli: katalogın %43'ü 50 000+ oyla "çok bilinen", %11'i 5 000 altı "uzun kuyruk".

### 2.5 `app_config` anahtarları (17)

```
daily_chest_rewards          paywall_lifetime_soldout    streak_freeze_config
daily_theme_config           paywall_profile_upgrade     use_hybrid_recommendation
dev_reset_user_ids           paywall_roulette_limit      use_llm_reranker
dna_config                   paywall_streak_milestone    use_match_films_v2
game_xp_config               paywall_streaming_link
games_enabled                puzzle_phase_config
imposter_confidence_config
```

### 2.6 "Kullanıcının izledikleri" nerede?

**Ayrı bir izleme tablosu yok.** İki yerde tutuluyor:

1. **`watchlist.watched_at`** (timestamp) — `null` değilse izlenmiş sayılıyor.
   - `watchlist` toplam: **318** satır
   - `watched_at IS NOT NULL`: **0**
   - `watched_at IS NULL`: 318
2. **Cihaz yereli** — `services/watchlist.ts:21`, AsyncStorage key `chosy_watched_films`.
   Sunucuya senkron edilmiyor.

> ⚠️ Bulgu: prod'da **hiç izlendi işareti yok**. Ya özellik UI'da tetiklenmiyor
> ya da yalnızca AsyncStorage'a yazılıp DB'ye hiç yansımıyor. Analitik açısından
> "izlendi" sinyali şu an **ölçülemez** durumda.

### 2.7 Diğer tablo sayıları (bağlam)

| tablo | satır |
|---|---:|
| `films` | 3 394 |
| `film_profiles` | 3 393 |
| `users` | 135 |
| `watchlist` | 318 |
| `mood_searches` | 49 |
| `game_scores` | **12** |
| `swipes` | 0 |
| `user_swipe_history` (view) | 0 |

> `game_scores` = 12: Faz 1 ölçüm dönemi için funnel verisi pratikte yok denecek kadar az.

---

## 3. BAĞIMLILIKLAR

| Alan | Paket | Sürüm |
|---|---|---|
| Expo | `expo` | **^54.0.34** (CLAUDE.md "SDK 55" diyor — sapma) |
| React Native | `react-native` | **0.81.5** (CLAUDE.md "0.83.2" diyor — sapma) |
| Animasyon | `react-native-reanimated` | ~4.1.1 |
| Animasyon (worklet) | `react-native-worklets` | 0.5.1 |
| Jest/blur | `expo-blur` | ~15.0.8 |
| **Skia** | `@shopify/react-native-skia` | **KURULU DEĞİL** |
| Görüntü yakalama | `react-native-view-shot` | 4.0.3 |
| Pano | `expo-clipboard` | ~8.0.8 |
| **SecureStore** | `expo-secure-store` | **KURULU DEĞİL** (AsyncStorage 2.2.0 kullanılıyor) |
| İkon | `phosphor-react-native` | ^3.0.6 |
| RevenueCat | `react-native-purchases` | ^10.0.1 |
| Sentry | `@sentry/react-native` | ~7.2.0 |
| PostHog | `posthog-react-native` | ^4.45.15 |

Yardımcılar: `expo-router ~6.0.23`, `react-native-gesture-handler ~2.28.0`,
`react-native-svg 15.12.1`, `expo-haptics ~15.0.8`, `expo-image ~3.0.11`,
`expo-linear-gradient ~15.0.8`, `expo-notifications ~0.32.17`,
`expo-apple-authentication ~8.0.8`, `@react-native-google-signin/google-signin ^16.1.2`.

> Skia yok → paylaşım kartı ve blur efektleri `expo-blur` + `view-shot` ile üretiliyor.
> Yeni `GlassSurface` / `GameBackdrop` bileşenleri de bu ikiliye bağımlı.

---

## 4. KRİTİK İMZALAR

### 4.1 `match_films_v2` (031'de tanımlı, 034'te aynı imzayla yeniden yazıldı)

```sql
public.match_films_v2(
  query_vector     vector(384),
  match_count      integer          DEFAULT 20,
  year_from        integer          DEFAULT NULL,
  year_to          integer          DEFAULT NULL,
  min_rating       double precision DEFAULT NULL,
  countries        text[]           DEFAULT NULL,
  directors        text[]           DEFAULT NULL,
  exclude_ids      uuid[]           DEFAULT NULL,
  min_similarity   double precision DEFAULT NULL,
  per_director_cap integer          DEFAULT 3,
  tier_boost       boolean          DEFAULT false
)
RETURNS TABLE (
  id uuid, tmdb_id integer, title text, year integer,
  poster_url text, backdrop_url text, overview text,
  genres text[], runtime integer, vote_average double precision,
  director text, country text[], similarity double precision,
  dimensions_json jsonb, curation_tier text
)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public
```

- GRANT: `anon` + (031/034'te üç ayrı GRANT bloğu)
- Bayrak: `app_config.use_match_films_v2`
- v3 için ayrı migration var: `038_match_films_v3.sql`

### 4.2 `quotaEngine` çağrı yerleri

| Dosya:satır | Çağrı |
|---|---|
| `app/discover.tsx:43` | import `checkAndConsumeQuota` |
| `app/discover.tsx:165` | `await checkAndConsumeQuota(uid, 'slot')` |
| `app/lifetime.tsx:53` | import `clearQuotaCache` |
| `app/lifetime.tsx:210` | `await clearQuotaCache(uid)` |
| `app/lifetime.tsx:252` | `await clearQuotaCache(uid)` |
| `components/paywalls/PaywallBase/index.tsx:42` | import `clearQuotaCache` |
| `components/paywalls/PaywallBase/index.tsx:199` | `await clearQuotaCache(userId)` |
| `components/paywalls/PaywallBase/index.tsx:253` | `await clearQuotaCache(userId)` |
| `services/authService.ts:27` | import `clearQuotaCache` |
| `services/authService.ts:472` | `await clearQuotaCache(appUserId)` |
| `contexts/SubscriptionContext.tsx:45–51` | import `checkAndConsumeQuota`, `clearQuotaCache`, … |
| `contexts/SubscriptionContext.tsx:323` | `await checkAndConsumeQuota(userId, type)` |
| `contexts/SubscriptionContext.tsx:455` | `clearQuotaCache(uid)` |

> Toplam **5 dosya**, 8 gerçek çağrı. Kota tüketimi iki noktadan: `discover.tsx`
> (slot) ve `SubscriptionContext` (genel). Oyun ekranlarında kota çağrısı yok.

### 4.3 `gameTokens.ts` — **dosya mevcut değil**

Yerine geçen iki dosyanın export'ları (yalnızca anahtar isimleri):

**`constants/gameThemes.ts`** (untracked, yeni):
```
type GameType
type AmbientVariant
interface GameTheme
const DEFAULT_GAME_THEME
const GAME_THEMES
function withAlpha
function resolveGameTheme
```

**`constants/gameLayout.ts`**:
```
const GAME_CONTENT_PADDING
function gameContentWidth
function gridItemWidth
```

---

## 5. SAĞLIK

### 5.1 git durumu (özet)

- Branch: `master` · **31 değişiklik**
- Değişmiş: 26 dosya (ağırlık `components/games/*` + `constants/*` + `app/games/*`)
- Rename: `components/games/ImposterPilot/` → `components/games/Imposter/`
- Silinmiş: `components/games/ImposterPilot/pilotTokens.ts`
- Untracked (4): `.claude/apple-design-standard-2026.md`,
  `components/games/GameBackdrop/`, `components/games/GlassSurface/`,
  `constants/gameThemes.ts`
- ⚠️ `supabase/.temp/cli-latest` versiyonlanmış — `.gitignore`'a girmeli

### 5.2 Son 10 commit

```
0bd499f chore: olu kod ve gereksiz dosya temizligi
1d81c98 feat: imposter tek sayfa oynanis + rol adi ipucu
baea89a feat: test icin gunluk ilerleme sifirlama (dev-reset-games)
0e4a0f2 feat: profilde Cinema Identity + DNA radar
cff3adb feat: Spotlight V3 — tek gorsel + harf harf acilan baslik
b6cf65e refactor: bes oyun ekrani festival diline gecti (Quoted haric)
917df21 refactor: ortak oyun bilesenleri festival diline gecti
92eae9f feat: Games Hub festival kurgusu — hero, gunun rotasi, paylasilan DNA katmani
cdf1216 feat: festival katmani token'lari + GameShell yeniden kurgusu
e84b160 docs: festival tasarim dili + ortak sistem matrisi duzeltmesi
```

### 5.3 Kod metrikleri

Tarama kapsamı: `app/ components/ services/ constants/ hooks/ contexts/ utils/`
(`src/` olmadığı için istenen komut bu dizinlere uyarlandı).

| Metrik | Değer | Yorum |
|---|---:|---|
| Hardcoded hex renk (`#RRGGBB`) | **159** | `Theme`/`Colors` dışı. Çoğu yeni festival katmanında |
| Boş catch bloğu | **0** | ✅ "silent fallback yasak" kuralına uyumlu |
| `locales/en.json` yaprak anahtar | **1 223** | |
| `locales/tr.json` yaprak anahtar | **1 223** | ✅ tam paritede |

---

## 6. ÖNE ÇIKAN RİSKLER

1. **Ölçüm verisi yok.** `game_scores` 12 satır, `mood_searches` 49, `swipes` 0.
   Faz 1 kapı metrikleri (D7, haftalık tamamlama medyanı) bu hacimle hesaplanamaz.
2. **`watched_at` hiç yazılmıyor** (0/318). İzleme sinyali sunucuda yok.
3. **84 film öneri havuzunun dışında** (`profile_vector` null + profilsiz 1 film).
4. **510 filmde `director` boş** → `per_director_cap` çeşitlilik koruması delik.
5. **Sürüm belgesi eskimiş**: CLAUDE.md SDK 55 / RN 0.83.2 diyor, kurulu olan 54 / 0.81.5.
6. **159 hardcoded renk** — design system token disiplini yeni oyun katmanında gevşemiş.
