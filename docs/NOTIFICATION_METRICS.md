# Notification Analytics & Metrics

## Key Metrics

### Open Rate by Type
```sql
SELECT
  type,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent,
  COUNT(*) FILTER (WHERE status = 'opened') AS opened,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'opened')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE status = 'sent'), 0) * 100,
    1
  ) AS open_rate_pct
FROM notification_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY type
ORDER BY open_rate_pct DESC;
```

### Open Rate by Hour
```sql
SELECT
  EXTRACT(HOUR FROM scheduled_for) AS hour,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent,
  COUNT(*) FILTER (WHERE status = 'opened') AS opened,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'opened')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE status = 'sent'), 0) * 100,
    1
  ) AS open_rate_pct
FROM notification_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY hour
ORDER BY hour;
```

### Conversion Rate (Notification Open -> Action)
```sql
-- Notifications that led to a mood search within 30 minutes
SELECT
  nl.type,
  COUNT(DISTINCT nl.id) AS opened,
  COUNT(DISTINCT ms.id) AS conversions,
  ROUND(
    COUNT(DISTINCT ms.id)::numeric /
    NULLIF(COUNT(DISTINCT nl.id), 0) * 100,
    1
  ) AS conversion_pct
FROM notification_log nl
LEFT JOIN mood_searches ms
  ON ms.user_id = nl.user_id
  AND ms.searched_at BETWEEN nl.opened_at AND nl.opened_at + INTERVAL '30 minutes'
WHERE nl.status = 'opened'
  AND nl.created_at > NOW() - INTERVAL '30 days'
GROUP BY nl.type
ORDER BY conversion_pct DESC;
```

### Opt-Out Rate
```sql
SELECT
  COUNT(*) FILTER (WHERE push_enabled = true AND push_token IS NOT NULL) AS opted_in,
  COUNT(*) FILTER (WHERE push_enabled = false AND push_token IS NOT NULL) AS opted_out,
  COUNT(*) FILTER (WHERE push_token IS NULL) AS no_token,
  ROUND(
    COUNT(*) FILTER (WHERE push_enabled = false AND push_token IS NOT NULL)::numeric /
    NULLIF(COUNT(*) FILTER (WHERE push_token IS NOT NULL), 0) * 100,
    1
  ) AS opt_out_rate_pct
FROM users;
```

### Win-Back Effectiveness
```sql
SELECT
  type,
  COUNT(*) AS sent,
  COUNT(*) FILTER (WHERE status = 'opened') AS opened,
  -- Users who returned (last_activity_at updated after notification)
  COUNT(DISTINCT nl.user_id) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = nl.user_id
      AND u.last_activity_at > nl.sent_at
      AND u.winback_stage IS NULL
    )
  ) AS returned_users
FROM notification_log nl
WHERE type LIKE 'winback_%'
  AND created_at > NOW() - INTERVAL '90 days'
GROUP BY type
ORDER BY type;
```

### Daily Notification Volume
```sql
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE status = 'opened') AS opened
FROM notification_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

### Streak Reward Impact
```sql
SELECT
  sr.streak_days,
  sr.bonus_searches,
  sr.slot_tokens,
  COUNT(DISTINCT nl.user_id) AS users_rewarded,
  -- Retention: users still active 7 days after reward
  COUNT(DISTINCT nl.user_id) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM user_daily_quotas q
      WHERE q.user_id = nl.user_id
      AND q.date BETWEEN DATE(nl.created_at) + 1 AND DATE(nl.created_at) + 7
      AND q.searches_used > 0
    )
  ) AS retained_7d
FROM notification_log nl
JOIN streak_rewards sr ON nl.data->>'streak_days' = sr.streak_days::text
WHERE nl.type = 'streak_reward'
  AND nl.created_at > NOW() - INTERVAL '90 days'
GROUP BY sr.streak_days, sr.bonus_searches, sr.slot_tokens
ORDER BY sr.streak_days;
```

## Targets

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Daily hook open rate | > 15% | < 8% |
| Streak warning open rate | > 25% | < 12% |
| Sunday ritual open rate | > 20% | < 10% |
| Win-back Day 14 return rate | > 10% | < 3% |
| Opt-out rate | < 5% | > 10% |
| Notification failure rate | < 2% | > 5% |

## Frequency Rules

- Active users: max 1 notification/day
- Churned users (win-back): max 1/week per stage
- Quiet hours: 22:00-08:00 user TZ (streak warning exception at 22:00)
- 90+ days inactive: stop all notifications
