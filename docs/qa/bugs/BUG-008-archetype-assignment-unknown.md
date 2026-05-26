## BUG-008: Archetype Assignment Logic — FIXED

**Severity:** P2 → Resolved
**Status:** FIXED — All 12 archetypes now reachable

---

### Original Problem

Brute-force of 3,072 calibration combos revealed:
- #9 Chaos Agent: **0/3072** (NEVER assigned)
- #8 Nostalgia Keeper: 5/3072 (0.2%)
- #6 Dark Passenger: 25/3072 (0.8%)
- #7 Visual Poet: 826/3072 (26.9%) — over-represented

Root cause: `anger`, `disgust`, `era_preference` never modified by calibration questions.

---

### Fix Applied

#### questions.ts — Effect Changes

| Question | Option | Change |
|----------|--------|--------|
| Q1 | intensity | Added `anger: 0.6, disgust: 0.3` to emotional_state |
| Q2 | old_footage | Changed `visual_style: 'raw'` → `'minimalist'` + added `era_preference: {1940, 1985}` |
| Q3 | masks | Added `emotional_state: { anger: 0.7, disgust: 0.5 }` |
| Q4 | sadness | Changed `ending_preference: 'bittersweet'` → `'tragic'` + added `emotional_state: { disgust: 0.4 }` |

Also added `era_preference` to `OptionEffect` interface and `buildCalibrationProfile()` handler.

#### archetypeEngine.ts — Weight Changes

| Archetype | Change |
|-----------|--------|
| #6 Dark Passenger | disgust w: 2.5→3.0, ending accepts 'bittersweet', visual accepts 'minimalist' |
| #7 Visual Poet | visual w: 3.5→2.8, targets: `lush+cinematic` → `lush` only |
| #8 Nostalgia Keeper | trust w: 2.0→2.5, added visual match (minimalist, cinematic) w=1.0 |
| #9 Chaos Agent | anger w: 3.0→3.5, disgust w: 2.0→2.5, added `1-fear` w=1.5, visual accepts 'minimalist' |

---

### Results After Fix

| # | Archetype | Before | After |
|---|-----------|--------|-------|
| 1 | Adrenaline Junkie | 413 (13.4%) | 349 (11.4%) |
| 2 | Mind-Bender | 378 (12.3%) | 340 (11.1%) |
| 3 | Melancholy Soul | 312 (10.2%) | 341 (11.1%) |
| 4 | Joy Seeker | 394 (12.8%) | 305 (9.9%) |
| 5 | Hopeless Romantic | 91 (3.0%) | 34 (1.1%) |
| 6 | Dark Passenger | **25 (0.8%)** | **37 (1.2%)** ↑ |
| 7 | Visual Poet | **826 (26.9%)** | **386 (12.6%)** ↓ |
| 8 | Nostalgia Keeper | **5 (0.2%)** | **423 (13.8%)** ↑↑ |
| 9 | Chaos Agent | **0 (0.0%)** ❌ | **54 (1.8%)** ✅ |
| 10 | Zen Wanderer | 75 (2.4%) | 81 (2.6%) |
| 11 | Truth Seeker | 213 (6.9%) | 251 (8.2%) |
| 12 | Escapist | 340 (11.1%) | 471 (15.3%) |

**12/12 archetypes reachable. 0 null results.**

---

### Remaining Notes

- #5 Hopeless Romantic (1.1%) and #6 Dark Passenger (1.2%) are still rare but reachable
- This is acceptable: niche archetypes should be rare (specific user profiles)
- Verification script: `scripts/archetype-analysis.ts`

---

### Files Changed

- `components/Onboarding/TasteCalibration/questions.ts` — question effects + era_preference support
- `services/archetypeEngine.ts` — weight rebalancing for #6, #7, #8, #9
- `scripts/archetype-analysis.ts` — analysis script updated to match
