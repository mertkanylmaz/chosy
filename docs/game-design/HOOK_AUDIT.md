# Hook Model Audit — Chosy.ai Game System

> Audit date: 25 July 2026
> Framework: Hook Model (Nir Eyal) — Trigger, Action, Variable Reward, Investment
> Scope: All 6 games + shared meta-system
> Scoring: Quick Diagnostic (4 rows x 2pts = 8 max, scaled to 10)

---

## 1. Shared Internal Trigger Analysis (5 Whys)

Before auditing individual games, we identify the core internal trigger for the entire product:

1. Why would someone open Chosy? → "To play the daily cinema game"
2. Why do they want to play? → "To test their film knowledge"
3. Why do they want to test knowledge? → "To feel like a real cinephile"
4. Why does that matter? → "Film knowledge is part of their identity"
5. Why is that a problem without Chosy? → **"They feel their cinephile identity is unvalidated — no way to prove or develop it"**

**Primary internal trigger:** Identity anxiety / competence hunger — "Am I really as film-savvy as I think?"
**Secondary triggers:** Morning ritual boredom (routine slot), FOMO from seeing friends' share cards, incompleteness (streak/DNA progression)

---

## 2. Per-Game Hook Audit

### 2.1 CineMetrics (Wordle-style flagship)

| Phase | Current State | Score |
|-------|--------------|-------|
| **Trigger** | External: push notification, Home widget. Internal: "I wonder if I can get today's film" — morning curiosity builds after a few days of play. The daily reset creates a fixed-interval check. | 1.5/2 |
| **Action** | Open game → type film name → tap submit. Film search autocomplete reduces friction. ~15 seconds to first guess. Simple enough. | 2/2 |
| **Variable Reward** | **Self:** Colored grid is satisfying feedback; solving in 2 vs 6 creates variable mastery. **Hunt:** "Which film could it be?" deduction is inherently variable. **Tribe:** Share card enables social comparison, but currently no in-app social response loop. Reward variability is moderate — grid feedback is always 6 columns, patterns can feel samey after weeks. | 1.5/2 |
| **Investment** | Streak counter, Cinema DNA signals, share card (loads social triggers from friends). But Cinema DNA is invisible during play — investment happens silently. No "your Knowledge went up 4 points" moment at the right time. | 1/2 |

**Score: 7.5/10** — Strong loop but investment is underutilized and tribe reward is one-directional (share out, no response in).

**Missing hooks:**
- **Post-reward DNA reveal:** After solving, show the DNA dimension change with animation. "Deduction +8" should feel like leveling up in an RPG. This loads the next trigger ("I want to see my DNA grow tomorrow").
- **Share card response:** When a friend opens a shared card link, show the sharer's result alongside their own (once they play). This creates tribe reward feedback.
- **Hard Mode unlock tease:** After a player solves in 2-3 guesses, show "You could try Hard Mode (4 guesses, no arrows)" — loading the next session's trigger.
- **Difficulty-matched anticipation:** Friday/Saturday puzzles should be labeled "Expert" in the widget, creating anticipation/anxiety that is itself a trigger.

---

### 2.2 Spotlight (Turn-based poster matching)

| Phase | Current State | Score |
|-------|--------------|-------|
| **Trigger** | Same external triggers as CineMetrics. Internal trigger is weaker — "Let me do the poster one too" is derivative, not standalone. | 1/2 |
| **Action** | View clue → scan 4 posters → tap one. Very simple. But unlimited guesses per turn remove the consequence of tapping, reducing engagement. | 1.5/2 |
| **Variable Reward** | **Self:** Getting it on turn 1 vs turn 6 creates variable mastery. **Hunt:** "Which poster matches?" is visual hunt. But 4 fixed options per turn means variability is bounded. No tribe element. | 1/2 |
| **Investment** | Minimal. Same DNA signals as other games, but the game itself creates no unique stored value. No "perfect game" tracker, no "identified from poster alone" badge. | 0.5/2 |

**Score: 5/10** — Functional loop but predictable rewards, weak investment, and no standalone identity.

**Missing hooks:**
- **Perfect Turn Bonus:** Getting it right on turn 1 (with only decade info) should trigger a special celebration and DNA bonus. This creates a "hunt for the early solve" dynamic.
- **Clue skip economy:** Let players spend earned "insight tokens" to skip a clue and get a better one, or reorder clues. This is an investment (spending capital) that creates meaningful choices.
- **Visual identity streak:** "3 poster-only solves this week" — a micro-streak within Spotlight that feeds Visual Sense DNA.

---

### 2.3 Logline (Censored description deduction)

| Phase | Current State | Score |
|-------|--------------|-------|
| **Trigger** | Internal: "Can I figure it out from the blacked-out text?" — curiosity is strong. The visual of censored text is inherently intriguing. | 1.5/2 |
| **Action** | Read partial text → think → type film name → submit. Action requires more brain cycles than CineMetrics (reading comprehension + deduction). This is good friction — meaningful resistance. | 1.5/2 |
| **Variable Reward** | **Self:** Solving with 0 reveals vs 5 reveals creates strong variable mastery. **Hunt:** Each reveal is a mini-reward ("now I can see 'spaceship' — oh!"). But no feedback between wrong guesses — binary "no, try again" is flat. | 1/2 |
| **Investment** | Same silent DNA as CineMetrics. No per-guess learning — if you guess wrong, you don't learn WHY it's wrong. | 0.5/2 |

