# MOOD-VEC-2b Faz 2 (C grubu) — Adım 0: keşif

31 Eki 2026 · dal `feat/mood-vec-2b` · **yalnız hazırlık**, canlıya yazılmadı. Betik: `scripts/backfill-archive-c.ts`.

## 1. Kapsam ve kırılım

| | film |
|---|---|
| Kapsam (archive + release_date NULL) | **951** |
| DB'de imdb_id dolu | 439 |
| DB'de imdb_id NULL | 512 |
| tmdb_id NULL | 0 |
| TMDb çağrısı (yeni / cache'ten) | 0 / 951 |
| TMDb 200 | 950 |
| TMDb 404 | 1 |
| TMDb'de release_date **dolu** | 950 |
| TMDb'de release_date **boş** (200 ama tarih yok) | 0 |
| imdb_id'si olan: ratings dosyasında **eşleşen** | 933 |
| imdb_id'si olan: ratings dosyasında **eşleşmeyen** | 4 |
| imdb_id hiç bulunamayan (DB NULL + TMDb döndürmedi) | 14 |
| — DB imdb_id'li grupta dosyada eşleşen / toplam | 436 / 439 |
| — DB imdb_id'siz grupta (TMDb ile) eşleşen / toplam | 497 / 512 |
| Dosya oyu **>= 10.000** | 540 |
| — bunlardan release_date dolu (TMDb) | 540 |
| — bunlardan tier archive kalan (rating < taban) | 67 |
| — bunlardan içerik/imdb_id/konser/079/tarih bayrağı yüzünden SQL dışı | 66 |
| **KURTARILAN (SQL'e giren)** | **407** |
| — core | 23 |
| — extended | 384 |
| — imdb_id yazılan (DB NULL idi) | 318 |
| — imdb_rating yazılan (DB NULL idi) | 407 |
| — DB rating dolu ve dosyadan farklı (rating'e dokunulmaz, tier dosya değeriyle) | 0 |
| — havuz kapısını (poster/runtime/year/profile_vector + yeni date) geçen | 407 |
| — director DB'de NULL idi, TMDb credits'ten dolan | 317 |
| — director bulunamadı (needs-review, no_director) | 0 |
| needs-review.csv satırı | 221 |

**core + oy < 10.000 (bilinen bug):** yok (eşik zaten filtreliyor; kontrol bayrağı `coretier` çalıştırıldı)
· `coretier` bayrağı taşıyan: 15

### Birincil elenme nedeni (bir film birden çok bayrak taşıyabilir; sırayla ilk)

- ok: 407
- votes: 392
- tierfloor: 67
- content: 50
- imdbid: 16
- lookup: 14
- nofile: 4
- date: 1

## 2. En yüksek oylu 30 film (dosya oyu, 951 içinden)

| # | film | yıl | tmdb | imdb_id | rating/oy | tier | durum |
|---|---|---|---|---|---|---|---|
| 1 | Captain America: The Winter Soldier | 2014 | 100402 | tt1843866* | 7.7/994.588 | extended | KURTARILDI → extended |
| 2 | 300 | 2007 | 1271 | tt0416449* | 7.6/923.918 | extended | KURTARILDI → extended |
| 3 | Get Out | 2017 | 419430 | tt5052448 | 7.8/843.625 | core | KURTARILDI → core |
| 4 | Sin City | 2005 | 187 | tt0401792* | 8/825.225 | core | KURTARILDI → core |
| 5 | Edge of Tomorrow | 2014 | 137113 | tt1631867* | 7.9/819.641 | extended | KURTARILDI → extended |
| 6 | Batman v Superman: Dawn of Justice | 2016 | 209112 | tt2975590 | 6.4/801.371 | extended | KURTARILDI → extended |
| 7 | X-Men: Days of Future Past | 2014 | 127585 | tt1877832* | 7.9/800.595 | extended | KURTARILDI → extended |
| 8 | Ant-Man | 2015 | 102899 | tt0478970 | 7.2/798.889 | extended | KURTARILDI → extended |
| 9 | Thor: The Dark World | 2013 | 76338 | tt1981115* | 6.7/796.283 | extended | KURTARILDI → extended |
| 10 | Kingsman: The Secret Service | 2015 | 207703 | tt2802144* | 7.7/786.641 | extended | KURTARILDI → extended |
| 11 | The Hunger Games: Catching Fire | 2013 | 101299 | tt1951264* | 7.5/786.197 | extended | KURTARILDI → extended |
| 12 | Skyfall | 2012 | 37724 | tt1074638* | 7.8/782.676 | extended | KURTARILDI → extended |
| 13 | Now You See Me | 2013 | 75656 | tt1670345* | 7.2/780.991 | extended | KURTARILDI → extended |
| 14 | Rogue One: A Star Wars Story | 2016 | 330459 | tt3748528* | 7.8/768.349 | extended | KURTARILDI → extended |
| 15 | The Hobbit: The Desolation of Smaug | 2013 | 57158 | tt1170358* | 7.8/763.834 | extended | KURTARILDI → extended |
| 16 | District 9 | 2009 | 17654 | tt1136608* | 7.9/759.474 | extended | KURTARILDI → extended |
| 17 | Home Alone | 1990 | 771 | tt0099785* | 7.8/757.729 | extended | KURTARILDI → extended |
| 18 | Casino Royale | 2006 | 36557 | tt0381061* | 8/757.341 | core | KURTARILDI → core |
| 19 | Groundhog Day | 1993 | 137 | tt0107048* | 8/742.702 | core | KURTARILDI → core |
| 20 | Jurassic World | 2015 | 135397 | tt0369610* | 6.9/740.311 | extended | KURTARILDI → extended |
| 21 | It | 2017 | 346364 | tt1396484 | 7.3/714.208 | extended | KURTARILDI → extended |
| 22 | Prometheus | 2012 | 70981 | tt1446714* | 7/709.327 | extended | KURTARILDI → extended |
| 23 | Life of Pi | 2012 | 87827 | tt0454876* | 7.9/707.606 | extended | KURTARILDI → extended |
| 24 | Superbad | 2007 | 8363 | tt0829482* | 7.6/706.728 | extended | KURTARILDI → extended |
| 25 | Birdman or (The Unexpected Virtue of Ignorance) | 2014 | 194662 | tt2562232* | 7.7/705.545 | extended | KURTARILDI → extended |
| 26 | Baby Driver | 2017 | 339403 | tt3890160* | 7.5/698.359 | extended | KURTARILDI → extended |
| 27 | Ocean's Eleven | 2001 | 161 | tt0240772* | 7.7/687.132 | extended | KURTARILDI → extended |
| 28 | Twelve Monkeys | 1995 | 63 | tt0114746* | 8/686.259 | core | KURTARILDI → core |
| 29 | Taken | 2008 | 8681 | tt0936501 | 7.7/680.318 | extended | KURTARILDI → extended |
| 30 | The Matrix Reloaded | 2003 | 604 | tt0234215* | 7.2/678.728 | extended | KURTARILDI → extended |

`*` = imdb_id TMDb'den tamamlandı.

## 3. Sekiz ikonik film

| film | tmdb_id | kapsamda mı | DB imdb_id | TMDb release_date | rating/oy | tier | durum |
|---|---|---|---|---|---|---|---|
| Superbad | 8363 | evet (Superbad, 2007) | NULL → tt0829482 | 2007-08-17 | 7.6/706.728 | extended | KURTARILDI → extended |
| Hot Fuzz | 4638 | evet (Hot Fuzz, 2007) | NULL → tt0425112 | 2007-02-14 | 7.8/574.612 | extended | KURTARILDI → extended |
| Groundhog Day | 137 | evet (Groundhog Day, 1993) | NULL → tt0107048 | 1993-02-11 | 8/742.702 | core | KURTARILDI → core |
| Ferris Bueller's Day Off | 9377 | evet (Ferris Bueller's Day Off, 1986) | NULL → tt0091042 | 1986-06-11 | 7.8/421.863 | extended | KURTARILDI → extended |
| Bridesmaids | 55721 | evet (Bridesmaids, 2011) | NULL → tt1478338 | 2011-05-13 | 6.8/329.238 | extended | KURTARILDI → extended |
| Paddington 2 | 346648 | evet (Paddington 2, 2017) | NULL → tt4468740 | 2017-11-05 | 7.8/117.092 | extended | KURTARILDI → extended |
| Ocean's Eleven | 161 | evet (Ocean's Eleven, 2001) | NULL → tt0240772 | 2001-12-07 | 7.7/687.132 | extended | KURTARILDI → extended |
| Get Out | 419430 | evet (Get Out, 2017) | tt5052448 → tt5052448 | 2017-02-24 | 7.8/843.625 | core | KURTARILDI → core |

## 4. Gauntlet etkisi (tahmin; yalnız hesap)

Havuz tahmini: tier ∈ kümesi + release_date ≤ bugün + poster/runtime/year + profile_vector + imdb_votes > 0 (Faz 1 raporlarıyla aynı yöntem; `maxRuntime` ve `isDuelEligible` modellenmedi). Yüzdelik: `percentRanks` semantiği, bant p55–p80.
Kurtarılan 407 filmin 407'i kapıyı geçer; kalanı poster/runtime/year/profile_vector eksiği yüzünden havuza girmez.

### A. Canlı DB → canlı + C

**günlük (core+extended+trending)**

| | önce | sonra |
|---|---|---|
| havuz (votes'lu) | 2.084 | 2.491 (+407: core 23, extended 384) |
| p55 oy | 82.999 | 104.360 (25.7%) |
| p80 oy | 306.399 | 341.505 (11.5%) |
| medyan oy | 63.145 | 80.662 |
| mevcut filmlerden banttan çıkan / giren | | 90 / 31 |
| yeni filmlerden bantta | | 161 / 407 |

**global slot (core+trending)**

| | önce | sonra |
|---|---|---|
| havuz (votes'lu) | 915 | 938 (+23: core 23, extended 0) |
| p55 oy | 285.703 | 282.952 (-1.0%) |
| p80 oy | 682.408 | 682.977 (0.1%) |
| medyan oy | 246.493 | 244.021 |
| mevcut filmlerden banttan çıkan / giren | | 0 / 4 |
| yeni filmlerden bantta | | 1 / 23 |

### B. Canlı + bekleyen 1B/1C/1D → + C (bekleyen UPDATE uygulanan: 0)

**günlük (core+extended+trending)**

| | önce | sonra |
|---|---|---|
| havuz (votes'lu) | 2.084 | 2.491 (+407: core 23, extended 384) |
| p55 oy | 82.999 | 104.360 (25.7%) |
| p80 oy | 306.399 | 341.505 (11.5%) |
| medyan oy | 63.145 | 80.662 |
| mevcut filmlerden banttan çıkan / giren | | 90 / 31 |
| yeni filmlerden bantta | | 161 / 407 |

**global slot (core+trending)**

| | önce | sonra |
|---|---|---|
| havuz (votes'lu) | 915 | 938 (+23: core 23, extended 0) |
| p55 oy | 285.703 | 282.952 (-1.0%) |
| p80 oy | 682.408 | 682.977 (0.1%) |
| medyan oy | 246.493 | 244.021 |
| mevcut filmlerden banttan çıkan / giren | | 0 / 4 |
| yeni filmlerden bantta | | 1 / 23 |

## 5. Çıktı dosyaları ve notlar

- Payload: `c-payload.tsv` (407 satır); SQL üretilmez.
- Tür etiketi: payload `genres`, `original_language`'e **dokunmuyor** (istenmedi). Faz 1 keşfi arşivde Türkçe tür etiketlerinin yaygın olduğunu gösterdi; gauntlet `genres[0]`'ı ham sayıyor (çeşitlilik kuralı). TMDb en-US tür adları cache'te (`genres`) duruyor, ayrı bir karar/SQL gerekir.
- `c-tmdb-cache.json` kırpılmış alan kümesi tutar (id, imdb_id, release_date, title, runtime, status, language, genres, poster_path); 951 kayıt.
