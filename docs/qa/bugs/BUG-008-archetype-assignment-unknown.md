## BUG-008: Archetype Assignment Logic — ANALYZED

**Severity:** P2 (confirmed bias, no crash)
**Status:** INVESTIGATED — 1 archetype unreachable, 3 severely underrepresented

---

### Investigation Summary

**Method:** Brute-force simulation of all 3,072 possible answer combinations (4x4x3x4x4x4).
**Script:** `scripts/archetype-analysis.ts`
**Result:** Scoring is deterministic. 0 null results (all combos pass threshold).

---

### Answer: Can all 12 archetypes be assigned?

**NO.** 11 out of 12 can be assigned. **#9 Chaos Agent is NEVER assigned** (0 out of 3,072 combos).

---

### Winner Distribution (3,072 combos)

| # | Archetype | Count | % | Status |
|---|-----------|-------|---|--------|
| 7 | Visual Poet | 826 | 26.9% | OVER-REPRESENTED |
| 1 | Adrenaline Junkie | 413 | 13.4% | OK |
| 4 | Joy Seeker | 394 | 12.8% | OK |
| 2 | Mind-Bender | 378 | 12.3% | OK |
| 12 | Escapist | 340 | 11.1% | OK |
| 3 | Melancholy Soul | 312 | 10.2% | OK |
| 11 | Truth Seeker | 213 | 6.9% | OK |
| 5 | Hopeless Romantic | 91 | 3.0% | UNDER |
| 10 | Zen Wanderer | 75 | 2.4% | UNDER |
| 6 | Dark Passenger | 25 | 0.8% | SEVERELY UNDER |
| 8 | Nostalgia Keeper | 5 | 0.2% | SEVERELY UNDER |
| 9 | Chaos Agent | 0 | 0.0% | NEVER ASSIGNED |

---

### Root Cause: Structural Bias

Calibration questions **never modify** these TasteProfile fields:

| Field | Stuck Value | Affected Archetypes |
|-------|-------------|---------------------|
| `anger` | 0.2 (default) | #9 Chaos Agent relies on anger w=3.0 |
| `disgust` | 0.1 (default) | #6 Dark Passenger (w=2.5), #9 (w=2.0), #11 (w=1.5) |
| `era_preference` | {1990, 2026} | #8 Nostalgia Keeper (eraV=0, w=3.0) |
| `rewatch_tolerance` | always true | Minor — helps #8 but not enough |

Additionally, these values are **never offered as options:**
- `visual_style: 'minimalist'` — needed by #10 Zen Wanderer, #11 Truth Seeker
- `ending_preference: 'tragic'` — needed by #3 Melancholy Soul, #6 Dark Passenger

---

### Scoring Logic Location

| File | Lines | What |
|------|-------|------|
| `components/Onboarding/TasteCalibration/questions.ts` | 59-240 | 6 questions, option effects |
| `components/Onboarding/TasteCalibration/questions.ts` | 251-332 | `buildCalibrationProfile()` — answers → TasteProfile |
| `services/archetypeEngine.ts` | 80-267 | 12 scorer functions (score1..score12) |
| `services/archetypeEngine.ts` | 289-305 | `computeArchetype()` — winner selection |
| `components/Onboarding/TasteCalibration/index.tsx` | 97-99 | Orchestration: buildProfile → computeArchetype |

---

### Deterministic?

**YES.** Same answers always produce the same archetype. No randomness involved.

---

### Fix Recommendations (prioritized)

1. **Quick fix — Q1 options:** Add `anger` and `disgust` effects to relevant Q1 options (e.g., intensity → anger: 0.5)
2. **Q4 option:** Add 'tragic' to ending choices, or combine with 'bittersweet'
3. **Q2 option:** Consider adding 'minimalist' visual style
4. **Era question:** Either add a Q7 for era preference, or add era effects to existing questions
5. **Weight rebalancing:** Visual Poet at 26.9% suggests Q2 lush/cinematic + slow pace combo is too powerful

---

### Device / Build
iPhone SE, Build 6 (original report)

### Analysis Script
`scripts/archetype-analysis.ts` — run with `npx ts-node scripts/archetype-analysis.ts`