**Score: 5.5/10** — Strongest intrinsic curiosity trigger of all games, but wastes it with flat wrong-guess feedback and no investment moment.

**Missing hooks:**
- **Semantic feedback on wrong guesses:** When a player guesses "Alien" but the answer is "Aliens," show partial confirmation: "Close! The film is related to your guess." This is hunt reward (information) that loads the next action.
- **Word reveal as earned lifeline:** Let players spend XP (small amount, e.g., 10) to reveal one additional word. This is investment (XP sink) that creates an economy decision.
- **Progressive difficulty labeling:** "This logline has 8 censored words — Expert puzzle!" creates anticipation before play.
- **Solve-without-reveals celebration:** A unique share card variant for zero-reveal solves. This loads tribe trigger (friends see your impressive card).

---

### 2.4 FadeIn (Blurred poster recognition)

| Phase | Current State | Score |
|-------|--------------|-------|
| **Trigger** | Internal: "Can I recognize this poster?" — visual curiosity. Weaker than text-based games for non-visual-memory people. | 1/2 |
| **Action** | Look at blur → guess. Very simple visually. But poster recognition relies heavily on prior knowledge of poster art — players who don't visually memorize posters hit a wall fast. | 1.5/2 |
| **Variable Reward** | **Self:** Recognizing at 50px blur vs 4px creates dramatic mastery variation. **Hunt:** Each deblur step is a visual hunt reward. The visual "reveal" at game end is inherently satisfying. But no ceremony — blur just decreases mechanically. | 1/2 |
| **Investment** | Minimal. No unique investment mechanic. | 0.5/2 |

**Score: 5/10** — Visual appeal is high but the loop lacks investment and the reveal ceremony is underdesigned.

**Missing hooks:**
- **Archetype-aware hints:** Use Cinema DNA to offer contextual hints ("This is a Sci-Fi film from the 2000s") that match the player's weak spots. This personalizes the hunt and creates investment (DNA data improves future hints).
- **Reveal ceremony:** When the poster fully unblurs at game end, add a cinematic transition — the poster "develops" like a photo in a darkroom, with the film title appearing as a title card. This transforms the reward moment.
- **Hard Mode inversion:** Start at higher blur (60px) with only 4 attempts. Premium feature that creates identity investment ("I play FadeIn Hard").

---

### 2.5 Quoted (Film quote identification)

| Phase | Current State | Score |
|-------|--------------|-------|
| **Trigger** | Internal: "I know this quote!" — recognition is a strong emotion. But pool is frozen at ~100 films, meaning repeat players will exhaust novelty within 3 months. | 1/2 |
| **Action** | Read quote → think → guess film. Very simple. 4 attempts with progressive hints (character → actor → director+year). | 2/2 |
| **Variable Reward** | **Self:** Getting it from the quote alone vs needing all hints. **Hunt:** Progressive hints create mini-reveals. But finite pool means rewards become predictable — players start recognizing quotes they've seen before. | 0.5/2 |
| **Investment** | None unique. | 0.5/2 |

**Score: 5/10** — Structurally sound but existentially threatened by frozen pool. The "hunt" reward dies when the quarry runs out.

**CRITICAL ISSUE:** At 1 quote/day, 100 quotes depletes in ~3.3 months. Even with recycling after 6 months, returning quotes will be recognized, killing the variable reward. This game needs a pivot strategy (see GAME_MECHANICS_V2.md).

**Missing hooks / survival options:**
- **AI paraphrase layer:** Claude generates stylistically similar but altered versions of the quote. Same film, fresh words. This extends the pool infinitely while staying within copyright baseline (paraphrase, not reproduction).
- **Genre hint as first clue:** Before showing the quote, show the genre + decade. This creates a deduction layer that survives quote familiarity.
- **Quote difficulty awareness:** Some quotes are iconic ("Here's looking at you, kid") while others are obscure. Track which quotes players solve fastest and recalibrate.

---

### 2.6 Imposter (Actor elimination)

| Phase | Current State | Score |
|-------|--------------|-------|
| **Trigger** | Internal: "Who doesn't belong?" — oddity detection is a basic cognitive drive. | 1/2 |
| **Action** | Look at poster + 4 names → tap one. Extremely simple — 5 seconds of engagement. | 2/2 |
| **Variable Reward** | Binary: right or wrong. No gradation, no "close." 50% of the time the user fails and feels frustrated, 50% they succeed and feel it was trivially easy. Zero variability in reward magnitude. | 0.5/2 |
| **Investment** | None. The game takes 10-30 seconds. No data created, no stored value, no loaded trigger. | 0/2 |

**Score: 3.5/10** — Fundamentally broken loop. The 30/30/30 Rule fails at the 30-second loop: the micro-interaction is too thin. Binary outcome kills variable reward. No investment means no habit formation.

