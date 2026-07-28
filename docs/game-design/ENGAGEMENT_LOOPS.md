# Engagement Loops — Chosy.ai Game System

> Framework: Gamification Loops (Core Loop Design, Streak Mechanics, Progress Systems, Reward Systems)
> Scope: Daily, weekly, monthly, and long-term engagement architecture
> Target: 5-10 min daily ritual, D7 retention +10 pts, weekly completion median 3/7

---

## 1. The Three Nested Loops

### 1.1 Session Loop (2-5 minutes — the Micro)

The moment-to-moment experience within a single game:

```
Open game → Read puzzle → Think → Submit guess → Receive feedback → Adjust mental model → Submit again → Solve/Fail → See results + DNA change → Share (optional)
```

**Key design principles for session loop:**
- Time-to-first-feedback: < 30 seconds from opening game to first guess result
- Each feedback cycle teaches something (CineMetrics: "the year is higher," Logline: "here's another word")
- Natural endpoint: game completes, no infinite continuation
- Post-completion: 15 seconds of celebration/reflection (DNA update, share prompt) before the loop ends

**Session loop health metrics:**
| Metric | Target | Red Flag |
|--------|--------|----------|
| Time to first guess | < 30s | > 60s (friction in search/UI) |
| Total session time per game | 2-5 min | > 8 min (stuck, frustrating) or < 30s (Imposter: too thin) |
| Guess-to-feedback latency | < 500ms | > 2s (server/network) |
| Share card generation | < 3s | > 5s (loses impulse) |

### 1.2 Daily Loop (5-10 minutes — the Meso)

The daily ritual structure — the core of Chosy's engagement:

```
Wake up / Coffee time → Internal trigger: "What's today's puzzle?"
  → Open Chosy → See Daily Challenge Hero (home widget)
  → Play Game 1 (CineMetrics) → Results + DNA + "One more?" prompt
  → Play Game 2 (Logline) → Results + DNA + Streak update
  → See daily summary: "You earned 165 XP, Deduction +4, Day 12 streak"
  → Optional: Share card → Close app → Wait for tomorrow
```

**"One More Game" Bridge (critical for multi-game adoption):**

After completing Game 1, the results screen shows:
1. DNA dimensions that changed ("Deduction +6")
2. DNA dimensions that could change with Game 2 ("Knowledge is waiting — play Logline?")
3. A single tap to start Game 2

This bridge must feel like invitation, not obligation. Design principle: "The bridge shows what you'll gain, never what you'll lose."

**Daily Summary Panel:**
After all daily games are complete, show a consolidated view:
- Total XP earned today (with animated counter)
- DNA dimensions that moved (with directional arrows)
- Streak counter (with fire animation at milestones: 7, 30, 100)
- Share button for daily summary card (different from per-game card)
- "See you tomorrow at midnight" with countdown timer

### 1.3 Weekly Loop (7-day rhythm — the Macro-1)

**Difficulty Escalation (NYT Crossword Model):**

| Day | Difficulty Label | Film Pool | Target Solve Rate |
|-----|-----------------|-----------|-------------------|
| Monday | Warm-Up | Top 500 most-voted films | 85% |
| Tuesday | Easy | Top 1000 | 78% |
| Wednesday | Medium | Extended catalog, moderate popularity | 65% |
| Thursday | Challenge | Extended + international | 55% |
| Friday | Expert | Deep cuts, cult classics | 40% |
| Saturday | Master | Arthouse, obscure, international | 30% |
| Sunday | Wildcard | Random from any tier + bonus game (Imposter) | 60% |

**Weekly Completion Tracker:**
Visual progress showing 7 boxes for the week (Mon-Sun). Each box fills when that day's daily challenge is completed. Colors:
- Gold: Solved
- Silver: Attempted but not solved
- Empty: Not played
- Freeze icon: Streak freeze used

**Weekly Reward at 5/7 Completion:**
Players who complete 5 or more daily challenges in a week earn a "Weekly Bonus":
- Week 1-3: 50 bonus XP
- Week 4+: 75 bonus XP + reveal of "Weekly Stat" (e.g., "You averaged 3.2 guesses this week — top 20%")

This uses fixed ratio reinforcement (every week of 5+ completions = reward) which builds routine.

### 1.4 Monthly Loop (30-day cycle — the Macro-2)

**Monthly Milestones:**

