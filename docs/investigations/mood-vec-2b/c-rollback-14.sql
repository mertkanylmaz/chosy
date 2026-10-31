-- MOOD-VEC-2b Faz 2C (parça 14/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- Bullet Train (2022) 7.3/551044 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b508e4d1-af21-430d-b1bb-a2b34ad1039f' AND curation_tier = 'extended' AND release_date = '2022-08-03' AND imdb_votes = 551044 AND imdb_id = 'tt12593682' AND imdb_rating = 7.3;
-- Wind River (2017) 7.7/322180 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b5a975e6-a3b9-4e22-8c42-f5669c823432' AND curation_tier = 'extended' AND release_date = '2017-08-03' AND imdb_votes = 322180 AND imdb_id = 'tt5362988' AND imdb_rating = 7.7;
-- Regretting You (2025) 6/26641 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b5ed1c5f-ecdf-4da2-a694-b6dd79c73b6d' AND curation_tier = 'extended' AND release_date = '2025-10-22' AND imdb_votes = 26641 AND imdb_rating = 6;
-- Scouts Guide to the Zombie Apocalypse (2015) 6.3/62742 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b61de4d4-7583-49ba-a28b-23c5740256e3' AND curation_tier = 'extended' AND release_date = '2015-10-23' AND imdb_votes = 62742 AND imdb_id = 'tt1727776' AND imdb_rating = 6.3;
-- The Matrix Reloaded (2003) 7.2/678728 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b62417ab-5a96-41af-8bb5-767ebbb186d0' AND curation_tier = 'extended' AND release_date = '2003-05-15' AND imdb_votes = 678728 AND imdb_id = 'tt0234215' AND imdb_rating = 7.2;
-- The Iron Claw (2023) 7.5/123089 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b6fe468f-5c98-40c6-9cff-0d301de894c8' AND curation_tier = 'extended' AND release_date = '2023-12-21' AND imdb_votes = 123089 AND imdb_id = 'tt21064584' AND imdb_rating = 7.5;
-- Beetlejuice Beetlejuice (2024) 6.6/181580 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b7eeb7ec-4613-4d91-bae2-b73554906c2f' AND curation_tier = 'extended' AND release_date = '2024-09-04' AND imdb_votes = 181580 AND imdb_id = 'tt2049403' AND imdb_rating = 6.6;
-- The Guernsey Literary & Potato Peel Pie Society (2018) 7.3/58843 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b94f1b33-2ae5-49a2-8551-b8c3cb3090ed' AND curation_tier = 'extended' AND release_date = '2018-04-19' AND imdb_votes = 58843 AND imdb_id = 'tt1289403' AND imdb_rating = 7.3;
-- Evil Dead II (1987) 7.6/201730 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b9b92a5a-b426-4ca7-ab18-baf6ed4e938a' AND curation_tier = 'extended' AND release_date = '1987-03-13' AND imdb_votes = 201730 AND imdb_id = 'tt0092991' AND imdb_rating = 7.6;
-- The Creator (2023) 6.7/206763 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b9b94ab5-f63a-43a0-aeb2-1e3a048c5980' AND curation_tier = 'extended' AND release_date = '2023-09-27' AND imdb_votes = 206763 AND imdb_rating = 6.7;
-- The Voice of Hind Rajab (2025) 8.2/22269 → core
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b9fc8c9a-9339-47a7-bab4-8417a7652384' AND curation_tier = 'core' AND release_date = '2025-09-10' AND imdb_votes = 22269 AND imdb_rating = 8.2;
-- The SpongeBob Movie: Sponge on the Run (2020) 5.9/26458 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ba08a4fb-409d-44b9-97c3-e49f2258b4f7' AND curation_tier = 'extended' AND release_date = '2020-08-14' AND imdb_votes = 26458 AND imdb_id = 'tt4823776' AND imdb_rating = 5.9;
-- The Secret Agent (2025) 7.2/64696 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ba1d50cb-5eb9-4de5-bfaf-4a4820a426c3' AND curation_tier = 'extended' AND release_date = '2025-07-23' AND imdb_votes = 64696 AND imdb_rating = 7.2;
-- Primat (2026) 5.8/38765 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'bb101f6d-3c2e-4779-a1c8-c595d4ede33c' AND curation_tier = 'extended' AND release_date = '2026-01-01' AND imdb_votes = 38765 AND imdb_rating = 5.8;
-- It Chapter Two (2019) 6.5/365575 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'bb9be851-f511-486e-9f6c-c149c05ae3ab' AND curation_tier = 'extended' AND release_date = '2019-09-04' AND imdb_votes = 365575 AND imdb_id = 'tt7349950' AND imdb_rating = 6.5;
-- Zindagi Na Milegi Dobara (2011) 8.2/98026 → core
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'bd023ae2-5e04-4ad9-b0c5-a605d8184e06' AND curation_tier = 'core' AND release_date = '2011-07-15' AND imdb_votes = 98026 AND imdb_id = 'tt1562872' AND imdb_rating = 8.2;
-- August Rush (2007) 7.4/115456 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'bd2f5208-6c5a-4e1e-943e-dce150e47ceb' AND curation_tier = 'extended' AND release_date = '2007-11-21' AND imdb_votes = 115456 AND imdb_id = 'tt0426931' AND imdb_rating = 7.4;
-- What We Do in the Shadows (2014) 7.6/216602 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'beba7a17-264c-4138-86e4-95aa0ce96f60' AND curation_tier = 'extended' AND release_date = '2014-06-19' AND imdb_votes = 216602 AND imdb_id = 'tt3416742' AND imdb_rating = 7.6;
-- Tombstone (1993) 7.8/196362 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'bf315e83-6b50-4d3f-9cbf-1550d871d865' AND curation_tier = 'extended' AND release_date = '1993-12-25' AND imdb_votes = 196362 AND imdb_id = 'tt0108358' AND imdb_rating = 7.8;
-- Courageous (2011) 6.9/23093 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'c0d68936-2bb8-4aef-80a3-addbbaeed656' AND curation_tier = 'extended' AND release_date = '2011-09-30' AND imdb_votes = 23093 AND imdb_id = 'tt1630036' AND imdb_rating = 6.9;
-- Anastasia (1997) 7.2/149141 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'c10f9f38-b78d-49a5-b70b-a4961125f0f6' AND curation_tier = 'extended' AND release_date = '1997-11-20' AND imdb_votes = 149141 AND imdb_id = 'tt0118617' AND imdb_rating = 7.2;

COMMIT;
