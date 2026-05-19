# Conversion Analytics — Paywall Event Queries

> Table: `paywall_events`
> Columns: id, user_id, variant, trigger_type, trigger_context, action, ab_test_group, created_at

## Conversion Rate by Paywall Variant

```sql
SELECT variant,
  COUNT(*) FILTER (WHERE action='shown') as shown,
  COUNT(*) FILTER (WHERE action='converted') as converted,
  COUNT(*) FILTER (WHERE action='trial_started') as trials,
  ROUND(100.0 * COUNT(*) FILTER (WHERE action='converted') /
        NULLIF(COUNT(*) FILTER (WHERE action='shown'), 0), 2) as conversion_rate
FROM paywall_events
GROUP BY variant
ORDER BY conversion_rate DESC;
```

## A/B Test Winner — Quota Paywall

```sql
SELECT ab_test_group, variant,
  COUNT(*) FILTER (WHERE action='shown') as shown,
  COUNT(*) FILTER (WHERE action='converted') as converted,
  ROUND(100.0 * COUNT(*) FILTER (WHERE action='converted') /
        NULLIF(COUNT(*) FILTER (WHERE action='shown'), 0), 2) as conversion_rate
FROM paywall_events
WHERE variant = 'quota_exhausted'
  AND ab_test_group IS NOT NULL
GROUP BY ab_test_group, variant
ORDER BY conversion_rate DESC;
```

## A/B Test Winner — Streak Paywall

```sql
SELECT ab_test_group,
  COUNT(*) FILTER (WHERE action='shown') as shown,
  COUNT(*) FILTER (WHERE action='converted') as converted,
  ROUND(100.0 * COUNT(*) FILTER (WHERE action='converted') /
        NULLIF(COUNT(*) FILTER (WHERE action='shown'), 0), 2) as conversion_rate
FROM paywall_events
WHERE variant = 'streak_milestone'
  AND ab_test_group IS NOT NULL
GROUP BY ab_test_group
ORDER BY conversion_rate DESC;
```

## Dismissal Rate by Trigger Type

```sql
SELECT trigger_type,
  COUNT(*) FILTER (WHERE action='shown') as shown,
  COUNT(*) FILTER (WHERE action='dismissed') as dismissed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE action='dismissed') /
        NULLIF(COUNT(*) FILTER (WHERE action='shown'), 0), 2) as dismissal_rate
FROM paywall_events
GROUP BY trigger_type
ORDER BY dismissal_rate DESC;
```

## Daily Conversion Trend (Last 30 Days)

```sql
SELECT DATE(created_at) as day,
  COUNT(*) FILTER (WHERE action='shown') as shown,
  COUNT(*) FILTER (WHERE action='converted') as converted,
  ROUND(100.0 * COUNT(*) FILTER (WHERE action='converted') /
        NULLIF(COUNT(*) FILTER (WHERE action='shown'), 0), 2) as conversion_rate
FROM paywall_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

## Streak Milestone Conversion by Days

```sql
SELECT
  (trigger_context->>'days')::int as streak_days,
  COUNT(*) FILTER (WHERE action='shown') as shown,
  COUNT(*) FILTER (WHERE action='converted') as converted
FROM paywall_events
WHERE trigger_type = 'streak_milestone'
GROUP BY streak_days
ORDER BY streak_days;
```

## User Funnel: Shown → Convert (per user, last 7 days)

```sql
SELECT
  COUNT(DISTINCT user_id) FILTER (WHERE action='shown') as users_shown,
  COUNT(DISTINCT user_id) FILTER (WHERE action='converted') as users_converted,
  ROUND(100.0 * COUNT(DISTINCT user_id) FILTER (WHERE action='converted') /
        NULLIF(COUNT(DISTINCT user_id) FILTER (WHERE action='shown'), 0), 2) as user_conversion_rate
FROM paywall_events
WHERE created_at >= NOW() - INTERVAL '7 days';
```
