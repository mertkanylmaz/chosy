# Game Mechanics V2 — Per-Game Redesign

> Framework: Game Mechanics Design (Jesse Schell) + Mechanic Spec Workflow
> Approach: MDA reverse — define desired aesthetics, derive dynamics, then specify mechanics
> Constraint: All Hard Rules respected (solution never on client, server-side validation, etc.)

---

## 1. CineMetrics V2

### Mechanic Brief
**Player promise:** "Deduce today's mystery film through metadata feedback. Each guess narrows the field. Fewer guesses = greater mastery."

### Core Loop (unchanged, refined)
1. View empty grid with 6 rows
2. Search and select a film from the full catalog
3. Submit guess → server returns 6-column colored feedback
4. Use feedback to narrow candidates
5. Submit next guess with refined hypothesis
6. Win (correct film) or lose (6 wrong guesses) → results + DNA + share

### New Mechanics

#### 1a. Hint System (XP Cost)
**Rules:**
- After guess 3, a "Hint" button appears
- Hint Level 1 (15 XP): Reveals the film's decade (e.g., "1990s")
- Hint Level 2 (25 XP): Reveals one genre from the answer's genre set
- Maximum 1 hint per game
- Using a hint reduces max XP reward by 20%
- Hint usage tracked in DNA signals (reduces Deduction signal by 30%)

**Desired dynamics:** Players weigh "do I spend XP to increase solve chance, or preserve my Deduction score?" This is a meaningful decision with real trade-offs — no dominant strategy.

**Failure modes:**
- XP becomes trivially abundant → hint has no cost → everyone uses it. Mitigation: XP ceiling and the Deduction penalty create non-monetary cost.
- Hint is too strong → removes puzzle challenge. Mitigation: Decade + single genre is moderate information; film identification still requires work.

#### 1b. Hard Mode (Premium)
**Rules:**
- 4 attempts instead of 6
- Directional arrows (↑/↓) hidden — only colors (green/yellow/gray)
- XP multiplier: x1.3 on all base XP
- Separate Hard Mode badge on share card
- Leaderboard distinguishes Normal vs Hard

**Desired dynamics:** Premium players self-select into harder challenge for identity rewards. Hard Mode share cards become status symbols.

**Tuning parameters:**
| Parameter | Default | Range | Config Key |
|-----------|---------|-------|------------|
| Normal attempts | 6 | 4-8 | `cinemetrics.max_attempts` |
| Hard attempts | 4 | 3-5 | `cinemetrics.hard_max_attempts` |
| Hard XP multiplier | 1.3 | 1.1-1.5 | `cinemetrics.hard_xp_mult` |
| Hint L1 cost | 15 XP | 10-30 | `cinemetrics.hint_l1_cost` |
| Hint L2 cost | 25 XP | 15-40 | `cinemetrics.hint_l2_cost` |

---

## 2. Spotlight V2

### Mechanic Brief
**Player promise:** "Identify the film from accumulating clues. Each turn adds information. Getting it early proves your cinema instinct."

### Core Loop (refined)
1. Turn 1: See first clue (decade range) + 4 poster cards
2. Select a poster — RIGHT or WRONG feedback
3. If wrong: move to next turn, new clue added, SAME 4 posters
4. Continue until correct or 6 turns exhausted
5. Results with turn-specific scoring

### New Mechanics

#### 2a. Perfect Turn Bonus
**Rules:**
- Getting correct on Turn 1 (decade clue only): "Poster Instinct" — 3x XP for that game
- Getting correct on Turn 2: 2x XP
- Getting correct on Turn 3: 1.5x XP
- Turns 4-6: standard XP
- Perfect turns contribute to "Visual Sense" DNA (even before Faz 3 full activation — stored as early data)

**Desired dynamics:** Players study posters more carefully on early turns. The 4-poster grid becomes a visual puzzle rather than a guessing game.

#### 2b. Clue Skip/Reorder (Premium)
**Rules:**
- Premium players can "skip" the current turn's clue and request the next one early (once per game)
- Strategic choice: skip "runtime" clue to get "cast" clue earlier if you know actors better
- Skip doesn't reduce total turns, just reorders information flow

**Desired dynamics:** Players who understand their own strengths make strategic choices about information order. This creates a meta-skill on top of film knowledge.

#### 2c. Turn Penalty for Wrong Guess
**Rules (new — replaces unlimited guesses):**
- 1 guess per turn (not unlimited)
- Wrong guess on a turn: that poster is eliminated for future turns, but you don't get the "correct/wrong" state for other posters
- This means each turn is: see clue + remaining posters → pick one → right (win) or wrong (eliminated, next turn)

**Desired dynamics:** Each guess matters. Players can't brute-force by trying all 4 posters. Information from clues becomes critical.

**Failure modes:**
- 4 posters with 1 guess/turn means 4 turns of random guessing has ~25% chance per turn → ~68% solve by turn 4 with no knowledge. Mitigation: Posters are chosen to be similar (same era/genre), so visual distinction requires knowledge.

