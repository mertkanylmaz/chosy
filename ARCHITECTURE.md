# MoodFlix — Technical Architecture

## Stack
- React Native 0.83.2 + Expo SDK 55 (managed, `expo-dev-client`)
- Expo Router v7 (file-based routing)
- React 19.2.0
- Supabase (PostgreSQL + pgvector + Edge Functions + Anonymous Auth)
- Claude API (`@anthropic-ai/sdk ^0.78.0`) — rule-based fallback şimdilik
- react-native-reanimated v4.2.1 + react-native-gesture-handler ~2.30.0
- expo-haptics ~55.0.8
- i18n-js + expo-localization (LanguageContext üzerinden)
- TMDb API (film verileri)

## Folder Map
```
app/(tabs)/
  index.tsx          → Feed — TikTok+Tinder swipe cards (discover BURADA, ayrı sayfa YOK)
  watchlist.tsx      → Saved films, 2-col grid, custom lists
  mood.tsx           → Mood input + filters + AI processing + result (3 state: input/processing/result)
  profile.tsx        → Stats, TasteDNA, SwipeIntelligence, settings
  _layout.tsx        → Bottom tab bar (4 tabs, animated, Lumi on mood tab)

app/
  entry.tsx          → Onboarding gate (first-launch check)
  gate.tsx           → First route guard
  onboarding.tsx     → 4-step first-use flow
  splash.tsx         → Splash screen
  film/[id].tsx      → Film detail (slide_from_bottom)

components/
  SwipeCard/           → SwipeableCard.tsx, SwipeCardStack.tsx
  AIProcessingOverlay/ → 4-ring spiral animation during AI calls
  MoodInput/           → Mood text input + emoji
  MoodProfileResult/   → Parsed mood profile (4 cards)
  FilterChips/         → Year/rating/region/director filter pills
  Lumi/                → AI mascot (tab bar + mood screen)
  EmptyState/          → Empty feed placeholder
  ErrorState/          → Error state with retry
  SkeletonLoader/      → Loading placeholder shimmer
  FeedbackModal/       → Film star rating
  SurpriseCard/        → Special discovery cards (every 5-7 films)
  StaggeredFilmCard/   → Staggered animation card
  Profile/             → 7 sub-components: AIControls, DiscoveryStats, MoodTimeline,
                         SwipeIntelligence, TasteDNA, TonightPick, WatchlistPreview
  Entry/               → 3 sub-components: EmotionalHook, InstantGratification, InteractiveStart

services/
  recommendations.ts   → Orchestrates vector matching flow
  vectorEncoder.ts     → 384-dimension vector encoding (SINGLE SOURCE OF TRUTH)
  supabase.ts          → Supabase client init
  watchlist.ts         → Watchlist CRUD (NOT watchlistService.ts)
  gamification.ts      → Streak + milestone (recordActivity, getStreakInfo, getUserMilestones)
  history.ts           → getUserStats, getSwipeHistory (paginated), getMoodTimeline
  tasteParser.ts       → Mood text → 12-dimension profile (rule-based)
  recommendations.ts   → match_films RPC + infinite feed logic

contexts/
  MoodContext.tsx      → currentProfile, currentFilters, setMoodResult, clearMood
  LanguageContext.tsx  → LanguageProvider + useLanguage() + t() fn

constants/
  Colors.ts            → Color tokens (import: capital C!)
  theme.ts             → Theme object (spacing, borderRadius, typography, shadow)
  animations.ts        → BOUNCE_CONFIG, SPRING_CONFIG, FAST_TIMING
  i18n.ts              → i18n instance + Locale type
```

## Provider Chain (`app/_layout.tsx`)
```
GestureHandlerRootView
  → SafeAreaProvider
    → LanguageProvider
      → MoodProvider
        → ThemeProvider
          → Stack
```

