-- Migration 064: public_daily_puzzles — çözüm sızıntısını kapat (Hard Rule 1)
--
-- Tespit (29 Tem 2026, prod): view `puzzle_data.film_title` alanını olduğu gibi
-- geçiriyordu. CineMetrics/Logline/FadeIn/Detective/Quoted'da film ADI cevabın
-- kendisidir — yani cevap düz metin olarak istemciye iniyordu. Ayrıca:
--   * Imposter: `rounds[].imposter_ids` ve `all_imposter_ids` (057 yalnızca üst
--     seviye `imposter_actor_id`'yi siliyordu)
--   * FadeIn: `hints[].content` (yönetmen + konu özeti = cevap)
--
-- Kural: cevap türetmeye yarayan hiçbir alan view'dan çıkmaz.
--   * Imposter'da film adı ekranın parçasıdır (cevap AKTÖR) → korunur.
--   * FadeIn'de poster bulmacanın kendisidir → korunur (blur istemcide;
--     sunucu tarafı blur ayrı iş olarak açıldı).
--   * FadeIn ipuçlarının yalnızca `order` + `type`'ı iner; `content`
--     submit-guess'in reveal dalından gelir (kredi kontrolü zaten sunucuda).
--
-- CREATE OR REPLACE kullanılır → mevcut GRANT'lar korunur.

CREATE OR REPLACE VIEW public_daily_puzzles AS
SELECT
  p.id,
  p.game_type                                          AS game_id,
  p.date                                               AS puzzle_date,
  p.difficulty,
  CASE
    -- Imposter: film adı kalır, sahte aktör kimlikleri her seviyeden silinir
    WHEN p.game_type = 'imposter' THEN
      s.common || jsonb_build_object('rounds', COALESCE(r.rounds, '[]'::jsonb))
    -- FadeIn: poster kalır, ipucu içerikleri sunucuda kalır
    WHEN p.game_type = 'fadein' THEN
      (s.common - 'film_title' - 'tmdb_id')
        || jsonb_build_object('hints', COALESCE(h.hints, '[]'::jsonb))
    -- Diğer tüm oyunlar: filmi tanımlayan her alan silinir
    ELSE
      s.common - 'film_title' - 'tmdb_id' - 'poster_url'
  END                                                  AS puzzle_data,
  p.max_attempts,
  p.created_at
FROM daily_puzzles p
CROSS JOIN LATERAL (
  SELECT COALESCE(p.puzzle_data, p.clues, '{}'::jsonb)
           - 'solution'
           - 'redaction_words'
           - 'imposter_actor_id'
           - 'all_imposter_ids'                        AS common
) s
LEFT JOIN LATERAL (
  SELECT jsonb_agg(elem - 'imposter_ids' ORDER BY ord) AS rounds
  FROM jsonb_array_elements(p.puzzle_data -> 'rounds') WITH ORDINALITY AS t(elem, ord)
  WHERE p.game_type = 'imposter'
    AND jsonb_typeof(p.puzzle_data -> 'rounds') = 'array'
) r ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
           jsonb_build_object('order', elem -> 'order', 'type', elem -> 'type')
           ORDER BY ord
         )                                             AS hints
  FROM jsonb_array_elements(p.puzzle_data -> 'hints') WITH ORDINALITY AS t(elem, ord)
  WHERE p.game_type = 'fadein'
    AND jsonb_typeof(p.puzzle_data -> 'hints') = 'array'
) h ON true
WHERE p.validation_status = 'valid'
  AND p.is_emergency_pool = false
  AND p.date IS NOT NULL;

GRANT SELECT ON public_daily_puzzles TO anon, authenticated, service_role;
