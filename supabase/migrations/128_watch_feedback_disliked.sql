-- ============================================================================
-- 128_watch_feedback_disliked.sql
-- Watch-feedback T1 — response CHECK'ine 'disliked' eklenir ("Not for me").
--
-- Semantik (CTO, 7 Eki 2026; bible v1.46, K-29):
--   loved / ok / disliked  → satisfaction sinyali; watched_at yazar
--   abandoned              → LEGACY davranış sinyali; kümede KALIR, yeni UI'dan
--                            çıkar. "Not for me" DEĞİLDİR. Silinmez, yeniden
--                            adlandırılmaz, yeniden anlamlandırılmaz.
--   not_watched / skipped  → watched_at yazmaz (persistence DEĞİŞMEDİ)
--
-- `response` gerçek enum değil, text + CHECK (T0 ölçümü) → ADD VALUE ve
-- transaction kısıtı geçerli değil; 086 deseni: DROP + ADD CONSTRAINT.
-- Kısıt GENİŞLİYOR (mevcut her değer geçerli kalır): hiçbir satır reddedilmez,
-- veri değişmez.
--
-- Bu migration `app_config`'e dokunmaz — bkz. 129. Uygulama sırası (prod):
-- 128 → 129 → submit-watch-feedback / recompute-taste-vector deploy → OTA.
-- ============================================================================

ALTER TABLE watch_feedback
  DROP CONSTRAINT IF EXISTS watch_feedback_response_check;

ALTER TABLE watch_feedback
  ADD CONSTRAINT watch_feedback_response_check
  CHECK (response IN ('loved','ok','disliked','abandoned','not_watched','skipped'));

-- ============================================================================
-- DOWN SCRIPT — geri alma (elle çalıştırılır, migration olarak DEĞİL)
--
-- ⚠️ response = 'disliked' satırı VARSA ADD CONSTRAINT BAŞARISIZ OLUR
-- (kısıt doğrulaması mevcut satırları tarar). Önce kontrol:
--   SELECT count(*) FROM watch_feedback WHERE response = 'disliked';
-- Sıfır değilse geri alma yapılamaz; satırları silmek/yeniden etiketlemek
-- kural #6 (append-only) gereği ayrı CTO kararıdır — otomatik yapılmaz.
--
-- ALTER TABLE watch_feedback DROP CONSTRAINT IF EXISTS watch_feedback_response_check;
-- ALTER TABLE watch_feedback
--   ADD CONSTRAINT watch_feedback_response_check
--   CHECK (response IN ('loved','ok','abandoned','not_watched','skipped'));
-- ============================================================================
