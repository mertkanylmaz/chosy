# Posterle Backend — Deployment Guide

Production-ready Supabase backend for the Posterle daily poster puzzle game.

## File Inventory

```
supabase/
├── migrations/
│   ├── 017_posterle_game.sql          # Tables, RLS, RPCs, indexes
│   ├── 017_posterle_game.down.sql     # Rollback
│   └── 018_posterle_cron.sql          # pg_cron schedule for daily curation
├── functions/
│   ├── _shared/
│   │   ├── utils.ts                   # CORS, auth, Supabase clients, logging
│   │   └── hints.ts                   # Archetype-aware hint engine
│   ├── curate-daily-puzzle/
│   │   └── index.ts                   # Picks tomorrow's puzzle (cron-triggered)
│   ├── get-todays-puzzle/
│   │   └── index.ts                   # Loads puzzle + user state (spoiler-safe)
│   └── submit-puzzle-guess/
│       └── index.ts                   # Validates guesses, updates streaks
└── tests/
    └── smoke-test.sh                  # Post-deploy verification
```

## Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Existing `users` table with columns: `id UUID`, `archetype TEXT`
- Existing `films` table with columns: `id BIGINT`, `title TEXT`, `original_title TEXT`,
  `alternative_titles TEXT[]`, `poster_url TEXT`, `release_date DATE`, `runtime INT`,
  `director TEXT`, `writer TEXT`, `genres TEXT[]`, `cast TEXT[]`, `mood_tags TEXT[]`,
  `vote_average FLOAT`, `vote_count INT`, `popularity FLOAT`, `original_language TEXT`,
  `plot TEXT`

If your films schema differs, adjust `_shared/hints.ts` `FilmHintContext` and the
SELECT statements in both `get-todays-puzzle` and `submit-puzzle-guess`.

## Deployment Steps

### 1. Apply database migration

```bash
supabase db push
# or apply manually:
psql "$SUPABASE_DB_URL" -f supabase/migrations/017_posterle_game.sql
```

Verify:
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name IN (
  'daily_puzzles', 'puzzle_attempts',
  'puzzle_streaks', 'puzzle_hint_reveals'
);
-- Expected: 4
```

### 2. Deploy edge functions

```bash
supabase functions deploy curate-daily-puzzle
supabase functions deploy get-todays-puzzle
supabase functions deploy submit-puzzle-guess
```

### 3. Set up cron (production only)

```bash
# Set required PG settings first (one-time):
psql "$SUPABASE_DB_URL" <<EOF
ALTER DATABASE postgres
  SET app.settings.supabase_url = '$SUPABASE_URL';
ALTER DATABASE postgres
  SET app.settings.service_role_key = '$SUPABASE_SERVICE_ROLE_KEY';
EOF

# Apply the cron schedule
psql "$SUPABASE_DB_URL" -f supabase/migrations/018_posterle_cron.sql
```

### 4. Backfill the first puzzle manually

The cron won't run until tomorrow at 23:00 UTC, so create today's puzzle:

```bash
curl -X POST \
  "$SUPABASE_URL/functions/v1/curate-daily-puzzle?date=$(date -u +%Y-%m-%d)" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### 5. Run smoke tests

```bash
export SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="..."
export TEST_USER_JWT="..."  # any authenticated user's JWT

chmod +x tests/smoke-test.sh
./tests/smoke-test.sh
```

## Production Hardening Checklist

- [ ] Enable point-in-time recovery on the Supabase database
- [ ] Add Sentry / structured logging webhook for `logError` events
- [ ] Set rate limit on edge function endpoints
  (Supabase Pro: configurable; otherwise add a per-user throttle table)
- [ ] Monitor `v_puzzle_daily_stats` weekly for difficulty drift
  (target: 55-65% win rate average)
- [ ] Schedule a 30-day archive job for `puzzle_attempts` older than 90 days
- [ ] Add monitoring alert: if `daily_puzzles` has no row for `CURRENT_DATE`
  by 02:00 UTC, page on-call (curation failed)

## Operational Runbooks

### Curation failed — no puzzle for today

```sql
-- Diagnose
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'posterle-daily-curation')
ORDER BY start_time DESC LIMIT 5;

-- Force curation
-- (replace YYYY-MM-DD with today)
```

```bash
curl -X POST \
  "$SUPABASE_URL/functions/v1/curate-daily-puzzle?date=YYYY-MM-DD" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### Difficulty calibration

Pull weekly stats:
```sql
SELECT * FROM v_puzzle_daily_stats
WHERE puzzle_date > CURRENT_DATE - INTERVAL '14 days'
ORDER BY puzzle_date DESC;
```

If `win_rate_pct < 30` consistently → broaden popularity bounds in `curate-daily-puzzle/index.ts`.
If `win_rate_pct > 80` consistently → narrow them.

### Skip a bad puzzle

If a curated puzzle is unfair (bad poster quality, recent release, etc.):

```sql
DELETE FROM daily_puzzles WHERE puzzle_date = 'YYYY-MM-DD';
-- Then re-curate
```

```bash
curl -X POST "$SUPABASE_URL/functions/v1/curate-daily-puzzle?date=YYYY-MM-DD" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

NB: any user who already played that date will keep their attempt referencing
the old film_id — issue them an apology and freeze token.

## Security Notes

- All user-data mutations go through edge functions, never direct PostgREST.
- RLS protects `puzzle_attempts` and `puzzle_streaks` so even compromised
  anon keys cannot read other users' game state.
- `get_puzzle_candidates` is SECURITY DEFINER but accessible only to
  service_role — it's a read-only query, no injection surface.
- Guess validation uses normalized fuzzy matching server-side. Client never
  receives the answer until game ends.

## Known Limitations

1. **Optimistic locking, not pessimistic.** The submit function uses
   `.eq('attempts_used', ...)` as a version check. Under extreme concurrency
   (same user submitting from two devices simultaneously), one request will
   get a 409. The client should retry once.

2. **TMDb terms of service.** Modifying posters (pixelation) sits in a gray
   area. Keep this a free feature with clear "Powered by TMDb" attribution.
   Consult counsel before paywalling.

3. **Curation pool depletion.** With 180-day exclusion and ~500-1000 eligible
   films per difficulty tier, you'll exhaust the pool in ~2 years. Plan
   to expand the films catalog before then.

4. **Time zones.** All "today" calculations use UTC. Users in UTC+12 see a
   new puzzle ~12 hours before users in UTC-12. This matches Wordle's model
   and is the simplest correct behavior.
