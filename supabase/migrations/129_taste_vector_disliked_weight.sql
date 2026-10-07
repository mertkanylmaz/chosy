-- ============================================================================
-- 129_taste_vector_disliked_weight.sql
-- taste_vector_config.feedback_weights.disliked = abandoned ile AYNI değer.
--
-- Karar (CTO, 7 Eki 2026): ikisi de güçlü negatif sinyal, ayar yapacak veri
-- yok (watch_feedback 3 satır). Başlangıç değeri abandoned'dan KOPYALANIR
-- (şu an -3.0); sonra deploy'suz app_config'ten ayrı ayarlanır. `abandoned`
-- anahtarı kalır.
--
-- SIRA ÖNEMLİ: validateTasteVectorConfig artık 'disliked' anahtarını ZORUNLU
-- sayar. Bu migration kod deploy'undan ÖNCE uygulanmalı; yoksa
-- recompute-taste-vector "feedback_weights['disliked'] sayi degil" ile düşer.
--
-- İdempotent: 'disliked' zaten varsa DOKUNULMAZ (elle ayarlanmış değer
-- ezilmez). 'abandoned' yoksa (beklenmeyen durum) sessizce NULL yazmak yerine
-- migration açıkça HATA verir.
-- ============================================================================

DO $$
DECLARE
  cfg jsonb;
BEGIN
  SELECT value INTO cfg FROM app_config WHERE key = 'taste_vector_config';

  IF cfg IS NULL THEN
    RAISE EXCEPTION 'taste_vector_config satiri yok';
  END IF;
  IF NOT (cfg->'feedback_weights' ? 'abandoned') THEN
    RAISE EXCEPTION 'feedback_weights.abandoned yok — disliked icin kopyalanacak deger belirsiz';
  END IF;

  IF NOT (cfg->'feedback_weights' ? 'disliked') THEN
    UPDATE app_config
       SET value = jsonb_set(
             value,
             '{feedback_weights,disliked}',
             value->'feedback_weights'->'abandoned',
             true
           )
     WHERE key = 'taste_vector_config';
  END IF;
END
$$;

-- ============================================================================
-- DOWN SCRIPT — geri alma (elle çalıştırılır, migration olarak DEĞİL)
--
-- UPDATE app_config
--    SET value = value #- '{feedback_weights,disliked}'
--  WHERE key = 'taste_vector_config';
--
-- ⚠️ Önce kod geri alınmalı (validateTasteVectorConfig 'disliked' ister).
-- watch_feedback'te response='disliked' satırı varken anahtar silinirse o
-- satırlar unknown_feedback_response'a düşer (sinyal sessizce sıfırlanır).
-- ============================================================================