**Missing hooks (requires redesign, see GAME_MECHANICS_V2.md):**
- **Multiple rounds per session:** Transform from 1 binary attempt to a 3-round mini-game. Each round shows a different film's cast. Get 3/3 for perfect, 2/3 for pass, 1/3 for fail.
- **Difficulty variants:** Easy (4 options, 1 fake), Medium (5 options, 2 fakes), Hard (6 options, 3 fakes). Variable difficulty creates variable reward.
- **Cast knowledge tracking:** Each correct identification feeds "Knowledge" DNA. Patterns emerge — "You know action casts well but struggle with dramas."
- **Confidence wager:** After selecting, ask "How confident?" (sure/maybe). Correct + sure = bonus XP. Wrong + sure = XP penalty. This adds meaningful risk-reward.

---

## 3. Cross-Game Diagnostic Summary

| Game | Internal Trigger | Simple Action | Variable Reward | Investment Loads Trigger | Total |
|------|:---:|:---:|:---:|:---:|:---:|
| CineMetrics | 1.5 | 2.0 | 1.5 | 1.0 | **7.5** |
| Spotlight | 1.0 | 1.5 | 1.0 | 0.5 | **5.0** |
| Logline | 1.5 | 1.5 | 1.0 | 0.5 | **5.5** |
| FadeIn | 1.0 | 1.5 | 1.0 | 0.5 | **5.0** |
| Quoted | 1.0 | 2.0 | 0.5 | 0.5 | **5.0** |
| Imposter | 1.0 | 2.0 | 0.5 | 0.0 | **3.5** |

**Systemic weaknesses:**
1. **Investment is the weakest phase across all games.** Cinema DNA signals are written silently. Players don't see their investment growing. Fix: Make every game end with a visible DNA/XP change animation.
2. **Tribe reward is absent.** No game creates social reciprocity. Share cards go out but nothing comes back in. Fix: "Your friend also played today — compare results?" notification when both friends have completed.
3. **Internal trigger migration has not happened.** All games depend on external triggers (push, widget) because there's no emotion-to-product association yet. Fix: The "morning ritual" identity must be cultivated — "I'm a person who does Chosy with coffee."

---

## 4. Manipulation Matrix Assessment

| | Maker Uses Product | Maker Doesn't Use |
|--|--|--|
| **Materially Improves Life** | **FACILITATOR** | Peddler |
| **Doesn't Improve Life** | Entertainer | Dealer |

**Chosy's position: Entertainer trending toward Facilitator.**

- The maker (team) uses the product and finds value in the cinema knowledge challenge.
- "Materially improves life" is debatable — cinema knowledge is a cultural enrichment, not a necessity. However, it builds a genuine skill (film literacy), creates community (shared daily experience), and the time commitment is small (5-10 min/day).
- The daily challenge model with natural stopping points (you play today's puzzle, you're done) prevents infinite scroll dynamics.
- Streak freezes and no-penalty-for-absence design keep it from being obligation-driven.

**Ethics clear.** No hard rules violated. The 5-10 minute daily ritual with clear endpoints is respectful of user time. Cinema DNA as identity investment is genuine value, not artificial lock-in.

---

## 5. Habit Zone Analysis

| | Low Frequency | High Frequency (Daily) |
|--|--|--|
| **High Perceived Value** | — | **TARGET: Daily cinema ritual** |
| **Low Perceived Value** | Death zone | Imposter (current: too thin) |

- CineMetrics and Logline are in or near the habit zone: daily frequency + genuine "I learned something / proved myself" value.
- Imposter is in the danger zone: daily frequency but perceived value is very low (30-second binary outcome).
- Spotlight and FadeIn are marginal: frequency is right but value needs boosting through the missing hooks identified above.
- Quoted is time-limited: in the habit zone today but will exit as pool depletes.

---

## 6. Priority Recommendations (Ranked by Hook Score Impact)

| Priority | Recommendation | Games Affected | Expected Score Delta |
|----------|---------------|----------------|---------------------|
| 1 | **Visible investment moment:** Post-game DNA/XP animation showing what changed | All 6 | +1.0 across board |
| 2 | **Imposter redesign:** 3-round format + difficulty variants | Imposter | +3.0 (3.5 → 6.5) |
| 3 | **Logline per-guess feedback:** Semantic proximity hints on wrong guesses | Logline | +1.5 (5.5 → 7.0) |
| 4 | **Quoted survival pivot:** AI paraphrase or mechanic pivot | Quoted | +2.0 (5.0 → 7.0) |
| 5 | **Tribe reward loop:** Friend comparison when both complete same puzzle | All 6 | +0.5 across board |
| 6 | **Spotlight perfect-turn bonus + clue economy** | Spotlight | +1.5 (5.0 → 6.5) |
| 7 | **FadeIn reveal ceremony + archetype hints** | FadeIn | +1.5 (5.0 → 6.5) |
| 8 | **Difficulty labels in triggers:** "Expert puzzle today!" in push/widget | All 6 | +0.5 trigger boost |

**Target state:** All games at 6.5+ (functional habit loop); CineMetrics and Logline at 8+ (approaching complete loop).