# Investor Metrics Dashboard — Chosy.ai

> Supabase SQL Editor saved queries for investor meetings.
> Last updated: 2026-05-18

---

## 1. User Growth

```sql
-- Total registered users
SELECT COUNT(*) AS total_users FROM users;

-- MAU (Monthly Active Users) — last 30 days
SELECT COUNT(DISTINCT user_id) AS mau
FROM mood_searches
WHERE created_at >= NOW() - INTERVAL '30 days';

-- DAU (Daily Active Users) — today
SELECT COUNT(DISTINCT user_id) AS dau
FROM mood_searches
WHERE created_at >= CURRENT_DATE;

-- DAU trend (last 30 days)
SELECT
  DATE(created_at) AS day,
  COUNT(DISTINCT user_id) AS dau
FROM mood_searches
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day;

-- New users per day (last 30 days)
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS new_users
FROM users
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day;
```

## 2. Subscription & Revenue

```sql
-- Paid users by tier
SELECT
  subscription_tier,
  COUNT(*) AS user_count
FROM users
WHERE subscription_tier != 'free'
GROUP BY subscription_tier
ORDER BY user_count DESC;

-- Conversion rate (free -> paid)
SELECT
  ROUND(
    (SELECT COUNT(*)::DECIMAL FROM users WHERE subscription_tier != 'free') /
    NULLIF((SELECT COUNT(*)::DECIMAL FROM users), 0) * 100,
    2
  ) AS conversion_rate_percent;

-- MRR estimate
SELECT
  SUM(CASE
    WHEN subscription_tier = 'monthly' THEN 6.99
    WHEN subscription_tier = 'weekly_legacy' THEN 1.99 * 4.33
    WHEN subscription_tier = 'annual' THEN 39.99 / 12
    WHEN subscription_tier = 'lifetime' THEN 0  -- One-time, not recurring
    ELSE 0
  END) AS estimated_mrr
FROM users
WHERE subscription_tier != 'free';

-- ARR estimate
SELECT
  SUM(CASE
    WHEN subscription_tier = 'monthly' THEN 6.99 * 12
    WHEN subscription_tier = 'weekly_legacy' THEN 1.99 * 52
    WHEN subscription_tier = 'annual' THEN 39.99
    WHEN subscription_tier = 'lifetime' THEN 0
    ELSE 0
  END) AS estimated_arr
FROM users
WHERE subscription_tier != 'free';

-- Lifetime sales progress
SELECT
  COUNT(*) AS sold,
  1000 - COUNT(*) AS remaining,
  ROUND(COUNT(*)::DECIMAL / 1000 * 100, 1) AS percent_sold,
  SUM(price_paid) AS total_revenue
FROM lifetime_sales;
```

## 3. Engagement Metrics

```sql
-- Avg mood searches per user per day (active users)
SELECT
  ROUND(AVG(daily_searches), 1) AS avg_searches_per_day
FROM (
  SELECT
    user_id,
    DATE(created_at) AS day,
    COUNT(*) AS daily_searches
  FROM mood_searches
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY user_id, DATE(created_at)
) sub;

-- Avg games played per user per day
SELECT
  ROUND(AVG(daily_games), 1) AS avg_games_per_day
FROM (
  SELECT
    user_id,
    DATE(created_at) AS day,
    COUNT(*) AS daily_games
  FROM game_sessions
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY user_id, DATE(created_at)
) sub;

-- Swipe engagement (likes vs passes)
SELECT
  COUNT(*) FILTER (WHERE action = 'like') AS likes,
  COUNT(*) FILTER (WHERE action = 'pass') AS passes,
  ROUND(
    COUNT(*) FILTER (WHERE action = 'like')::DECIMAL /
    NULLIF(COUNT(*), 0) * 100,
    1
  ) AS like_rate_percent
FROM swipe_actions
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Watchlist additions per user (avg)
SELECT
  ROUND(AVG(wl_count), 1) AS avg_watchlist_size
FROM (
  SELECT user_id, COUNT(*) AS wl_count
  FROM watchlist
  GROUP BY user_id
) sub;
```

## 4. Retention

