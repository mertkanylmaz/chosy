-- ============================================================
-- 083_watchlist_owner_update_policy.sql
-- watchlist tablosunda owner UPDATE RLS policy'si eksikti (008'de yalnızca
-- SELECT/INSERT/DELETE eklenmişti). C.4 kurtarma senkronu (watchSync.ts)
-- watched_at'i client'tan koşullu UPDATE etmek için buna ihtiyaç duyuyor —
-- policy yokken UPDATE hata vermeden 0 satır etkiliyor (sessiz başarısızlık).
-- ============================================================

DROP POLICY IF EXISTS "watchlist: owner update" ON watchlist;

CREATE POLICY "watchlist: owner update"
  ON watchlist FOR UPDATE
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

-- DOWN SCRIPT (manuel):
-- DROP POLICY IF EXISTS "watchlist: owner update" ON watchlist;
