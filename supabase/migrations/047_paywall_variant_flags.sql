-- Migration 047: paywall variant activation flags
--
-- 5 contextual paywall variant'i deaktif ediyor (false).
-- Geri acma: ilgili key'in value'sunu true yap.
-- Client SAFE_DEFAULTS'ta false → app_config'dan true gelmedikce deaktif.
--
-- Aktif kalan variant'lar (flag'e tabi degil):
--   quota_exhausted, onboarding_complete, watchlist_full, mood_history

INSERT INTO app_config (key, value, description) VALUES
  ('paywall_streak_milestone',  'false'::jsonb, 'Streak milestone paywall variant. true=aktif, false=deaktif'),
  ('paywall_streaming_link',    'false'::jsonb, 'Streaming link paywall variant. true=aktif, false=deaktif'),
  ('paywall_profile_upgrade',   'false'::jsonb, 'Profile upgrade paywall variant. true=aktif, false=deaktif'),
  ('paywall_roulette_limit',    'false'::jsonb, 'Roulette limit paywall variant. true=aktif, false=deaktif'),
  ('paywall_lifetime_soldout',  'false'::jsonb, 'Lifetime soldout paywall variant. true=aktif, false=deaktif')
ON CONFLICT (key) DO NOTHING;
