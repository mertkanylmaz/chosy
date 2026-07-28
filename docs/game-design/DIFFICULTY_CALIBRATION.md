# Difficulty Calibration — Chosy.ai Game System

> Framework: Puzzle Design (Jonathan Blow / Valve / Escape Room principles)
> Core principle: Frustration is a design failure, not a player failure
> Target: Every player solves 60%+ of weekly puzzles; experts have meaningful challenge

---

## 1. Difficulty Parameters Per Game

### 1.1 CineMetrics Difficulty Knobs

| Parameter | Easy | Medium | Hard | Very Hard |
|-----------|------|--------|------|-----------|
| Film popularity (TMDB vote_count) | > 5000 | 2000-5000 | 500-2000 | 200-500 |
| Film recognition (cultural ubiquity) | Iconic (Titanic, Star Wars) | Well-known (Good Will Hunting) | Cult/niche (Mulholland Drive) | Obscure international (Yi Yi) |
| Genre distinctiveness | Single dominant genre | 2 genres, clear primary | Multi-genre, ambiguous | Genre-defying |
| Director fame | Spielberg, Nolan | Wes Anderson, Denis Villeneuve | Park Chan-wook, Celine Sciamma | Debut features |
| Year range | Major decades (80s, 90s, 2000s) | Full range post-1960 | Pre-1960 included | Silent era possible |
| Country | USA/UK dominant | US/UK/France/Japan | Any country | Countries with small film industries |

**Composite difficulty score formula:**
```
difficulty = round(
  0.35 * (1 - normalize(vote_count, 200, 10000)) +
  0.25 * (1 - normalize(popularity, 5, 100)) +
  0.20 * genre_ambiguity_score +
  0.10 * director_obscurity_score +
  0.10 * era_unfamiliarity_score
) * 5  // Scale 1-5
```

All weights in `app_config.cinemetrics_difficulty_weights`.

### 1.2 Logline Difficulty Knobs

| Parameter | Easy | Hard |
|-----------|------|------|
| Overview length | 50-80 words (more context) | 30-50 words (less context) |
| Censored word count | 5 (more visible) | 8-9 (less visible) |
| Censored word informativeness | Character names hidden, setting visible | Everything key hidden |
| Film popularity | High | Low |
| Genre specificity of overview | "A young wizard..." (obvious genre) | "A man returns home..." (ambiguous) |

### 1.3 Spotlight Difficulty Knobs

| Parameter | Easy | Hard |
|-----------|------|------|
| Poster distinctiveness | Each poster visually unique (different color palettes) | Posters from same genre/era (similar palettes) |
| Clue specificity | "Exact year: 1994" | "Decade: 1990s" |
| Film similarity among options | Different genres | Same genre, same era |

### 1.4 FadeIn Difficulty Knobs

