# MOOD-VEC-1 — otomatik metrikler

Yalnız ölçülen sayılar; puanlama ve kalite yorumu içermez.

## Kapsam

- V0: RPC 25/25, rerank tamam 25/25
- V1: RPC 25/25, rerank tamam 1/25
- V2: RPC 25/25, rerank tamam 25/25
- parse: 25/25
- defter: parse=25, rerank=51, UTC gün başına rerank={"2026-10-25":51}
- mood_searches'a yazılan satır (parse yanıtındaki search_id): 25
- parse yanıtı `limit` değerleri: null

Not: `imdb_votes` kolonu kirlidir (OMDb ve TMDb karışık); `0` değeri NULL sayıldı ve oranlardan düşüldü.

## Süre (ms, p50 / p90)

| segment | n | parse p50 | parse p90 |
| --- | --- | --- | --- |
| tümü | 25 | 4297 | 4574 |
| quick | 8 | 4452 | 4829 |
| serbest | 17 | 4248 | 4405 |
| EN | 22 | 4288 | 4588 |
| TR | 3 | 4340 | 4394 |

### V0 süre

| segment | n | RPC deneme | RPC toplam | rerank | rerank (canlı çağrı n) | toplam (parse+RPC+rerank) |
| --- | --- | --- | --- | --- | --- | --- |
| tümü | 25 | 1149 / 1405 | 1149 / 1405 | 2859 / 3532 | 25 | 8108 / 9494 |
| quick | 8 | 1150 / 1804 | 1150 / 1804 | 3267 / 3708 | 8 | 8842 / 10491 |
| serbest | 17 | 1149 / 1320 | 1149 / 1320 | 2701 / 3384 | 17 | 7940 / 8815 |
| EN | 22 | 1150 / 1438 | 1150 / 1438 | 2976 / 3558 | 22 | 8394 / 9611 |
| TR | 3 | 1112 / 1274 | 1112 / 1274 | 2386 / 2514 | 3 | 7893 / 8065 |

- uygulamanın 6 sn rerank zaman aşımını aşan: 0; ortalama RPC deneme sayısı: 1.00; sunucu fallback (rerank uygulanmadı): 0

### V1 süre

| segment | n | RPC deneme | RPC toplam | rerank | rerank (canlı çağrı n) | toplam (parse+RPC+rerank) |
| --- | --- | --- | --- | --- | --- | --- |
| tümü | 25 | 1064 / 1212 | 1064 / 1212 | 3447 / 3447 | 1 | 9698 / 9698 |
| quick | 8 | 1125 / 1334 | 1125 / 1334 | 3447 / 3447 | 1 | 9698 / 9698 |
| serbest | 17 | 1062 / 1198 | 1062 / 1198 | — / — | 0 | — / — |
| EN | 22 | 1087 / 1203 | 1087 / 1203 | 3447 / 3447 | 1 | 9698 / 9698 |
| TR | 3 | 1064 / 1186 | 1064 / 1186 | — / — | 0 | — / — |

- uygulamanın 6 sn rerank zaman aşımını aşan: 0; ortalama RPC deneme sayısı: 1.00; sunucu fallback (rerank uygulanmadı): 0

### V2 süre

| segment | n | RPC deneme | RPC toplam | rerank | rerank (canlı çağrı n) | toplam (parse+RPC+rerank) |
| --- | --- | --- | --- | --- | --- | --- |
| tümü | 25 | 1132 / 1296 | 1132 / 1296 | 2788 / 3997 | 25 | 8325 / 9899 |
| quick | 8 | 1124 / 1599 | 1124 / 1599 | 3157 / 3906 | 8 | 8671 / 10356 |
| serbest | 17 | 1164 / 1241 | 1164 / 1241 | 2630 / 3630 | 17 | 8079 / 9289 |
| EN | 22 | 1131 / 1247 | 1131 / 1247 | 2897 / 4088 | 22 | 8269 / 9974 |
| TR | 3 | 1232 / 1606 | 1232 / 1606 | 2568 / 2802 | 3 | 8341 / 8608 |

- uygulamanın 6 sn rerank zaman aşımını aşan: 0; ortalama RPC deneme sayısı: 1.00; sunucu fallback (rerank uygulanmadı): 0

## V0 — bilinirlik / çeşitlilik / tekrar (rerank + kalite süzgeci sonrası)

