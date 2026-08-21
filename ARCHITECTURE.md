# Chosy.ai — Technical Architecture

## Stack
- React Native 0.83.2 + Expo SDK 55 (managed, `expo-dev-client`)
- Expo Router v7 (file-based routing)
- React 19.2.0
- Supabase (PostgreSQL + pgvector + Edge Functions)
- RevenueCat (subscription management)
- Claude API (`@anthropic-ai/sdk`) — mood parsing
- TMDb API — film data
- react-native-reanimated v4 + react-native-gesture-handler
- react-native-purchases (RevenueCat SDK)
- react-native-view-shot + expo-sharing (share cards)
- i18n-js + expo-localization (EN + TR)

## Folder Map

```
app/
  (tabs)/
    index.tsx          -> Home dashboard (GreetingWidget + ArchetypeCard + LastFilmCard + QuickNavGrid)
    mood.tsx           -> Mood input + AI processing + result (3 state: input/processing/result)
    watchlist.tsx      -> Saved films (2x2 grid + grouped by session)
    profile.tsx        -> Archetype, TasteDNA, stats, settings, subscription badge
    _layout.tsx        -> Bottom tab bar (4 tabs, floating pill)

  discover.tsx         -> Film swipe feed (STACK screen, tab degil)
  film/[id].tsx        -> Film detail (slide_from_bottom)
  gate.tsx             -> Auth guard (anonim -> /auth redirect)
  auth.tsx             -> Apple Sign-In (zorunlu)
  setup-profile.tsx    -> Username + avatar secimi
  onboarding.tsx       -> 3 intro slide + 6 soru taste calibration + archetype reveal
  paywall.tsx          -> 3 plan subscription UI + purchase + restore
  _layout.tsx          -> Root layout (providers + auth listener)

components/
  SwipeCard/              -> SwipeableCard + SwipeCardStack
  AIProcessingOverlay/    -> AI loading animation
  MoodInput/              -> Mood text input + emoji chips
  MoodProfileResult/      -> Parsed mood profile cards
  FilterChips/            -> Year/rating/region filter pills
  Lumi/                   -> Animated orb (mood screen)
  ShareCards/             -> FilmShareCard + MoodShareCard + useShareCapture
  Home/                   -> ArchetypeCard, LastFilmCard, QuickNavGrid, GreetingWidget, MoodCTA, DailyPickSection
  Onboarding/             -> TasteCalibration, QuestionCard, ProgressBar, ArchetypeReveal
  Profile/                -> PersonaBadge, TasteDNA, StreakCard, DailyMatchCard, DiscoveryStats, WatchlistPreview
  Gamification/           -> StreakBadge, MilestoneCelebration
  Entry/                  -> EmotionalHook, InstantGratification, InteractiveStart
  FilmReelAnimation/      -> Film reel decorative animation

services/
  recommendations.ts      -> Vector matching flow orchestrator
  vectorEncoder.ts        -> 384-dim vector encoding (SINGLE SOURCE OF TRUTH)
  supabase.ts             -> Supabase client init
  watchlist.ts            -> Watchlist CRUD
  gamification.ts         -> Streak + milestones
  authService.ts          -> Apple/Google sign-in
  purchaseService.ts      -> RevenueCat purchase operations
  quotaEngine.ts          -> Free/premium quota logic
  subscriptionService.ts  -> Subscription state management
  dailyMatch.ts           -> Daily archetype-based film pick
  archetypeEngine.ts      -> computeArchetype() from taste profile
  homeService.ts          -> Home screen data aggregation
  tasteParser.ts          -> Mood text -> 12-dim profile (rule-based)

contexts/
  MoodContext.tsx          -> currentProfile, filters, lastMoodText, lastSessionFilms
  LanguageContext.tsx      -> LanguageProvider + useLanguage() + t()
  SubscriptionContext.tsx  -> SubscriptionProvider + useSubscription()

constants/
  Colors.ts               -> Color tokens (import with capital C!)
  theme.ts                -> Theme object (spacing, borderRadius, typography, shadow)
  archetypes.ts           -> 12 cinephile archetypes (id, name, desc, image, color)
  icons.ts                -> 69 custom PNG icon registry
  animations.ts           -> BOUNCE_CONFIG, SPRING_CONFIG, FAST_TIMING
  i18n.ts                 -> i18n instance + Locale type
  subscriptionPlans.ts    -> 3 plan definitions

hooks/
  useFeedManager.ts       -> Infinite feed logic (vector match + cold-start)
```

## Provider Chain (`app/_layout.tsx`)

```
GestureHandlerRootView
  > SafeAreaProvider
    > LanguageProvider
      > MoodProvider
        > SubscriptionProvider
          > ThemeProvider
            > Stack
```

## Data Flow

```
User types mood -> mood.tsx (state: 'input')
  -> FilterChips (optional scope)
  -> "Find My Movie" -> checkQuota() -> state: 'processing'
    -> AIProcessingOverlay shown
    -> Edge Function: parse-mood -> Claude API -> 12-dim emotion vector
  -> MoodContext.setMoodResult(profile, filters) -> state: 'result'
    -> MoodProfileResult shown
    -> recordSearch() (quota consumed)
  -> "Browse Movies" -> navigate to discover.tsx

Discover (discover.tsx)
  -> useFeedManager hook -> match_films(vector, filters) RPC
    -> pgvector cosine similarity (blocks of 10, decreasing threshold)
  -> SwipeCardStack renders cards (max 30 per session)
    -> Swipe right -> watchlist.ts INSERT + gamification.recordActivity()
    -> Swipe left  -> skip
  -> Session end -> free users see paywall nudge
```

## Supabase Schema (Migrations 001-013)

Tables: `users`, `films`, `film_profiles`, `sessions`, `swipes`, `watchlist`,
        `feedback`, `custom_lists`, `custom_list_films`,
        `user_streaks`, `milestones`, `user_milestones`

Key columns on `users`:
- `auth_id`, `username`, `avatar_id`, `archetype_id`
- `preferences_vector` (384-dim, set after calibration)
- `subscription_tier`, `subscription_expires_at`

RPCs: `match_films`, `update_streak`, `check_milestones`,
      `get_user_stats`, `get_swipe_history`, `get_watchlist_grouped`

Auth: Apple Sign-In required (gate.tsx enforces).
      `user_id` always from `users` table (auth_id -> id lookup).

RLS: Active on all tables. `films` + `film_profiles` = public read. Rest = owner only.

## Edge Functions (Deployed)
1. `parse-mood` — Free text -> emotion vector
2. `parse-taste` — Taste preferences -> filter params
3. `recommend` — Vector + filters -> ranked film list
4. `explain-match` — Why this film matches your mood

## Known Pitfalls
- `Colors` import must be capital C (`@/constants/Colors`)
- `expo-localization` direct import crashes -> use LanguageContext
- `match_films` has overload conflicts -> don't create new overloads
- Tab bar `position:'absolute'` -> every screen needs `paddingBottom: 83`
- `source.uri` empty string crashes Image -> check poster_url before render
- Vector encoding ONLY in `services/vectorEncoder.ts` (384 dim)