```sql
-- D1, D7, D30 retention
-- D1 Retention
SELECT
  ROUND(
    (SELECT COUNT(DISTINCT m2.user_id)
     FROM users u2
     JOIN mood_searches m2 ON m2.user_id = u2.id
       AND DATE(m2.created_at) = DATE(u2.created_at) + 1
     WHERE u2.created_at >= NOW() - INTERVAL '30 days')::DECIMAL /
    NULLIF((SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days'), 0) * 100,
    1
  ) AS d1_retention_percent;

-- D7 Retention
SELECT
  ROUND(
    (SELECT COUNT(DISTINCT m2.user_id)
     FROM users u2
     JOIN mood_searches m2 ON m2.user_id = u2.id
       AND DATE(m2.created_at) BETWEEN DATE(u2.created_at) + 6 AND DATE(u2.created_at) + 8
     WHERE u2.created_at >= NOW() - INTERVAL '60 days')::DECIMAL /
    NULLIF((SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '60 days'), 0) * 100,
    1
  ) AS d7_retention_percent;

-- D30 Retention
SELECT
  ROUND(
    (SELECT COUNT(DISTINCT m2.user_id)
     FROM users u2
     JOIN mood_searches m2 ON m2.user_id = u2.id
       AND DATE(m2.created_at) BETWEEN DATE(u2.created_at) + 28 AND DATE(u2.created_at) + 32
     WHERE u2.created_at >= NOW() - INTERVAL '90 days')::DECIMAL /
    NULLIF((SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '90 days'), 0) * 100,
    1
  ) AS d30_retention_percent;

-- Cohort retention curve (weekly cohorts)
WITH cohorts AS (
  SELECT
    id AS user_id,
    DATE_TRUNC('week', created_at) AS cohort_week
  FROM users
  WHERE created_at >= NOW() - INTERVAL '8 weeks'
),
activity AS (
  SELECT DISTINCT
    user_id,
    DATE_TRUNC('week', created_at) AS active_week
  FROM mood_searches
  WHERE created_at >= NOW() - INTERVAL '8 weeks'
)
SELECT
  c.cohort_week,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT CASE WHEN a.active_week = c.cohort_week + INTERVAL '1 week' THEN c.user_id END) AS w1,
  COUNT(DISTINCT CASE WHEN a.active_week = c.cohort_week + INTERVAL '2 weeks' THEN c.user_id END) AS w2,
  COUNT(DISTINCT CASE WHEN a.active_week = c.cohort_week + INTERVAL '3 weeks' THEN c.user_id END) AS w3,
  COUNT(DISTINCT CASE WHEN a.active_week = c.cohort_week + INTERVAL '4 weeks' THEN c.user_id END) AS w4
FROM cohorts c
LEFT JOIN activity a ON c.user_id = a.user_id
GROUP BY c.cohort_week
ORDER BY c.cohort_week;
```

## 5. Viral / Referral

```sql
-- Viral coefficient
SELECT
  ROUND(
    (SELECT COUNT(*)::DECIMAL FROM referrals WHERE status IN ('activated', 'rewarded')) /
    NULLIF((SELECT COUNT(DISTINCT referrer_id) FROM referrals), 0),
    2
  ) AS k_factor;

-- Referral funnel
SELECT
  (SELECT COUNT(*) FROM referrals) AS total_referrals,
  (SELECT COUNT(*) FROM referrals WHERE status = 'pending') AS pending,
  (SELECT COUNT(*) FROM referrals WHERE status IN ('activated', 'rewarded')) AS activated,
  (SELECT COUNT(*) FROM referrals WHERE status = 'expired') AS expired;

-- Top referrers
SELECT
  r.referrer_id,
  u.display_name,
  COUNT(*) AS total_referrals,
  COUNT(*) FILTER (WHERE r.status IN ('activated', 'rewarded')) AS activated
FROM referrals r
JOIN users u ON u.id = r.referrer_id
GROUP BY r.referrer_id, u.display_name
ORDER BY activated DESC
LIMIT 20;
```

## 6. Game Engagement

```sql
-- Games played per game type (last 30 days)
SELECT
  game_id,
  COUNT(*) AS sessions,
  COUNT(DISTINCT user_id) AS unique_players,
  ROUND(AVG(score), 1) AS avg_score
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY game_id
ORDER BY sessions DESC;

-- Game completion rate
SELECT
  game_id,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE completed = true) AS completed,
  ROUND(
    COUNT(*) FILTER (WHERE completed = true)::DECIMAL / NULLIF(COUNT(*), 0) * 100,
    1
  ) AS completion_rate
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY game_id;
```

## Quick Dashboard Summary Query

```sql
-- One query for the key numbers
SELECT
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT COUNT(DISTINCT user_id) FROM mood_searches WHERE created_at >= NOW() - INTERVAL '30 days') AS mau,
  (SELECT COUNT(DISTINCT user_id) FROM mood_searches WHERE created_at >= CURRENT_DATE) AS dau,
  (SELECT COUNT(*) FROM users WHERE subscription_tier != 'free') AS paid_users,
  (SELECT ROUND(
    (SELECT COUNT(*)::DECIMAL FROM users WHERE subscription_tier != 'free') /
    NULLIF((SELECT COUNT(*)::DECIMAL FROM users), 0) * 100, 2
  )) AS conversion_pct,
  (SELECT COUNT(*) FROM lifetime_sales) AS lifetime_sold,
  (SELECT COUNT(*) FROM referrals WHERE status IN ('activated', 'rewarded')) AS active_referrals;
```
