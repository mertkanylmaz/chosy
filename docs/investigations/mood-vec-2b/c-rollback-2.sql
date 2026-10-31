-- MOOD-VEC-2b Faz 2C (parça 2/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- How to Train Your Dragon 2 (2014) 7.8/408774 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '107ccb84-9846-425c-a93c-c48f0c9d8c1c' AND curation_tier = 'extended' AND release_date = '2014-06-05' AND imdb_votes = 408774 AND imdb_id = 'tt1646971' AND imdb_rating = 7.8;
-- Casino Royale (2006) 8/757341 → core
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '10f3c8c0-c094-4c2a-bfb4-6f65587cd986' AND curation_tier = 'core' AND release_date = '2006-11-14' AND imdb_votes = 757341 AND imdb_id = 'tt0381061' AND imdb_rating = 8;
-- The Book of Henry (2017) 6.6/31014 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '1140113a-d4fb-40e5-8848-b1f5be1db314' AND curation_tier = 'extended' AND release_date = '2017-06-16' AND imdb_votes = 31014 AND imdb_id = 'tt4572792' AND imdb_rating = 6.6;
-- Unbroken (2014) 7.2/200955 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '146d1d49-4c22-4ea2-b89b-720df225d04e' AND curation_tier = 'extended' AND release_date = '2014-12-25' AND imdb_votes = 200955 AND imdb_id = 'tt1809398' AND imdb_rating = 7.2;
-- Get Out (2017) 7.8/843625 → core
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '14ed0ce6-d01a-4f8a-990d-9fabd78f755a' AND curation_tier = 'core' AND release_date = '2017-02-24' AND imdb_votes = 843625 AND imdb_rating = 7.8;
-- Control (2007) 7.6/72367 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '158a5e5d-7888-44ba-b343-8e95fd931666' AND curation_tier = 'extended' AND release_date = '2007-09-12' AND imdb_votes = 72367 AND imdb_id = 'tt0421082' AND imdb_rating = 7.6;
-- The Florida Project (2017) 7.6/150113 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '15be5594-e8ad-477c-9b82-75abfdca95ff' AND curation_tier = 'extended' AND release_date = '2017-10-06' AND imdb_votes = 150113 AND imdb_id = 'tt5649144' AND imdb_rating = 7.6;
-- The Danish Girl (2015) 7.1/207844 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '1603a0d0-d23f-4d0c-8a40-f34c42600622' AND curation_tier = 'extended' AND release_date = '2015-11-27' AND imdb_votes = 207844 AND imdb_id = 'tt0810819' AND imdb_rating = 7.1;
-- Glory (1989) 7.8/154724 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '16937274-36c0-4a03-a9ae-e42a44eb63ee' AND curation_tier = 'extended' AND release_date = '1989-12-15' AND imdb_votes = 154724 AND imdb_id = 'tt0097441' AND imdb_rating = 7.8;
-- Batman: Mask of the Phantasm (1993) 7.8/65438 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '17469e41-6994-4908-b4d5-27d00f5d3741' AND curation_tier = 'extended' AND release_date = '1993-12-25' AND imdb_votes = 65438 AND imdb_id = 'tt0106364' AND imdb_rating = 7.8;
-- xXx (2002) 5.9/195583 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '18ce61db-c6c3-404a-8343-3dac541c00e4' AND curation_tier = 'extended' AND release_date = '2002-08-09' AND imdb_votes = 195583 AND imdb_rating = 5.9;
-- Blade (1998) 7.1/337822 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '1a8071cb-a123-4e0e-9d95-b48398b1aa0a' AND curation_tier = 'extended' AND release_date = '1998-08-21' AND imdb_votes = 337822 AND imdb_id = 'tt0120611' AND imdb_rating = 7.1;
-- Sense and Sensibility (1995) 7.7/139012 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '1b4d21c8-fdbe-4e4d-9e38-745afa6086e7' AND curation_tier = 'extended' AND release_date = '1995-12-13' AND imdb_votes = 139012 AND imdb_id = 'tt0114388' AND imdb_rating = 7.7;
-- Crazy, Stupid, Love. (2011) 7.4/632400 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '1bb85b65-c475-42ca-a353-9ca933a33e21' AND curation_tier = 'extended' AND release_date = '2011-07-28' AND imdb_votes = 632400 AND imdb_id = 'tt1570728' AND imdb_rating = 7.4;
-- Mission: Impossible - Ghost Protocol (2011) 7.4/570987 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '1c0776ce-7ae0-49c0-a92d-40fd0896eeaa' AND curation_tier = 'extended' AND release_date = '2011-12-07' AND imdb_votes = 570987 AND imdb_id = 'tt1229238' AND imdb_rating = 7.4;
-- Solo Leveling -ReAwakening- (2024) 8.7/17968 → core
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '1cf0dfa0-d44e-4895-b3f2-7c0a34766798' AND curation_tier = 'core' AND release_date = '2024-11-26' AND imdb_votes = 17968 AND imdb_rating = 8.7;
-- Ani Tehlike (1965) 7.1/19918 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '1d81adbf-7c14-426d-a521-be7a2ab872d6' AND curation_tier = 'extended' AND release_date = '1965-03-18' AND imdb_votes = 19918 AND imdb_rating = 7.1;
-- Desert Flower (2009) 7.3/15682 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '1dff175f-021f-4861-93e4-3aaaa7fbfc33' AND curation_tier = 'extended' AND release_date = '2009-09-24' AND imdb_votes = 15682 AND imdb_id = 'tt1054580' AND imdb_rating = 7.3;
-- The Worst Person in the World (2021) 7.7/133707 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '21acbc8e-d76c-418e-85d1-5154596adb6d' AND curation_tier = 'extended' AND release_date = '2021-10-13' AND imdb_votes = 133707 AND imdb_id = 'tt10370710' AND imdb_rating = 7.7;
-- Erin Brockovich (2000) 7.5/250819 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '21e72948-4046-4ee8-8959-f527ee1104f7' AND curation_tier = 'extended' AND release_date = '2000-03-17' AND imdb_votes = 250819 AND imdb_id = 'tt0195685' AND imdb_rating = 7.5;
-- Being John Malkovich (1999) 7.7/372179 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '2300f2ea-53bc-448c-81c0-35a568229aad' AND curation_tier = 'extended' AND release_date = '1999-10-29' AND imdb_votes = 372179 AND imdb_id = 'tt0120601' AND imdb_rating = 7.7;

COMMIT;
