# MoodFlix — Technical Architecture

## Stack
- React Native 0.83.2 + Expo SDK 55
- Supabase (PostgreSQL + pgvector + Edge Functions + Auth)
- Claude API (mood parsing, taste profiling, match explanation)
- react-native-reanimated v4.2.1
- react-native-gesture-handler ~2.30.0
- expo-haptics ~55.0.8
- Rive (currently: Lumi mascot via components/Lumi/)

## Folder Map
```
app/(tabs)/
  index.tsx          → Feed screen (TikTok+Tinder swipe cards)
  watchlist.tsx       → Saved films list
  mood.tsx            → Mood text input + AI processing
  profile.tsx         → User profile + stats
  _layout.tsx         → Bottom tab bar config

components/
  SwipeCard/           → SwipeableCard.tsx, SwipeCardStack.tsx, styles.ts
  AIProcessingOverlay/ → Loading animation during AI calls
  MoodInput/           → Text input for mood description
  MoodProfileResult/   → Shows parsed mood profile
  Lumi/                → Current mascot (Rive, used in tab bar + mood screen)
  EmptyState/          → Placeholder for empty lists
  FilterChips/         → Genre/year filter pills

services/
  recommendations.ts   → Orchestrates vector matching flow
  vectorEncoder.ts     → 384-dimension vector encoding (SINGLE SOURCE OF TRUTH)
  supabase.ts          → Supabase client init
  watchlist.ts         → Watchlist CRUD operations

contexts/
  MoodContext.tsx       → currentProfile, currentFilters, setMoodResult
  LanguageContext.tsx   → useLanguage() hook

constants/
  Colors.ts            → Color tokens (import with capital C!)
  theme.ts             → Theme object
```

## Data Flow
```
User types mood → mood.tsx
  → Supabase Edge Function: parse-mood
    → Claude API: free text → 12-dimension emotion vector
  → MoodContext stores profile
  → Navigate to feed (index.tsx)
    → Supabase RPC: match_films(vector, filters)
      → pgvector cosine similarity search
    → SwipeCardStack renders film cards
      → Swipe right → watchlist.ts → Supabase INSERT
      → Swipe left → skip (logged for future recommendations)
      → Swipe down → next card
```

## Supabase Schema
- **8 migrations applied** (001–008)
- `match_films()` RPC: active, accepts vector + filters
- Anonymous auth via `signInAnonymously()`
- 500 films loaded with pgvector embeddings
- **user_streaks table: DOES NOT EXIST YET** (needed for gamification)

## Edge Functions (Deployed)
1. `parse-mood` — Free text → emotion vector
2. `parse-taste` — Taste preferences → filter params  
3. `recommend` — Vector + filters → ranked film list
4. `explain-match` — Why this film matches your mood

## Emotion System
- 12-dimensional vector (joy, sadness, anger, fear, surprise, disgust, trust, anticipation, love, nostalgia, excitement, calm)
- Rule-based film profiling as MVP fallback (Claude API credits exhausted)
- Real AI profiling planned when credits restored

## Known TS Errors (Non-blocking)
- scripts/ directory
- supabase/functions/ directory  
- ExternalLink.tsx
- watchlist.tsx lines 122, 144
- Various in services/

## Critical Import Rules
```typescript
// ✅ CORRECT
import { Colors } from '@/constants/Colors'    // Capital C!
import { Theme } from '@/constants/theme'
import { watchlistService } from 'services/watchlist'  // NOT watchlistService.ts
import { encodeVector } from 'services/vectorEncoder'  // ONLY source for vectors

// ❌ NEVER
import { Colors } from '@/constants/colors'     // lowercase c = crash
import from 'services/watchlistService'          // wrong filename
```

## Known Pitfalls
- `expo-localization` native module crashes → use hardcoded language
- Turkish apostrophes in JS strings cause Expo build errors → use English in code strings
- UUID vs hardcoded user_id type mismatch → always use auth.user().id
- `match_films` had RPC overload conflicts → resolved, but don't create new overloads
