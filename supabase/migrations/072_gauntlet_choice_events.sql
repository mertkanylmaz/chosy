-- ============================================================================
-- Migration 072: submit-choice (B.4) on kosullari
--
-- Uc bagimsiz degisiklik, hepsi B.4 tarafindan ZORUNLU kilindi ve CTO onayi
-- alindi (7 Agu 2026, AskUserQuestion):
--   A) choice_events idempotency kisiti (partial UNIQUE)
--   B) watchlist.watched_source kolonu + CHECK
--   C) app_config yenileme limiti anahtarlari
--
-- 069 numaralandirma notu: en yuksek mevcut 071, bu dosya 072.
-- ============================================================================


-- ─── A) choice_events idempotency ───────────────────────────────────────────
--
-- Aynı (gauntlet_id, round) icin ikinci bir POST yeni satir ACMAMALI.
--
-- DUZ `UNIQUE (gauntlet_id, round)` YAZILAMAZ — B.3'te netlesen kurala gore
-- 'neither' ve 'seen' TUR HARCAMAZ: kullanici ayni turda birden fazla kez
-- "ikisi de olmaz" / "bunu izledim" diyebilir ve bunlarin HER BIRI ayri bir
-- ham olaydir (069 prensibi: ham olaylari sakla). Duz kisit bu satirlarin
-- ikincisini DB seviyesinde reddeder ve Cinema DNA kaynagini eksiltir.
--
-- Bu yuzden kisit yalnizca TUR ILERLETEN sonuclara uygulanir. 'choice' ve
-- 'timeout' turu tuketir; her tur icin en fazla bir tanesi olabilir.
--
-- Partial index secildi (CHECK/EXCLUDE degil): 069'daki
-- duel_impressions_user_pair_uniq ile ayni desen, ayni gerekce.

CREATE UNIQUE INDEX choice_events_gauntlet_round_advancing_uniq
  ON choice_events (gauntlet_id, round)
  WHERE outcome IN ('choice', 'timeout');

COMMENT ON INDEX choice_events_gauntlet_round_advancing_uniq IS
  'Idempotency: tur basina tek ilerletici olay. neither/seen BILINCLI OLARAK '
  'kisit disinda — bu iki sonuc tur harcamaz ve tekrar edebilir (B.3 kurali).';


-- ─── B) watchlist.watched_source ────────────────────────────────────────────
--
-- submit-choice'un 'seen' dali izlenmis filmi watchlist.watched_at ile
-- isaretler. Kaynak bilgisi olmadan yazilan satir geri donusu olmayan bir
-- belirsizlik uretir: C.4 geldiginde "bu satiri kim yazdi" sorusunun cevabi
-- kalmaz ve geriye donuk doldurma mumkun olmaz. Bu yuzden kolon C.4'ten
-- one alindi.
--
-- CHECK ile uc gecerli deger simdiden kilitlenir — string belirsizligi
-- birakilmaz. NULL serbest: 002'den beri var olan eski satirlarin kaynagi
-- gercekten bilinmiyor ve uydurulmaz.
--   manual            — kullanici elle isaretledi
--   gauntlet_feedback — gauntlet turunda 'seen' dedi (B.4)
--   local_sync        — cihaz yerel durumundan senkronlandi

ALTER TABLE watchlist
  ADD COLUMN IF NOT EXISTS watched_source TEXT;

ALTER TABLE watchlist
  ADD CONSTRAINT watchlist_watched_source_valid
  CHECK (watched_source IN ('manual', 'gauntlet_feedback', 'local_sync'));

COMMENT ON COLUMN watchlist.watched_source IS
  'watched_at sinyalinin kaynagi. NULL = 072 oncesi yazilmis, kaynagi '
  'bilinmiyor (uydurulmadi).';


-- ─── C) Yenileme limiti (app_config) ────────────────────────────────────────
--
-- submit-choice bu iki anahtari LAZY okur. Kod ici sabit YASAK (CLAUDE.md
-- kural 6) — ayrica generate-gauntlet'te de bir yenileme sabiti var ve iki
-- yerde iraksamasi kacinilmazdi.
--
-- -1 = sinirsiz. Sentinel migration 021'in quota sozlesmesiyle birebir ayni
-- ('IF v_limit != -1'), yeni bir konvansiyon icat edilmiyor.
--
-- ON CONFLICT DO NOTHING = idempotent seed (071'in gerekcesi aynen gecerli):
-- migration tekrar calisirsa ya da deger elle ayarlanmissa mevcut deger
-- korunur. Bu, yasakli "sessiz fallback" ile ayni sey DEGILDIR.

INSERT INTO app_config (key, value, description) VALUES
  (
    'gauntlet_refresh_limit_free',
    '2'::jsonb,
    'Free kullanici icin gun basina yenileme hakki (neither/seen). Tur harcamayan her sonuc bir hak tuketir.'
  ),
  (
    'gauntlet_refresh_limit_pro',
    '-1'::jsonb,
    'Pro/lifetime kullanici icin gun basina yenileme hakki. -1 = sinirsiz (migration 021 quota sozlesmesiyle ayni sentinel).'
  )
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- DOWN SCRIPT — geri alma (elle calistirilir, migration olarak DEGIL)
--
-- DROP INDEX IF EXISTS choice_events_gauntlet_round_advancing_uniq;
--
-- ALTER TABLE watchlist DROP CONSTRAINT IF EXISTS watchlist_watched_source_valid;
-- ALTER TABLE watchlist DROP COLUMN IF EXISTS watched_source;
--
-- DELETE FROM app_config WHERE key IN (
--   'gauntlet_refresh_limit_free',
--   'gauntlet_refresh_limit_pro'
-- );
-- ============================================================================
