-- ============================================================
-- Chosy — mood_searches günlük tekil kısıtını kaldır
-- 134_mood_searches_drop_daily_unique.sql  (PRO-FIX-2)
--
-- `mood_searches_user_id_search_date_key` UNIQUE (user_id, search_date) hiçbir
-- migration'da yok (tablo Dashboard'dan geldi, bkz. 012 CREATE TABLE IF NOT EXISTS
-- no-op notu); `search_date date NOT NULL DEFAULT CURRENT_DATE` kolonu da öyle.
-- Sonuç: kullanıcının günün 2. ve sonraki aramasında parse-mood INSERT'i 23505 ile
-- düşüyor, search_id dönmüyor (REACT-NATIVE-H "search_id_missing") ve
-- mood_searches UPDATE'i atlanıyor.
--
-- Bu kısıta dayanan hiçbir şey yok (canlı tarama, 22 Eki 2026):
--   - public şemasında mood_searches'e değinen SQL fonksiyonu: 0
--   - ON CONFLICT / search_date geçen fonksiyon, view, policy, trigger, cron: 0
--     (tek view v_mood_searches_recent search_date kullanmaz)
--   - mood_searches'e FK veren tablo: yok
--   - Edge Function'lar (repo + canlı parse-mood v41): düz INSERT/SELECT
--   - İstemci: recordMoodSearch düz INSERT, countSearchesSince searched_at ile sayar
--   - Kota: check_and_consume_quota mood_searches'e bakmaz.
-- Canlıda aynı (user_id, gün) için 2 satır yok (103 satır) — kısıt hiç çiğnenemedi.
--
-- Kolon (search_date) silinmez; yalnız kısıt (ve onun unique index'i) kalkar.
-- Geri alma: ADD CONSTRAINT ... UNIQUE (user_id, search_date) — yalnız o güne dek
-- gün başına tek satır kaldıysa mümkün; bilerek geri alınmaz.
-- ============================================================

ALTER TABLE public.mood_searches
  DROP CONSTRAINT IF EXISTS mood_searches_user_id_search_date_key;