---

## 3. Logline V2

### Mechanic Brief
**Player promise:** "Decode the censored film description. Each wrong guess reveals a word. Fewer reveals = greater deduction skill."

### Core Loop (unchanged, enhanced)
1. See overview with 5-9 words censored (black bars)
2. Read context, form hypothesis
3. Submit film guess
4. If wrong: next word reveals (least → most informative order)
5. Revise hypothesis with new information
6. Win or exhaust attempts → results

### New Mechanics

#### 3a. Per-Guess Semantic Feedback
**Rules:**
- On wrong guess, in addition to word reveal, show one of:
  - "Warmer" — guessed film shares 2+ genres with answer
  - "Colder" — guessed film shares 0 genres with answer
  - "Same era" — guessed film within 10 years of answer
  - "Different era" — guessed film more than 10 years from answer
- Feedback chosen by server based on which dimension is most helpful (configurable)

**Desired dynamics:** Wrong guesses are no longer "flat failure." Each wrong guess provides information, turning the game into progressive deduction rather than trial-and-error.

**Implementation:** Server compares guessed film's metadata to solution's metadata and returns a single-sentence semantic hint. No new data exposed — uses existing TMDB fields.

#### 3b. Word Reveal Lifeline (XP Trade)
**Rules:**
- After attempt 2, player can tap a censored word to reveal it (costs 20 XP)
- Maximum 1 lifeline per game
- Revealed words come from the middle of the reveal order (not the most informative, not the least)
- Using lifeline reduces Deduction DNA signal by 25%

**Desired dynamics:** Players who are stuck have an escape valve. XP cost prevents free usage. The "middle informative" reveal prevents it from being a cheat while providing genuine help.

#### 3c. Themed Overview Days
**Rules:**
- Monday: Classic films (pre-1990) — longer, more descriptive overviews
- Wednesday: International films — English overviews of non-English films
- Friday: Recent films (2015+) — shorter overviews, harder censoring
- Other days: Mixed pool

**Desired dynamics:** Weekly rhythm creates anticipation. "Wednesday is international day" becomes a known pattern that builds expectations.

---

## 4. FadeIn V2

### Mechanic Brief
**Player promise:** "Recognize the film from its poster as it gradually sharpens. Earlier recognition proves your visual cinema memory."

### Core Loop (unchanged, enhanced)
1. See poster at maximum blur (50px)
2. Guess film
3. Wrong → blur decreases one step: [50 → 40 → 28 → 18 → 10 → 4]
4. Continue until correct or 6 attempts
5. Win → reveal ceremony; Fail → poster fully reveals

### New Mechanics

#### 4a. Blur Curve Optimization
**Current curve:** [50, 40, 28, 18, 10, 4] — six discrete steps
**Issue:** Steps 1-2 (50px, 40px) are visually identical for most posters. Steps 5-6 (10px, 4px) are trivially clear.

**Proposed curve:** [45, 30, 20, 12, 6, 2] — steeper early deblur for more visual information variation

**Tuning parameters:**
| Parameter | Default | Config Key |
|-----------|---------|------------|
| Blur steps (array) | [45, 30, 20, 12, 6, 2] | `fadein.blur_steps` |
| Max attempts | 6 | `fadein.max_attempts` |

#### 4b. Reveal Ceremony
**Rules:**
- On game completion (win or lose), poster does NOT just appear
- Instead: 2-second animation where poster "develops" — goes from blur to clarity with a film-projector-frame overlay effect
- Film title appears as a classic movie title card (centered serif text, fade in)
- Background dims, poster gets a spotlight effect
- If won: golden border + confetti particles. If lost: silver border, no confetti

**Desired dynamics:** The reveal is the primary reward moment. Making it cinematic transforms a flat "here's the answer" into a memorable experience that players want to share.

#### 4c. Hard Mode: "No Poster" Variant (Faz 2+, Premium)
**Rules:**
- Instead of poster blur, show the film's backdrop (landscape scene) at blur
- Backdrops are less distinctive than posters → harder
- XP multiplier: x1.3

---

## 5. Quoted V2 — Survival Strategy

### The Problem
Pool is frozen at ~100 quotes. At 1/day, exhausts in 3.3 months. Recycling after 6 months means returning quotes are recognized, killing variable reward. The game dies.

### Option A: AI Paraphrase (Recommended)

**Mechanic Brief:**
"Identify the film from a paraphrased quote. The quote captures the spirit but uses different words — testing whether you know the film's DNA, not just its dialogue."

**Rules:**
- Original quote is never shown (copyright compliance — A7)
- Claude generates a paraphrase that preserves meaning, tone, and context but changes vocabulary
- Generation happens in `generate-puzzles` batch, not runtime
- Lint: paraphrase must not share >40% of words with original (enforced check)
- Multiple paraphrases per film enable reuse after 6+ months without recognition

**Example:**
- Original: "You can't handle the truth!" (A Few Good Men)
- Paraphrase: "The reality is something you're incapable of accepting!"