| metrik | tümü | quick | serbest | EN | TR |
| --- | --- | --- | --- | --- | --- |
| n mood | 25 | 8 | 17 | 22 | 3 |
| imdb_votes medyan, ilk 4 | 196423 | 130667 | 211110 | 177360 | 227607 |
| imdb_votes medyan, ilk 8 | 170704 | 105055 | 185670 | 150963 | 211076 |
| <100 bin oy, ilk 4 | 34.0% | 37.5% | 32.4% | 35.2% | 25.0% |
| <100 bin oy, ilk 8 | 38.2% | 45.3% | 34.8% | 39.4% | 29.2% |
| <50 bin oy, ilk 4 | 24.0% | 21.9% | 25.0% | 23.9% | 25.0% |
| <50 bin oy, ilk 8 | 27.1% | 32.8% | 24.4% | 27.4% | 25.0% |
| oy bilgisi yok (NULL/0), ilk 8 | 1/200 | 0/64 | 1/136 | 1/176 | 0/24 |
| farklı on yıl, ilk 4 (ort.) | 3.00 | 2.88 | 3.06 | 3.09 | 2.33 |
| en sık türün payı, ilk 4 (ort.) | 86.0% | 90.6% | 83.8% | 85.2% | 91.7% |
| ≥3 moodda görünen film, ilk 4 (adet / slot payı) | 6 / 21.0% | 0 / 0.0% | 5 / 22.1% | 2 / 6.8% | 0 / 0.0% |
| ≥3 moodda görünen film, ilk 8 (adet / slot payı) | 9 / 19.0% | 1 / 4.7% | 5 / 13.2% | 7 / 14.2% | 0 / 0.0% |
| pre-1970 film, ilk 4 (toplam) | 5 | 3 | 2 | 5 | 0 |
| pre-1970 film, ilk 8 (toplam) | 12 | 6 | 6 | 11 | 1 |

**≥3 moodda ilk 4'te görünen filmler (V0, tümü):** Klaus (2019) ×5; Bread and Tulips (2000) ×4; Christopher Robin (2018) ×3; Kiki's Delivery Service (1989) ×3; WALL·E (2008) ×3; The Usual Suspects (1995) ×3

**≥3 moodda ilk 8'de görünen filmler (V0, tümü):** Klaus (2019) ×7; Bread and Tulips (2000) ×5; Kiki's Delivery Service (1989) ×5; A Man Called Ove (2015) ×4; Christopher Robin (2018) ×4; WALL·E (2008) ×4; Perfect Days (2023) ×3; My Octopus Teacher (2020) ×3; The Usual Suspects (1995) ×3

(TR segmentinde 3 mood vardır; "≥3 mood" eşiği orada yalnız hepsinde görünen filmi yakalar.)

## V1 — bilinirlik / çeşitlilik / tekrar (rerank + kalite süzgeci sonrası)

| metrik | tümü | quick | serbest | EN | TR |
| --- | --- | --- | --- | --- | --- |
| n mood | 1 | 1 | 0 | 1 | 0 |
| imdb_votes medyan, ilk 4 | 86274 | 86274 | — | 86274 | — |
| imdb_votes medyan, ilk 8 | 71055 | 71055 | — | 71055 | — |
| <100 bin oy, ilk 4 | 50.0% | 50.0% | — | 50.0% | — |
| <100 bin oy, ilk 8 | 62.5% | 62.5% | — | 62.5% | — |
| <50 bin oy, ilk 4 | 25.0% | 25.0% | — | 25.0% | — |
| <50 bin oy, ilk 8 | 37.5% | 37.5% | — | 37.5% | — |
| oy bilgisi yok (NULL/0), ilk 8 | 0/8 | 0/8 | 0/0 | 0/8 | 0/0 |
| farklı on yıl, ilk 4 (ort.) | 3.00 | 3.00 | — | 3.00 | — |
| en sık türün payı, ilk 4 (ort.) | 75.0% | 75.0% | — | 75.0% | — |
| ≥3 moodda görünen film, ilk 4 (adet / slot payı) | 0 / 0.0% | 0 / 0.0% | 0 / — | 0 / 0.0% | 0 / — |
| ≥3 moodda görünen film, ilk 8 (adet / slot payı) | 0 / 0.0% | 0 / 0.0% | 0 / — | 0 / 0.0% | 0 / — |
| pre-1970 film, ilk 4 (toplam) | 0 | 0 | 0 | 0 | 0 |
| pre-1970 film, ilk 8 (toplam) | 0 | 0 | 0 | 0 | 0 |

**≥3 moodda ilk 4'te görünen filmler (V1, tümü):** yok

**≥3 moodda ilk 8'de görünen filmler (V1, tümü):** yok

(TR segmentinde 3 mood vardır; "≥3 mood" eşiği orada yalnız hepsinde görünen filmi yakalar.)

## V2 — bilinirlik / çeşitlilik / tekrar (rerank + kalite süzgeci sonrası)