| Parameter | Easy | Hard |
|-----------|------|------|
| Poster distinctiveness | Bold colors, unique composition | Dark, monochrome, or generic poster |
| Film popularity | Iconic poster (everyone's seen it) | Deep cut poster |
| Blur starting level | 45px (moderate) | 50px (extreme) |

### 1.5 Quoted/Scene Difficulty Knobs

| Parameter | Easy | Hard |
|-----------|------|------|
| Quote/scene recognition | Iconic ("May the Force...") | Lesser-known scene |
| Film popularity | Blockbuster | Art house |
| Hint specificity | Well-known actor as hint | Character actor |

### 1.6 Imposter Difficulty Knobs

| Parameter | Easy | Hard |
|-----------|------|------|
| Fake actor plausibility | Different gender/era (obvious) | Same gender, same era, similar roles |
| Film cast recognition | A-listers (DiCaprio, Pitt) | Strong character actors |
| Number of fakes | 1 in 4 | 2 in 6 |

---

## 2. Weekly Difficulty Rhythm

### 2.1 The NYT Crossword Curve (Adapted for Cinema)

```
Difficulty
  5 │                              ■ ■
  4 │                        ■ ■
  3 │              ■ ■ ■
  2 │        ■ ■
  1 │  ■ ■
    └──────────────────────────────────
      Mon  Tue  Wed  Thu  Fri  Sat  Sun
```

**Key design insight (from puzzle-design patterns):** Difficulty should feel like the player is getting smarter early in the week and being challenged later. Monday success builds confidence for Wednesday.

### 2.2 Per-Day Specification

| Day | Difficulty | CineMetrics Film Pool | Logline Censoring | Target Solve Rate |
|-----|-----------|----------------------|-------------------|-------------------|
| Monday | 1 (Warm-up) | Top 200 most-voted, clear genres | 5 words censored, film very popular | 85%+ |
| Tuesday | 1.5 (Easy) | Top 500, single dominant genre | 5-6 words, well-known film | 80% |
| Wednesday | 2.5 (Medium) | Top 1000-2000, some ambiguity | 6-7 words, moderately known | 65% |
| Thursday | 3 (Challenge) | Extended catalog, international films included | 7 words, less popular | 55% |
| Friday | 4 (Expert) | Cult classics, arthouse, deep cuts | 7-8 words, niche film | 40% |
| Saturday | 4.5 (Master) | International arthouse, obscure | 8-9 words, obscure film | 30% |
| Sunday | 2 (Wildcard) | Random from any tier + Imposter bonus | Mixed | 65% |

**Why Sunday is easier:** Players who struggled Fri-Sat need a "recovery" day. Ending the week with a hard puzzle creates negative association with "the weekend." A moderate Sunday provides a satisfying close and encourages starting Monday fresh.

### 2.3 Difficulty Monitoring

Track `guesses_used` distribution per day:

| Day | Target Median Guesses | Alert If |
|-----|----------------------|----------|
| Monday | 2-3 | Median > 4 (too hard) |
| Wednesday | 3-4 | Median > 5 (too hard) or < 2 (too easy) |
| Saturday | 5-6 | Median < 3 (too easy for "Master") |

If alerts fire for 2+ consecutive weeks, adjust difficulty knobs in `app_config`.

---

## 3. Hint Economy

### 3.1 Design Philosophy

Hints should:
1. **Nudge toward discovery, not reveal the answer** (Progressive Hint System pattern)
2. **Cost something real** (creating a meaningful decision)
3. **Not feel mandatory** (good players never need them)
4. **Prevent rage-quit on hard days** (anti-frustration measure)

### 3.2 Hint Types Per Game

| Game | Hint | Cost | Effect | DNA Impact |
|------|------|------|--------|------------|
| CineMetrics | Decade reveal | 15 XP | Shows "1990s" | Deduction -30% |
| CineMetrics | Genre reveal | 25 XP | Shows 1 genre from answer | Deduction -30% |
| Logline | Word reveal | 20 XP | Reveals 1 censored word (mid-informative) | Deduction -25% |
| Spotlight | Clue skip | Premium only | Skip current clue, get next | No impact |
| FadeIn | Genre hint | 15 XP | Shows answer's primary genre | Knowledge -20% |
| Quoted | Era hint | 10 XP | Shows decade of the film | Knowledge -15% |
| Imposter | Eliminate 1 | Premium only | Removes 1 option (can't be the answer) | No impact |

### 3.3 When Hints Become Available

Hints should not appear until the player is likely stuck:

| Game | Hint Available After |
|------|---------------------|
| CineMetrics | Guess 3 (halfway through attempts) |
| Logline | Guess 2 (early, since reveals happen anyway) |
| Spotlight | Turn 3 |
| FadeIn | Guess 3 |
| Quoted | Guess 2 |
| Imposter | Not available (too fast) |

### 3.4 Free Hints (Anti-Frustration)

On Saturday (Master difficulty), free-tier players get 1 free hint per game (no XP cost, no DNA penalty). Rationale: Saturday puzzles have 30% target solve rate. Without help, 70% of free players fail → frustration → churn. A free hint on the hardest day is an insurance policy against difficulty spikes.

Premium players get 1 free hint every day.

---

## 4. "Aha Moment" Design Per Game

The "aha moment" — the instant of realization — is the core reward of puzzle design. Each game type produces a different type of aha:

### 4.1 CineMetrics: The Narrowing Aha

**How it works:** Player sees green year + yellow genre + gray country. "Wait... a 1994 drama that's NOT American... could it be..." → "Four Weddings and a Funeral! No... Pulp Fiction is American... it must be Trainspotting!" → guess → feedback confirms → "YES!"

**Design support:**
- Feedback grid should be highly readable at a glance (color contrast matters)
- Arrow directions must be immediately clear (↑ = answer is higher/later)
- Previous guesses remain visible (players scan patterns across guesses)
- "Near miss" celebration when 5/6 columns are green but answer is wrong (close call excitement)

### 4.2 Logline: The Contextual Aha

**How it works:** Player sees "A ████ ████ sets out to find the ████ ████ who ████████ his family in the ████ ████████." Third wrong guess reveals "American" → "A American ████ sets out to find..." → "Wait, American frontier... western genre... revenge plot... The Revenant? No, True Grit? No, that's a girl..." → Reveals "West" → "...in the American West" → "UNFORGIVEN!"

**Design support:**
- Censored words must be visually distinct (black bars, not just blank space)
- Revealed words must animate into place (not just appear — the revelation needs ceremony)
- The reveal order (least → most informative) is critical — it should create a building narrative

### 4.3 FadeIn: The Recognition Aha

**How it works:** At 30px blur, player sees a red and blue color palette... "Red and blue... could be Spider-Man, Superman..." → At 20px, a face becomes visible → "That's a woman's face... red and blue... Wonder Woman? American Beauty?" → At 12px, the rose is visible → "AMERICAN BEAUTY!"

**Design support:**
- Blur algorithm must preserve color composition (not just Gaussian — maintain the poster's color story)
- The deblur animation between steps should be smooth (0.5s transition), not instant
- Players should be able to zoom/pan the blurred image (pinch gesture)

### 4.4 Imposter: The Recognition Aha (V2)

**How it works:** Player sees film poster for "The Dark Knight" + 4 actors: Christian Bale, Heath Ledger, Gary Oldman, Mark Ruffalo. "Ruffalo? Was he in The Dark Knight? I don't think so... he's MCU..." → taps Ruffalo → "Correct! The imposter was Mark Ruffalo."

**Design support:**
- Fake actors must be plausible (same era, similar genre roles) but identifiable with knowledge
- Film poster should be shown large enough to trigger memory of the cast
- After selection, show the fake actor's actual famous role: "Mark Ruffalo was NOT in The Dark Knight. You might know him from The Avengers."

---

## 5. Anti-Frustration Measures

### 5.1 The "Almost Had It" Buffer

When a player uses all attempts without solving:
- Show the answer with respect, not shame: "Today's film was [title]" with poster
- Show how close they were: "You had 4/6 columns green on guess 5 — so close!"
- Show participation XP: "You earned 10 XP for playing"
- Show DNA impact: "Your Consistency +2 for showing up"
- NO: "Better luck tomorrow!" (patronizing). YES: "A tough one today. 35% of players solved it."

### 5.2 Difficulty Regression Guard

If a player fails 3 consecutive daily puzzles:
- Next day's game shows a subtle "Today's a good day to bounce back" message
- This does NOT change the puzzle difficulty (same puzzle for everyone)
- But it adjusts the post-failure messaging to be more encouraging
- Track this state server-side in user metadata

### 5.3 Weekend Difficulty Shield

Friday-Saturday puzzles are intentionally hard (expert/master). To prevent these from killing streaks:
- Saturday puzzles have extended hint availability (see 3.4)
- The streak freeze reminder is sent earlier on Fri-Sat (18:00 instead of 20:00)
- Sunday's easier puzzle immediately follows, creating a "recovery" rhythm

### 5.4 New Player First-Week Experience

Players in their first 7 days of playing always get the Monday-tier difficulty, regardless of actual day. This creates a "winning streak" that builds confidence and habit before exposing them to the difficulty curve. After day 7, they join the normal schedule.

Config: `difficulty.new_player_shield_days: 7`

---

## 6. Adaptive Difficulty Concept (Faz 2 — Cinema DNA-Based)

### 6.1 Opt-In "Personalized Difficulty" Mode

**Important:** Daily puzzles remain the same for everyone (Hard Rule A1). Adaptive difficulty applies ONLY to:
- Archive puzzles (Premium, playing past puzzles)
- Arcade modes (non-daily)
- Hint availability timing

### 6.2 How DNA Informs Difficulty

| DNA Dimension | Below 30 | 30-60 | Above 60 |
|---------------|----------|-------|----------|
| Knowledge | Archive suggests popular films | Archive suggests mixed | Archive suggests deep cuts |
| Deduction | Hints appear after guess 2 | After guess 3 | After guess 4 |
| Visual Sense | FadeIn archive starts at 40px blur | 45px | 50px |

### 6.3 Guardrails

- Adaptive difficulty NEVER applies to daily challenges
- Players can toggle adaptive off ("I want the hard stuff")
- DNA-based selection is a suggestion, not a guarantee (random factor: 30%)
- No player should feel they're getting "baby mode" — frame as "curated for your profile"