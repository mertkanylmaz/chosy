# Meta-Progression — Cross-Game Progression System

> Scope: Daily quests, achievements, rank rewards, cross-game hooks, collections
> Constraint: 5-10 min daily ritual, not grind
> Ethics: Desire over duty, invitation over obligation

---

## 1. Daily Quest System

### 1.1 Design Philosophy

Daily quests exist to:
1. Encourage playing multiple games (cross-pollination)
2. Add variability to the daily experience ("What's my quest today?")
3. Create a secondary reward track alongside standard XP
4. Provide an "easy win" for new players on tough puzzle days

Daily quests must NOT:
- Require playing all games (that's obligation)
- Be mandatory for streak maintenance
- Replace the intrinsic puzzle-solving reward

### 1.2 Quest Pool

Quests rotate daily. Each day, 2 quests are active (drawn from the pool). Players need to complete 1 of 2 (choice = autonomy).

| Quest ID | Quest Text (EN) | Condition | Reward | Weight |
|----------|----------------|-----------|--------|--------|
| Q01 | "Warm Up: Complete any daily challenge" | Complete 1 daily game | 20 XP | 25% (appears often for accessibility) |
| Q02 | "Double Feature: Complete 2 different daily games" | Complete 2 daily games | 40 XP | 15% |
| Q03 | "Sharp Eye: Solve CineMetrics in 3 or fewer guesses" | CineMetrics <= 3 guesses, solved | 35 XP | 10% |
| Q04 | "Between the Lines: Solve Logline with 2 or fewer reveals" | Logline <= 2 reveals, solved | 35 XP | 10% |
| Q05 | "Poster Child: Solve FadeIn on first 3 blur levels" | FadeIn <= 3 guesses, solved | 35 XP | 8% |
| Q06 | "Cast Master: Perfect Imposter round (3/3)" | Imposter all rounds correct | 45 XP | 8% |
| Q07 | "Speed Demon: Complete any daily game in under 90 seconds" | Any game, time < 90s, solved | 30 XP | 8% |
| Q08 | "The Streak: Maintain your streak for another day" | Streak incremented today | 15 XP | 10% |
| Q09 | "Share the Love: Share any result card" | Share action completed | 25 XP | 6% |
| Q10 | "No Hints: Complete any game without using hints" | Any game, no hints, solved | 30 XP | -- |

**Quest generation rules:**
- 2 quests per day, no repeats from yesterday
- At least 1 quest must be completable with a single game (Q01, Q03-Q06, Q07, Q08)
- Never 2 quests requiring the same game
- Quest assignment is the same for all users (fits "same experience for everyone" spirit, though quests are not puzzles)

### 1.3 Quest UI

- Shown on the Games Hub below the game list
- Compact: 2 lines, each with quest text + reward + checkbox
- Completing a quest triggers a small celebration animation (golden flash)
- Quest rewards are additive to game XP (not replacement)

---

## 2. Achievement System

### 2.1 Achievement Categories

Achievements are permanent badges earned once. They appear on the player's profile and can be selected as "featured badge" (shown on share cards).

#### Beginner Achievements (First experiences)

| ID | Name | Criteria | Icon Concept |
|----|------|----------|-------------|
| A01 | First Solve | Solve any daily puzzle for the first time | Film clapperboard |
| A02 | Opening Night | Complete all daily games in one day for the first time | Theater curtains |
| A03 | Getting Started | Reach a 3-day streak | Small flame |
| A04 | Film Student | Reach Cinema Apprentice rank | Graduation cap |
| A05 | Share Director | Share a result card for the first time | Megaphone |

#### CineMetrics Achievements

| ID | Name | Criteria | Icon Concept |
|----|------|----------|-------------|
| A10 | Lucky Guess | Solve CineMetrics on first guess | Lightning bolt |
| A11 | Deduction Expert | Solve 10 CineMetrics in 3 or fewer guesses | Magnifying glass |
| A12 | Marathon Detective | Solve 30 consecutive CineMetrics (streak within game) | Running film reel |
| A13 | Hard Boiled | Solve 5 CineMetrics in Hard Mode | Badge with star |
| A14 | Globe Trotter | Solve CineMetrics where the answer is from 10 different countries | Globe |
| A15 | Decade Dancer | Solve CineMetrics spanning films from 5 different decades | Clock |

#### Logline Achievements

| ID | Name | Criteria | Icon Concept |
|----|------|----------|-------------|
| A20 | Mind Reader | Solve Logline with 0 words revealed | Brain |
| A21 | Speed Reader | Solve 10 Loglines | Open book |
| A22 | Context Clue | Solve Logline after using all reveals (clutch solve) | Puzzle piece |

#### FadeIn Achievements

| ID | Name | Criteria | Icon Concept |
|----|------|----------|-------------|
| A30 | Eagle Eye | Solve FadeIn on first guess (maximum blur) | Eagle |
| A31 | Poster Collector | Solve 20 FadeIn puzzles | Film strip |
| A32 | Blur Master | Solve 5 FadeIn on first 2 blur levels | Lens |

#### Imposter Achievements

| ID | Name | Criteria | Icon Concept |
|----|------|----------|-------------|
| A40 | Cast Detective | Get perfect 3/3 on Imposter 5 times | Badge |
| A41 | Imposter Hunter | Correctly identify 25 imposters total | Mask |

#### Quoted/Scene Achievements

| ID | Name | Criteria | Icon Concept |
|----|------|----------|-------------|
| A50 | Quote Connoisseur | Solve 10 Quoted puzzles from the quote alone (no hints) | Speech bubble |
| A51 | Silver Screen Scholar | Solve Quoted for films from 3 different decades | Vintage camera |

#### Streak Achievements

| ID | Name | Criteria | Icon Concept |
|----|------|----------|-------------|
| A60 | One Week | 7-day streak | Bronze flame |
| A61 | Two Weeks | 14-day streak | Silver flame |
| A62 | Monthly | 30-day streak | Gold flame |
| A63 | Centurion | 100-day streak | Diamond flame |
| A64 | Year-Long | 365-day streak | Legendary crown flame |
| A65 | Perfect Week | Complete all daily games every day for 7 consecutive days | Golden week badge |

#### Cross-Game Achievements

| ID | Name | Criteria | Icon Concept |
|----|------|----------|-------------|
| A70 | Renaissance Cinephile | Solve all available daily games in a single day, 10 times | Star with rays |
| A71 | Knowledge Supreme | Reach 80+ in Knowledge DNA dimension | Brain + crown |
| A72 | The Deducer | Reach 80+ in Deduction DNA dimension | Sherlock silhouette |
| A73 | Auteur Eye | Reach 80+ in Auteur Sense DNA dimension | Director's chair |
| A74 | Consistent | Reach 80+ in Consistency DNA dimension | Metronome |
| A75 | Cinema Master | Reach Cinema Master rank | Trophy |
| A76 | Quest Hunter | Complete 50 daily quests | Compass |

### 2.2 Achievement UI

- Profile tab: "Achievements" section with grid of badge icons
- Earned badges: full color. Locked: grayscale silhouette with "?" and criteria text
- Tap to see details: badge art, criteria, date earned
- "Featured badge" selector: chosen badge appears on all share cards next to player name
- Achievement unlock: full-screen modal with badge art + confetti, auto-dismiss after 3 seconds
- Push notification on significant achievements (A60+, rank-ups)

### 2.3 Achievement Rarity Tiers

| Tier | Badge Border | Examples | Expected % of Players |
|------|-------------|----------|----------------------|
| Common | Bronze | A01-A05 (beginner) | 50%+ |
| Rare | Silver | A11, A21, A31 (10+ solves) | 20-30% |
| Epic | Gold | A13, A20, A30, A63 (hard feats) | 5-10% |
| Legendary | Diamond | A64, A75 (year streak, max rank) | < 1% |

---

## 3. Rank Unlock Rewards

### 3.1 Rank Progression Table

| Rank | Cinema Score Threshold | Min Dailies | Unlock Reward |
|------|----------------------|-------------|---------------|
| Movie Lover (1) | 0 | 0 | Starting rank — no reward |
| Film Explorer (2) | 20 | 10 | Profile border color: Silver + "Film Explorer" title |
| Cinema Apprentice (3) | 35 | 25 | Share card design v2 (premium look) + new DNA radar chart style |
| Film Scholar (4) | 50 | 50 | Profile background theme: "Classic Cinema" + daily quest 3rd slot |
| Cinephile (5) | 65 | 100 | Exclusive share card frame: "Film Strip Gold" + streak freeze bonus (+1/month) |
| Cinema Master (6) | 80 | 200 | Legendary profile frame + unique title generation (based on DNA combination) + early access to new games |

### 3.2 Rank-Up Ceremony

When a player crosses a rank threshold:
1. Next app open: full-screen modal with cinematic animation
2. Old rank silhouette transforms into new rank badge
3. New title revealed with typewriter animation
4. DNA radar chart shown at current state
5. "Share your rank-up" card generated automatically
6. New unlocks listed with animations
7. Modal dismissable after 3 seconds (not forced viewing)

### 3.3 Rank Demotion Policy

**No demotion.** Once earned, a rank is permanent. Cinema Score can fluctuate, but rank only goes up. Rationale: Rank represents "peak achievement" not "current form." Losing rank would create anxiety and is an anti-pattern (punishment for absence).

---

## 4. "One More Game" Hooks

### 4.1 The Cross-Game Bridge

The critical design challenge: after completing CineMetrics, why would a player start Logline? The answer must be internal motivation, not external pressure.

**Strategy: DNA Gap Visualization**

After completing a game, the results screen shows:
```
Today's DNA Impact:
  Knowledge:  ████████░░  +6  (Game 1)
  Deduction:  ██████░░░░  +4  (Game 1)
  Consistency: ████████████ +2  (automatic)
  
  💡 Logline could boost your Knowledge further
     [Play Logline →]
```

The insight: players see which dimensions moved and which could still move. This creates a "complete the picture" motivation (incompleteness internal trigger) without punishing non-completion.

### 4.2 Game Hub State Management

The Games Hub shows all available daily games with real-time state:

| State | Visual | Description |
|-------|--------|-------------|
| Available | Bright card, "NEW" badge | Not yet played today |
| In Progress | Pulsing border | Started but not completed |
| Completed: Won | Green checkmark + solve info | Solved |
| Completed: Lost | Silver checkmark | Attempted, not solved |
| All Done | Golden banner at top | All daily games completed |

The "All Done" golden banner is the daily completion reward — visual proof of mastery. It persists until midnight reset.

### 4.3 Sequential Narrative

Each day, the games are loosely narratively themed (same film universe, not same answer):
- CineMetrics might feature a Spielberg film
- That day's Logline features another Spielberg film
- Creates a subtle "today is Spielberg day" feeling (NEVER stated explicitly, just felt)

Implementation: `generate-puzzles` cross-references director/genre/era across daily games for thematic cohesion.

---

## 5. Weekly Challenge Concept (Faz 2)

### 5.1 "The Marathon" — Saturday Special

Every Saturday, an optional "Marathon" challenge combines all available games into a single scored run:

**Rules:**
- Play each daily game in sequence
- Cumulative score across all games
- 10 "lives" — each wrong guess costs 1 life (shared across games)
- Complete all games with lives remaining = Marathon Clear
- Share card: "Marathon Clear — 4 lives remaining"

**Scoring:**
- Each game contributes its standard XP
- Marathon bonus: Clear bonus = 150 XP (plus remaining lives x 10 XP)
- Appears on weekly leaderboard (Faz 2)

### 5.2 "Theme Week" — Monthly Special

One week per month, all daily games share a theme:
- "Sci-Fi Week" — all answers are science fiction films
- "Oscar Week" — all answers are Academy Award winners
- "Director Spotlight: Kubrick" — all answers are Kubrick films

**Design benefit:** Theme weeks create anticipation, social conversation ("It's Oscar Week on Chosy!"), and variable reward (themed weeks feel different from normal weeks).

---

## 6. Collection / Completionist Mechanics

### 6.1 "Films Encountered" Log

Every film that appears as an answer (whether solved or not) is added to the player's "Film Log":
- Total count displayed on profile: "247 films encountered"
- Categorized by genre, decade, country
- Films solved: color poster. Films failed: grayscale poster with "?" overlay
- Tapping a failed film shows: "You encountered this on Day 34. You didn't solve it. Want to learn more?" → links to TMDB
- Premium: Film Log has search/filter capability

**Investment value:** The Film Log grows over time and becomes a personal cinema diary. It cannot be exported (platform lock-in) but has genuine value as a record of cinephile growth.

### 6.2 Country Map

A world map on the profile showing which countries' films the player has encountered:
- Countries light up as films from that country appear as answers
- "23 countries visited" counter
- Achievement: "Continent Complete" — encounter films from every continent
- Shareable map card at milestones (10, 20, 30 countries)

### 6.3 Genre Radar

Separate from Cinema DNA, a "Genre Exposure" radar chart showing:
- Which genres the player has solved (larger slice = more solved)
- Gaps indicate genres they haven't been exposed to
- "Your genre gap: Documentary. Play more to explore!" (informational, not prescriptive)

### 6.4 Director Constellation

A visual constellation map of directors encountered:
- Each director is a "star"
- Directors with multiple films solved are brighter
- Connecting lines between directors who collaborated or influenced each other
- Premium feature (requires significant data accumulation)

---

## 7. Seasonal Events (Quarterly)

### 7.1 Design Constraints

- Events must NOT create FOMO for daily puzzles (daily games remain the same whether event is active or not)
- Events add optional bonus objectives on top of normal play
- Events last 7-14 days (not 1 day — no "miss it and it's gone" anxiety)

### 7.2 Event Concepts

| Event | Timing | Mechanic | Reward |
|-------|--------|----------|--------|
| Oscar Season | February (before ceremony) | All daily films are previous Oscar nominees. Bonus XP for identifying the winner. | "Oscar Season 2027" badge |
| Summer Blockbuster | June | Films are all summer blockbusters. Speed bonuses doubled. | "Blockbuster" badge |
| Horror Month | October | All films are horror/thriller. Special dark-mode share cards. | "Horror Survivor" badge + dark card frame |
| Classic Cinema | December | Films from pre-1970. Special sepia-toned share cards. | "Classic Cinephile" badge |

### 7.3 Event Implementation

- Events modify `generate-puzzles` pool filters (not new games)
- Event badges stored in achievements table with `event_id` foreign key
- Event progress tracked in `game_scores.event_data` JSONB field
- Event availability checked via `app_config.active_event` (lazy getter)

---

## 8. Progression Health Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Achievement earn rate (per user-month) | 1-3 new achievements | < 0.5 (no progress feeling) or > 5 (too easy) |
| Rank-up rate | 1 rank per 30-60 days (active player) | < 1 per 90 days (stuck) |
| Daily quest completion rate | 60% of active players complete 1+ quest daily | < 40% (quests not engaging) |
| Multi-game adoption | 40% play 2+ daily games | < 25% (bridge not working) |
| Film Log engagement | 20% of players tap Film Log weekly | < 10% (feature unused) |
| Achievement share rate | 15% of achievement earns → share | < 5% (badges not valued) |