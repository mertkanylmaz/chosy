-- MOOD-VEC-2b Faz 2C (parça 18/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- Prometheus (2012) 7/709327 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ea4ad9a0-7cba-47f8-8305-9600c03e79e4' AND curation_tier = 'extended' AND release_date = '2012-05-30' AND imdb_votes = 709327 AND imdb_id = 'tt1446714' AND imdb_rating = 7;
-- Close-Up (1990) 8.2/27626 → core
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ebabdfd2-d8c6-48bb-8ffb-ccb6e06f738e' AND curation_tier = 'core' AND release_date = '1990-05-09' AND imdb_votes = 27626 AND imdb_rating = 8.2;
-- The Contractor (2022) 5.8/36348 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ec387422-9142-407f-accf-5c8fe1fe94d7' AND curation_tier = 'extended' AND release_date = '2022-03-10' AND imdb_votes = 36348 AND imdb_id = 'tt10323676' AND imdb_rating = 5.8;
-- John Wick: Chapter 3 - Parabellum (2019) 7.4/490426 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ed7e8abd-6a71-4d43-b01c-4d998e960860' AND curation_tier = 'extended' AND release_date = '2019-05-15' AND imdb_votes = 490426 AND imdb_id = 'tt6146586' AND imdb_rating = 7.4;
-- Empire of the Sun (1987) 7.7/145380 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ee6d3138-3887-4fb2-861f-d08a5e0d4277' AND curation_tier = 'extended' AND release_date = '1987-12-09' AND imdb_votes = 145380 AND imdb_id = 'tt0092965' AND imdb_rating = 7.7;
-- Carol (2015) 7.3/155457 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ee8b1e5b-4e5e-4cdb-8a9e-969b531cddd1' AND curation_tier = 'extended' AND release_date = '2015-11-20' AND imdb_votes = 155457 AND imdb_id = 'tt2402927' AND imdb_rating = 7.3;
-- Sonic the Hedgehog (2020) 6.5/197693 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'efbadd0e-ee8e-488f-b39e-160e782fe41d' AND curation_tier = 'extended' AND release_date = '2020-02-12' AND imdb_votes = 197693 AND imdb_id = 'tt3794354' AND imdb_rating = 6.5;
-- Fatherhood (2021) 6.6/47595 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f0127741-2948-4d4f-aa15-271a646de577' AND curation_tier = 'extended' AND release_date = '2021-06-18' AND imdb_votes = 47595 AND imdb_id = 'tt4733624' AND imdb_rating = 6.6;
-- Abigail (2024) 6.5/125148 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f060adba-9da0-4d23-9f53-6be399235f07' AND curation_tier = 'extended' AND release_date = '2024-04-16' AND imdb_votes = 125148 AND imdb_id = 'tt27489557' AND imdb_rating = 6.5;
-- Sling Blade (1996) 8/105088 → core
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f187fd0b-0cc6-4686-bd81-be4cf9c47ad1' AND curation_tier = 'core' AND release_date = '1996-08-30' AND imdb_votes = 105088 AND imdb_id = 'tt0117666' AND imdb_rating = 8;
-- Batman (1989) 7.5/437645 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f18e3003-dbb6-4bcc-929e-f0c9a69f54e9' AND curation_tier = 'extended' AND release_date = '1989-06-21' AND imdb_votes = 437645 AND imdb_id = 'tt0096895' AND imdb_rating = 7.5;
-- A Few Good Men (1992) 7.8/323948 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f39abb51-d61d-45b0-812a-b46d38376ad7' AND curation_tier = 'extended' AND release_date = '1992-12-11' AND imdb_votes = 323948 AND imdb_id = 'tt0104257' AND imdb_rating = 7.8;
-- The Fly (1986) 7.6/228889 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f3ea6f4e-b01a-45ed-99f1-aadad58e748f' AND curation_tier = 'extended' AND release_date = '1986-08-15' AND imdb_votes = 228889 AND imdb_id = 'tt0091064' AND imdb_rating = 7.6;
-- The Six Triple Eight (2024) 6.7/33217 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f42b7399-b6d5-4187-947b-242b36b2a37b' AND curation_tier = 'extended' AND release_date = '2024-12-06' AND imdb_votes = 33217 AND imdb_id = 'tt24458622' AND imdb_rating = 6.7;
-- Back to the Future Part III (1990) 7.5/528305 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f4cab7d1-8060-45cc-84a1-a48c1c0a54b8' AND curation_tier = 'extended' AND release_date = '1990-05-25' AND imdb_votes = 528305 AND imdb_id = 'tt0099088' AND imdb_rating = 7.5;
-- The Lighthouse (2019) 7.3/312317 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f67272ce-73de-434d-be99-8306f71dcb9b' AND curation_tier = 'extended' AND release_date = '2019-10-18' AND imdb_votes = 312317 AND imdb_id = 'tt7984734' AND imdb_rating = 7.3;
-- Ocean's Eight (2018) 6.3/265986 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f68028a7-3beb-4e25-8e5f-fb52dcd352d8' AND curation_tier = 'extended' AND release_date = '2018-06-07' AND imdb_votes = 265986 AND imdb_id = 'tt5164214' AND imdb_rating = 6.3;
-- Godzilla vs. Kong (2021) 6.3/272281 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f6bb549c-fddc-4755-8e90-f6611972c85a' AND curation_tier = 'extended' AND release_date = '2021-03-24' AND imdb_votes = 272281 AND imdb_id = 'tt5034838' AND imdb_rating = 6.3;
-- Hot Fuzz (2007) 7.8/574612 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f7455189-ccff-4004-a268-08ad3ad0442b' AND curation_tier = 'extended' AND release_date = '2007-02-14' AND imdb_votes = 574612 AND imdb_id = 'tt0425112' AND imdb_rating = 7.8;
-- Sonic the Hedgehog 2 (2022) 6.5/120329 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f76f1377-2fe9-4117-a695-50965b046ab6' AND curation_tier = 'extended' AND release_date = '2022-03-30' AND imdb_votes = 120329 AND imdb_id = 'tt12412888' AND imdb_rating = 6.5;
-- Terminator: Dark Fate (2019) 6.2/215974 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f7f5c350-bf8a-4086-b7dd-0c2ffabe73b0' AND curation_tier = 'extended' AND release_date = '2019-10-23' AND imdb_votes = 215974 AND imdb_id = 'tt6450804' AND imdb_rating = 6.2;

COMMIT;