| Milestone | Reward | Investment Created |
|-----------|--------|-------------------|
| 15 daily completions in a month | "Monthly Cinephile" badge + profile flair | Badge collection (sunk cost) |
| All 4 weeks at 5/7+ | "Perfect Month" badge (rare) | Identity investment |
| Rank-up during the month | Rank reveal ceremony (full-screen) | Rank as identity |
| DNA dimension crosses threshold | "Knowledge Master" / "Deduction Expert" title unlock | Title as social identity |

**Monthly DNA Report:**
On the 1st of each month, show a "Cinema DNA Month in Review":
- Radar chart showing dimension changes (before vs after)
- "Your strongest growth: Deduction (+12)"
- "Your challenge area: Visual Sense (locked)"
- Comparison to previous month
- Shareable monthly card

This uses fixed interval reinforcement (monthly report) to create anticipation and reflection.

---

## 2. Streak Redesign

### 2.1 Current Streak: Unified, Binary

Current: Complete 1+ daily game per day = streak maintained. Simple but has known issues:
- A single missed day kills potentially months of investment
- No differentiation between "played 1 game" and "played all games"
- Streak freeze is crude insurance

### 2.2 Proposed: Tiered Streak + Mini-Streaks

**Unified Streak (kept, refined):**
- Still based on daily completion (1+ game)
- Streak freeze: Free tier = 1/month, Premium = 4/month (unchanged)
- NEW: "Comeback multiplier" — if streak breaks, first 3 days back earn 1.5x XP ("Welcome back!")
- NEW: No "streak lost" shame notification. Instead, next open shows "Start a new streak today" with a clean-slate feel.

**Per-Game Mini-Streaks (new):**
Each game tracks its own consecutive-day counter independently. These are NOT shown prominently (no anxiety), but are used for:
- Achievement unlocks: "7-day CineMetrics streak" → "Dedicated Detective" badge
- DNA consistency bonus: 7+ days of a game adds a small bonus to that game's DNA dimensions
- Share card flair: Mini-streak number appears on the game-specific share card

**Weekly Streak (new layer):**
Complete daily challenges on 5+ days of a week = "Weekly streak" increments. Weekly streak is more forgiving (miss 2 days, still fine) and better matches real human behavior. Displayed as a flame icon with week count: "Week 8".

### 2.3 Streak Milestone Rewards

| Streak Days | Reward | Type |
|-------------|--------|------|
| 3 | "Getting Started" badge | Achievement |
| 7 | 50 bonus XP + DNA Consistency boost | XP + Stats |
| 14 | "Two-Week Warrior" badge + unique share card border | Achievement + Cosmetic |
| 30 | 100 bonus XP + "Monthly Champion" badge + extra streak freeze | XP + Achievement + Utility |
| 50 | "Half Century" badge + profile frame | Achievement + Cosmetic |
| 100 | "Century Club" badge + unique title option + permanent share card flair | Achievement + Identity |
| 365 | "Cinema Devotee" legendary badge | Achievement (extremely rare) |

Milestone rewards use variable ratio principles: early milestones are frequent (3, 7, 14), then spacing increases, maintaining anticipation without exhausting novelty.

---

## 3. XP Curve Recalibration

### 3.1 Current XP Sources

| Source | XP Range | Issue |
|--------|----------|-------|
| CineMetrics daily | 35-100 | Reasonable but flat — no bonus for difficulty |
| Logline daily | 35-100 | Same scale |
| Arcade runs | up to 30, cap 90/day | Too low to feel meaningful |
| Streak multiplier | x1.1 at 7+, x1.25 at 30+ | Multiplier too small to notice |

### 3.2 Proposed XP Economy

**Base XP per daily game (unchanged):**
Guess 1: 100, Guess 2: 85, Guess 3: 70, Guess 4: 55, Guess 5: 45, Guess 6: 35, Fail: 10

**New bonuses (additive, on top of base):**

| Bonus | Amount | Condition |
|-------|--------|-----------|
| Difficulty bonus | +10/+20/+30 | Wed/Thu/Fri-Sat puzzles (harder = more) |
| Multi-game bonus | +25 | Complete 2+ different daily games in same day |
| Perfect game bonus | +40 | Solve in 1-2 guesses (CineMetrics) or 0-1 reveals (Logline) |
| Weekly completion bonus | +50/+75 | 5/7 or 7/7 weekly completion |
| Hard Mode multiplier | x1.3 | Premium: on top of all other bonuses |