## Data Flow
```
User types mood → mood.tsx (state: 'input')
  → FilterChips (optional scope)
  → "Find Movies" → state: 'processing'
    → AIProcessingOverlay shown
    → Edge Function: parse-mood → Claude API → 12-dim emotion vector
  → MoodContext.setMoodResult(profile, filters) → state: 'result'
    → MoodProfileResult shown
  → "Browse Movies" → clearState → navigate to Feed tab

Feed (index.tsx)
  → useFeedManager hook → match_films(vector, filters) RPC
    → pgvector cosine similarity (blocks of 10, decreasing threshold)
  → SwipeCardStack renders cards
    → Swipe right → watchlist.ts INSERT + gamification.recordActivity()
    → Swipe left  → skip (logged)
    → Swipe down  → next card
```

## 12-Dimension Profile System
1. `emotional_state` — 8 emotions [0-1]: joy, sadness, fear, anger, surprise, disgust, trust, anticipation
2. `energy_level` — 0.0 calm → 1.0 energetic
3. `pace_preference` — slow | medium | fast
4. `visual_style` — minimalist | cinematic | experimental | lush | raw
5. `thematic_depth` — 0.0 light → 1.0 deep
6. `ending_preference` — hopeful | bittersweet | open | tragic | triumphant
7. `era_preference` — year range
8. `cultural_context` — country/region
9. `avoid_signals` — themes to avoid
10. `narrative_style` — linear | nonlinear | anthology | dialogue-driven
11. `social_context` — alone | couple | friends | family
12. `rewatch_tolerance` — boolean

Vector encoding: **ONLY** `services/vectorEncoder.ts` → 384 dimensions

## Infinite Feed Logic
- Blocks of 10 films, decreasing similarity threshold:
  - Film 1-10: > 0.7 — "Perfect match"
  - Film 11-20: > 0.5 — "Also consider"
  - Film 21-30: > 0.3 — "Interesting discoveries"
  - Film 30+: profile-based surprise picks
- `exclude_ids` passed to prevent duplicates
- Surprise cards every 5-7 films (Hidden Gem, AI Pick, Unexpected)

## Supabase Schema (10 migrations, 001–010)
Tables: `users`, `films`, `film_profiles`, `sessions`, `swipes`, `watchlist`,
        `feedback`, `custom_lists`, `custom_list_films`,
        `user_streaks`, `milestones`, `user_milestones`

RPCs: `match_films` (vector + filters), `update_streak`, `check_milestones`,
      `get_user_stats`, `get_swipe_history`, `get_mood_timeline`

Views: `user_swipe_history`

Auth: Anonymous via `signInAnonymously()` in root layout.
      Always look up `user_id` from `users` table (auth_id → id).

RLS: Active on all tables. `films` + `film_profiles` = public read. Rest = owner only.

## Edge Functions (Deployed)
1. `parse-mood` — Free text → emotion vector
2. `parse-taste` — Taste preferences → filter params
3. `recommend` — Vector + filters → ranked film list
4. `explain-match` — Why this film matches your mood

## Critical Import Rules
```typescript
// ✅ CORRECT
import { Colors } from '@/constants/Colors'        // Capital C!
import { Theme } from '@/constants/theme'
import * as watchlistService from 'services/watchlist'  // NOT watchlistService.ts
import { encodeVector } from 'services/vectorEncoder'   // ONLY source for vectors

// ❌ NEVER
import { Colors } from '@/constants/colors'         // lowercase c = crash
import from 'services/watchlistService'              // wrong filename
// Do NOT use expo-localization directly — use LanguageContext
```

## Known Non-blocking TS Errors
Files to NOT touch: `scripts/`, `supabase/functions/`, `ExternalLink.tsx`,
`SkeletonLoader/` (duplicate), `watchlist.tsx:122,144`, various in `services/`

## Known Pitfalls
- `expo-localization` crashes in some builds → always use `LanguageContext`
- Turkish apostrophes in JS strings → backtick or escape
- `match_films` had RPC overload conflicts → don't create new overloads
- Tab bar `position:'absolute'` → every screen needs `paddingBottom: 83`
- `source.uri` empty string crashes Image → check poster_url before rendering