| metrik | tümü | quick | serbest | EN | TR |
| --- | --- | --- | --- | --- | --- |
| n mood | 25 | 8 | 17 | 22 | 3 |
| imdb_votes medyan, ilk 4 | 209143 | 133113 | 220404 | 196423 | 221946 |
| imdb_votes medyan, ilk 8 | 179473 | 105055 | 199582 | 155060 | 211076 |
| <100 bin oy, ilk 4 | 33.0% | 34.4% | 32.4% | 34.1% | 25.0% |
| <100 bin oy, ilk 8 | 36.7% | 45.3% | 32.6% | 38.3% | 25.0% |
| <50 bin oy, ilk 4 | 25.0% | 21.9% | 26.5% | 25.0% | 25.0% |
| <50 bin oy, ilk 8 | 27.1% | 32.8% | 24.4% | 27.4% | 25.0% |
| oy bilgisi yok (NULL/0), ilk 8 | 1/200 | 0/64 | 1/136 | 1/176 | 0/24 |
| farklı on yıl, ilk 4 (ort.) | 3.00 | 3.00 | 3.00 | 3.00 | 3.00 |
| en sık türün payı, ilk 4 (ort.) | 86.0% | 93.8% | 82.4% | 86.4% | 83.3% |
| ≥3 moodda görünen film, ilk 4 (adet / slot payı) | 6 / 24.0% | 0 / 0.0% | 5 / 25.0% | 2 / 9.1% | 0 / 0.0% |
| ≥3 moodda görünen film, ilk 8 (adet / slot payı) | 12 / 24.5% | 3 / 14.1% | 5 / 13.2% | 9 / 19.3% | 0 / 0.0% |
| pre-1970 film, ilk 4 (toplam) | 7 | 3 | 4 | 7 | 0 |
| pre-1970 film, ilk 8 (toplam) | 14 | 6 | 8 | 13 | 1 |

**≥3 moodda ilk 4'te görünen filmler (V2, tümü):** Klaus (2019) ×6; Bread and Tulips (2000) ×5; Kiki's Delivery Service (1989) ×4; Harry Potter and the Philosopher's Stone (2001) ×3; WALL·E (2008) ×3; The Usual Suspects (1995) ×3

**≥3 moodda ilk 8'de görünen filmler (V2, tümü):** Kiki's Delivery Service (1989) ×6; Bread and Tulips (2000) ×6; Klaus (2019) ×6; A Man Called Ove (2015) ×5; Babette's Feast (1987) ×4; WALL·E (2008) ×4; Perfect Days (2023) ×3; My Octopus Teacher (2020) ×3; Iron Man (2008) ×3; Christopher Robin (2018) ×3; Harry Potter and the Philosopher's Stone (2001) ×3; The Usual Suspects (1995) ×3

(TR segmentinde 3 mood vardır; "≥3 mood" eşiği orada yalnız hepsinde görünen filmi yakalar.)

## Era etkisi (V0 ↔ V1: vektörde era segmenti sıfırlanmış)

### İlk 4 kesişimi (rerank + süzgeç sonrası)

| segment | n mood | ort. kesişim (/4) | oran |
| --- | --- | --- | --- |
| tümü | 1 | 3.00 | 75.0% |
| quick | 1 | 3.00 | 75.0% |
| serbest | 0 | — | — |
| EN | 1 | 3.00 | 75.0% |
| TR | 0 | — | — |

### İlk 4 kesişimi — RPC sırası (rerank ÖNCESİ, yalnız kalite süzgeci)

| segment | n mood | ort. kesişim (/4) | oran |
| --- | --- | --- | --- |
| tümü | 25 | 2.92 | 73.0% |
| quick | 8 | 2.88 | 71.9% |
| serbest | 17 | 2.94 | 73.5% |
| EN | 22 | 2.82 | 70.5% |
| TR | 3 | 3.67 | 91.7% |

### 1970 öncesi film sayısı (ilk 4 / ilk 8, tümü)

| varyant | sıra | n mood | pre-1970 ilk 4 | pre-1970 ilk 8 |
| --- | --- | --- | --- | --- |
| V0 | rerank sonrası | 25 | 5 | 12 |
| V0 | RPC sırası | 25 | 5 | 10 |
| V1 | rerank sonrası | 1 | 0 | 0 |
| V1 | RPC sırası | 25 | 20 | 41 |

## Rerank aday etkisi (V0 ↔ V2: 30 aday/150 kr ↔ 20 aday/100 kr)

| segment | n mood | ort. kesişim (/4) | oran |
| --- | --- | --- | --- |
| tümü | 25 | 3.08 | 77.0% |
| quick | 8 | 2.88 | 71.9% |
| serbest | 17 | 3.18 | 79.4% |
| EN | 22 | 3.09 | 77.3% |
| TR | 3 | 3.00 | 75.0% |

| rerank süresi | p50 | p90 | ort. |
| --- | --- | --- | --- |
| V0 (ms) | 2859 | 3532 | 2923 |
| V2 (ms) | 2788 | 3997 | 3008 |
| V0 − V2 (ms, mood başına) | -4 | 546 | -85 |