**Streak multiplier (revised):**
- Days 1-6: x1.0 (no bonus — building habit)
- Days 7-13: x1.1
- Days 14-29: x1.15
- Days 30-59: x1.2
- Days 60-99: x1.25
- Days 100+: x1.3

**Daily XP ceiling:** 350 XP/day (prevents grind via arcade while keeping daily games uncapped — all daily bonuses fit under this).

### 3.3 XP to Rank Progression

Rank isn't XP-based — it's Cinema Score-based (EWMA of DNA dimensions). XP feeds weekly leaderboard position and provides a "momentum" feeling. The key insight: XP is the engagement currency (short-term dopamine), Cinema Score is the identity currency (long-term growth).

---

## 4. Social Hooks (Without Leaderboard in Faz 1)

### 4.1 Share Card Ecosystem

**Per-game card:** Spoiler-free result grid + attempt count + DNA change. Film name NEVER shown.

**Daily summary card:** All games' results on one card. Shows "Chosy Day #47 — 2/2 complete, Day 12 streak".

**Weekly card (new):** End-of-week summary. "Week 8: 6/7 days, avg 3.1 guesses, Deduction rank up."

**Monthly card (new):** DNA radar chart comparison (start vs end of month).

Design principle: Cards should be interesting even to non-players. "What is this colorful grid? I want to try it." — the Wordle viral mechanic.

### 4.2 Passive Social Comparison

Without a leaderboard (Faz 1), create social engagement through:

1. **Aggregate stats on results screen:** "72% of players solved today's puzzle. You solved it in 3 guesses — better than 68%." This creates tribe reward (comparison) without requiring friends or leaderboard.

2. **Global solve distribution:** Show a histogram of guess counts for today's puzzle after completion. "Most people needed 4 guesses. You got it in 2." Variable tribe reward — some days you're above average, some below.

3. **Friend nudges (Phase 2 prep):** If a friend shares a Chosy card on social media, deep link opens the same puzzle. After both play, show side-by-side results. This is future-ready but doesn't require a friend system.

### 4.3 Community Day Concept (Monthly, Faz 2+)

One Saturday per month: a special extra-hard puzzle with a community goal. "If 10,000 players solve it today, everyone gets 100 bonus XP." Creates collaborative tribe reward at scale.

---

## 5. Trigger Schedule

### 5.1 Push Notification Strategy

| Trigger | Time | Frequency | Content | Internal Trigger Being Built |
|---------|------|-----------|---------|------------------------------|
| Daily puzzle available | 08:00 local | Daily | "Today's CineMetrics is ready. Difficulty: Medium" | Morning ritual association |
| Streak at risk | 20:00 local | Only if not played that day | "Your 14-day streak is waiting. One puzzle keeps it alive." | Loss aversion → ritual |
| Weekly summary | Sunday 18:00 | Weekly | "This week: 5/7 days, Knowledge +8. See your stats." | Reflection → planning |
| Rank up | Immediately | On rank change | "You reached Cinema Apprentice! See your new title." | Achievement → identity |
| Friend played (Faz 2) | After friend completes | When applicable | "Alex solved today's puzzle in 2 guesses. Can you beat that?" | Competition → FOMO |

**Notification discipline:**
- Maximum 1 push notification per day
- Never send "we miss you" — only value-containing notifications
- After 3 consecutive days of ignored notifications, reduce to 2/week
- Respect system notification settings immediately

### 5.2 In-App Triggers

| Trigger | Location | Condition |
|---------|----------|-----------|
| Daily Challenge Hero widget | Home screen | Always visible, changes state (new/in-progress/completed) |
| Red dot on Games tab | Tab bar | Unplayed daily games exist |
| "Continue your game" banner | Home screen | Game started but not finished |
| "New rank unlocked!" modal | On app open | Rank changed since last session |

---

## 6. Loop Health Metrics (for Faz 1 Gate)

| Metric | Target | Measurement |
|--------|--------|-------------|
| D7 retention (daily completers vs non-completers) | +10 pts differential | PostHog cohort comparison |
| Weekly completion median | 3/7 days | `game_daily_completed` events per user-week |
| Multi-game adoption | 40%+ play both CineMetrics and Game 2 on same day | Same-day event pairs |
| Share rate | 8%+ of completions → share | `game_share_completed / game_daily_completed` |
| Streak 7+ rate | 20% of active users maintain 7+ day streak | `user_streaks` analysis |
| Return after streak break | 50%+ return within 3 days | Cohort tracking |