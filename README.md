# Chosy — The Daily Film Gauntlet

Chosy is an iOS mobile app that transforms how people discover and choose films through a daily ritual: a **4-film elimination gauntlet**, **3 binary choices**, and **1 champion winner**. Built for cinephiles and casual viewers alike who are tired of infinite scroll and decision paralysis.

---

## Why Chosy?

Streaming explosion = choice paralysis. Netflix has 10,000+ titles. What do you actually watch tonight?

Chosy fixes this with a structured, game-like discovery ritual:
* **Daily Gauntlet:** 4 algorithmically-selected films matched to your taste vector.
* **Rapid-Fire Choices:** 3 head-to-head eliminations (A vs B, winner vs C, winner vs D).
* **Instant Champion:** One winning film surfaces immediately + direct watch provider links.
* **Streak System:** Day-to-day engagement loop with personal archive tracking.

**Result:** Faster decisions, higher watch-through rates, and genuine discovery.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React Native / Expo, Expo Router, TypeScript |
| **Backend** | Supabase (PostgreSQL, Edge Functions, Row-Level Security) |
| **Database** | PostgreSQL (`pgvector` with HNSW indexing for taste similarity) |
| **Payments** | RevenueCat (iOS / StoreKit entitlements) |
| **Analytics** | PostHog (event tracking, conversion funnels, retention cohorts) |
| **Observability** | Sentry (crash reporting, structured error tracking) |
| **APIs** | TMDB (metadata), JustWatch (availability), OMDb (ratings) |
| **Language** | TypeScript (Strict mode across mobile client + Deno runtime) |

---

## Core Architecture

```text
User Interface (Expo Router Tabs)
       ↓
State Management (React Hooks + Supabase Realtime)
       ↓
Edge Functions (Deno-based business logic + RLS enforcement)
       ↓
PostgreSQL (Immutable append-only film model + pgvector embeddings)
```

### Key Engineering Decisions

* **Taste Vector Matching:** User preferences are stored as `pgvector` embeddings. Gauntlet candidate generation runs cosine similarity via HNSW indexing directly in PostgreSQL for low-latency ($O(\log n)$) personalized retrieval.
* **Zero Data Leakage (RLS):** All Supabase database access is secured via granular Row-Level Security (RLS) policies using `auth.uid()` and strict session validations.
* **Immutable Film Data:** Film records from TMDB are never hard-deleted; status transitions are handled via curation tiers to preserve analytical and historical data integrity.
* **Atomic Gauntlet State Machine:** Tournament progression follows an explicit 5-state machine (`pending feedback → waiting → rounds 1-3 → champion`). Choice submissions are executed via transactional RPC calls to eliminate concurrent mutation anomalies.
* **Offline-First Resilience:** Gauntlet rounds and state are cached locally. A single-operation offline queue records actions and auto-flushes upon network recovery.

---

## Features

- [x] Anonymous onboarding (immediate gauntlet playthrough)
- [x] Daily gauntlet generation via taste vector matching
- [x] 3-round elimination tournament UI
- [x] Watch provider integration (JustWatch, TMDB)
- [x] Daily streak tracking & historical archive
- [x] Offline gauntlet playthrough + background auto-sync
- [x] Chosy Pro subscription pipeline via RevenueCat
- [x] Comprehensive telemetry & crash observability (PostHog & Sentry)

---

## Product Evolution & Post-Mortems

### v1.0 (2024–2025) — Mood-Based Swipe Discovery `[Retired]`
* **Concept:** Tinder-style infinite swipe interface based on mood tags (relaxing, intense, etc.).
* **Why it failed:** Recommendation fatigue. Users swiped through 50+ titles without committing. DAU retention flatlined at 14%.
* **Key Learning:** High swipe volume compounds decision paralysis. Structured elimination builds far more choice confidence than ranked lists.

### v2.0 (June–July 2026) — Multi-Game Discovery Hub `[Retired]`
* **Concept:** 7 distinct mini-games making film discovery a side-effect of gameplay.
* **Why it failed:** 30–45 minute game sessions competed directly with the time users set aside to actually watch movies.
* **Key Learning:** Discovery rituals must be tight (under 5 minutes) and fit seamlessly into an evening wind-down routine.

### v3.0 (August 2026) — The Daily Gauntlet `[Current Production Beta]`
* **Concept:** Single 5-minute ritual: 4 films, 3 binary choices, 1 winner.
* **Beta Cohort Metrics:** ~15 active testers, **>70% 7-day gauntlet completion**, and an **88% watch-through rate** on winning recommendations.

---

## Getting Started

### Prerequisites

* Node.js >= 18
* Git
* Expo Go app (on a physical device) or an iOS Simulator

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mertkanylmaz/chosy.git
   cd chosy
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env.local
   ```
   Add your Supabase and API credentials inside `.env.local`.

4. **Start the Development Server:**
   ```bash
   npx expo start
   ```
   * Press `i` to launch in the iOS Simulator.
   * Scan the terminal QR code with the iOS Camera app to run via Expo Go.

---

## Engineering Standards & Observability

* **Type Safety:** TypeScript strict mode enforced across 100% of client scripts and backend edge functions.
* **Automated Guardrails:** Pre-commit hooks (`.githooks/pre-commit`) gate all commits behind clean typecheck runs.
* **Schema Governance:** DDL operations are executed strictly via migration scripts (`supabase db push`). Direct web console schema edits are prohibited.
* **Resilience Targets:** P95 gauntlet generation latency under 200ms; production crash-free rate target above 99.5%.

---

## Roadmap

* **September 2026 (Beta → App Store):** Pre-launch marketing milestones, App Store submission & review.
* **Q4 2026:** Cinema DNA radar visualization (6-axis taste profile), Watchlist management & social gauntlet sharing.
* **2027:** Multi-platform expansion (Android via Expo), critic & community tournament integrations.

---

## Author

**Mertkan Yılmaz** — Founder & Architect  
* Status: Beta (App Store Launch: September 2026)
* License: Proprietary. All rights reserved © 2025–2026 Chosy.