**Hint progression (kept):**
1. Just the paraphrase
2. + Character name
3. + Actor name
4. + Director + year

**DNA signals:** Knowledge (film recognition), Deduction (guess efficiency)

**Failure modes:**
- Paraphrase too obvious: "Stars wars... you know, the force..." Mitigation: Lint checks for franchise keywords.
- Paraphrase too obscure: generic enough to match many films. Mitigation: Human-review batch for first 50, then telemetry-driven quality tracking.

### Option B: Mechanic Pivot to "The Scene"

If AI paraphrase proves unsatisfying in testing:

**Mechanic Brief:**
"Identify the film from a 3-sentence scene description. Not a quote — a description of a pivotal scene, written to evoke without spoiling."

- AI generates scene descriptions from TMDB plot summaries
- Infinite pool (any film with a plot summary)
- Hints: genre → decade → lead actor → director+year
- No copyright issue (descriptions, not reproductions)

### Recommendation: Start with Option A, pivot to B if paraphrase quality is insufficient after 2 weeks of user testing.

---

## 6. Imposter V2 — Complete Redesign

### Mechanic Brief (V2)
**Player promise:** "Spot the actors who DON'T belong in this film's cast. More rounds, more chances — but one mistake and it's over."

### Core Loop (new: multi-round format)
1. Round 1: Film poster + 4 actors (3 real, 1 fake). Select the fake.
2. If correct → Round 2: New film, 5 actors (3 real, 2 fakes). Select BOTH fakes.
3. If correct → Round 3: New film, 6 actors (4 real, 2 fakes). Select both fakes.
4. Any wrong selection → Game over at that round
5. Results: "Survived X rounds" + DNA

### Rules Model

| Element | Definition | Tunable? |
|---------|------------|----------|
| Rounds per game | 3 | Yes: `imposter.rounds` |
| Round 1 options | 4 (3 real, 1 fake) | Yes: `imposter.r1_options` |
| Round 2 options | 5 (3 real, 2 fakes) | Yes |
| Round 3 options | 6 (4 real, 2 fakes) | Yes |
| Actor pool for fakes | Same-gender, similar-era, different filmography | No |
| Film pool | Films with 4+ well-known cast members | No |

### Desired Dynamics
- Round 1 is accessible (75% random chance with no knowledge; near 100% with cast knowledge)
- Round 2 creates tension (selecting 2 fakes from 5 — probability drops significantly)
- Round 3 is genuinely hard (2 from 6, actors chosen to be plausible)
- The escalation creates "just one more round" feeling
- 3-round structure means a game takes 60-90 seconds instead of 10-30 seconds

### Scoring
| Outcome | XP | DNA Signal |
|---------|-----|------------|
| Round 1 only | 20 | Knowledge: 0.2 |
| Round 1 + 2 | 50 | Knowledge: 0.5 |
| Perfect (all 3) | 90 | Knowledge: 0.8, Deduction: 0.4 |
| Failed Round 1 | 5 | Knowledge: 0.05 |

### Confidence Wager (Optional Enhancement)
Before each round, player can toggle "Confident" (default off).
- Confident + correct: 1.5x round XP
- Confident + wrong: 0.5x round XP
- Creates risk-reward decision within each round

### Failure Modes
- Fake actors too obviously wrong (e.g., child actor in R-rated film): Mitigation: Pool filtered by age range, genre compatibility, and era.
- Real actors too obscure: Mitigation: Only use actors from TMDB "known_for" credits, minimum popularity threshold.
- Round 3 too hard for casual players: Mitigation: DNA-adaptive difficulty in Faz 2 — lower-Knowledge players get more distinguishable fakes.

### Share Card
"Imposter Round 3/3 — Perfect Clear!" with 3 circular icons (one per round, green check or red X).

---

## 7. Cross-Game Mechanics

### 7a. The Insight Token Economy (Faz 2)

Insight Tokens are a secondary currency earned through exceptional play:
- CineMetrics: Solve in 1-2 guesses → 1 token
- Logline: Solve with 0-1 reveals → 1 token
- Imposter: Perfect 3/3 → 1 token
- Daily cap: 2 tokens/day

**Token spends:**
- Hint in CineMetrics (1 token = free hint, no XP cost)
- Word reveal in Logline (1 token = free reveal)
- Clue skip in Spotlight (1 token)
- Archive puzzle unlock (3 tokens = 1 free archive puzzle for free-tier users)

This creates a cross-game investment loop: excellence in one game creates resources for other games.

### 7b. Film Catalog Revisit Protection

No film should appear as the answer in two different games within 14 days. Managed at the `generate-puzzles` level with a cross-game dedup check.

### 7c. Unified Search Component

All guess-based games (CineMetrics, Logline, Quoted/Scene, FadeIn) share `FilmSearchInput`. Enhancements:
- Recent guesses shown first (from current game session)
- Previously guessed films in this game shown with checkmark (can't re-guess)
- Typing 2+ characters triggers autocomplete
- Results show: Title (Year) — Director — small poster thumbnail