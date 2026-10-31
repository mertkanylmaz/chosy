# MOOD-VEC-1 — otomatik metrikler

Yalnız ölçülen sayılar; puanlama ve kalite yorumu içermez.

## Kapsam

- V0: RPC 25/25, rerank tamam 25/25
- V1: RPC 0/25, rerank tamam 0/25
- V2: RPC 0/25, rerank tamam 0/25
- V3: RPC 25/25, rerank tamam 25/25
- parse: 0/25
- defter: parse=25, rerank=50, UTC gün başına rerank={"2026-10-31":50}
- mood_searches'a yazılan satır (parse yanıtındaki search_id): 25
- parse yanıtı `limit` değerleri: —

Not: `imdb_votes` kolonu kirlidir (OMDb ve TMDb karışık); `0` değeri NULL sayıldı ve oranlardan düşüldü.

## Süre (ms, p50 / p90)

| segment | n | parse p50 | parse p90 |
| --- | --- | --- | --- |
| tümü | 0 | — | — |
| quick | 0 | — | — |
| serbest | 0 | — | — |
| EN | 0 | — | — |
| TR | 0 | — | — |

### V0 süre

| segment | n | RPC deneme | RPC toplam | rerank | rerank (canlı çağrı n) | toplam (parse+RPC+rerank) |
| --- | --- | --- | --- | --- | --- | --- |
| tümü | 25 | 1043 / 1286 | 1043 / 1286 | 2900 / 3476 | 25 | — / — |
| quick | 8 | 1052 / 1670 | 1052 / 1670 | 2877 / 3553 | 8 | — / — |
| serbest | 17 | 1042 / 1245 | 1042 / 1245 | 2957 / 3402 | 17 | — / — |
| EN | 22 | 1047 / 1297 | 1047 / 1297 | 2958 / 3489 | 22 | — / — |
| TR | 3 | 944 / 962 | 944 / 962 | 2331 / 2786 | 3 | — / — |

- uygulamanın 6 sn rerank zaman aşımını aşan: 0; ortalama RPC deneme sayısı: 1.00; sunucu fallback (rerank uygulanmadı): 0

### V3 süre

| segment | n | RPC deneme | RPC toplam | rerank | rerank (canlı çağrı n) | toplam (parse+RPC+rerank) |
| --- | --- | --- | --- | --- | --- | --- |
| tümü | 25 | 832 / 1187 | 832 / 1187 | 4022 / 4753 | 25 | — / — |
| quick | 8 | 837 / 1138 | 837 / 1138 | 4055 / 4466 | 8 | — / — |
| serbest | 17 | 832 / 1153 | 832 / 1153 | 3892 / 4773 | 17 | — / — |
| EN | 22 | 836 / 1236 | 836 / 1236 | 3890 / 4415 | 22 | — / — |
| TR | 3 | 771 / 841 | 771 / 841 | 4923 / 5619 | 3 | — / — |

- uygulamanın 6 sn rerank zaman aşımını aşan: 0; ortalama RPC deneme sayısı: 1.00; sunucu fallback (rerank uygulanmadı): 0

## V0 — bilinirlik / çeşitlilik / tekrar (rerank + kalite süzgeci sonrası)

| metrik | tümü | quick | serbest | EN | TR |
| --- | --- | --- | --- | --- | --- |
| n mood | 25 | 8 | 17 | 22 | 3 |
| imdb_votes medyan, ilk 4 | 229698 | 225417 | 229698 | 229698 | 225417 |
| imdb_votes medyan, ilk 8 | 169877 | 112226 | 192638 | 146702 | 232782 |
| <100 bin oy, ilk 4 | 27.0% | 25.0% | 27.9% | 28.4% | 16.7% |
| <100 bin oy, ilk 8 | 35.5% | 42.2% | 32.4% | 37.5% | 20.8% |
| <50 bin oy, ilk 4 | 15.0% | 15.6% | 14.7% | 15.9% | 8.3% |
| <50 bin oy, ilk 8 | 22.0% | 29.7% | 18.4% | 23.9% | 8.3% |
| oy bilgisi yok (NULL/0), ilk 8 | 0/200 | 0/64 | 0/136 | 0/176 | 0/24 |
| farklı on yıl, ilk 4 (ort.) | 2.84 | 2.75 | 2.88 | 2.91 | 2.33 |
| en sık türün payı, ilk 4 (ort.) | 89.0% | 96.9% | 85.3% | 88.6% | 91.7% |
| ≥3 moodda görünen film, ilk 4 (adet / slot payı) | 2 / 7.0% | 0 / 0.0% | 2 / 8.8% | 0 / 0.0% | 0 / 0.0% |
| ≥3 moodda görünen film, ilk 8 (adet / slot payı) | 9 / 16.0% | 2 / 9.4% | 5 / 11.0% | 5 / 10.2% | 0 / 0.0% |
| pre-1970 film, ilk 4 (toplam) | 6 | 3 | 3 | 6 | 0 |
| pre-1970 film, ilk 8 (toplam) | 12 | 7 | 5 | 12 | 0 |

**≥3 moodda ilk 4'te görünen filmler (V0, tümü):** Klaus (2019) ×4; The Usual Suspects (1995) ×3

**≥3 moodda ilk 8'de görünen filmler (V0, tümü):** Bread and Tulips (2000) ×6; Perfect Days (2023) ×4; Klaus (2019) ×4; A Man Called Ove (2015) ×3; My Octopus Teacher (2020) ×3; Harry Potter and the Philosopher's Stone (2001) ×3; WALL·E (2008) ×3; Kiki's Delivery Service (1989) ×3; The Usual Suspects (1995) ×3

(TR segmentinde 3 mood vardır; "≥3 mood" eşiği orada yalnız hepsinde görünen filmi yakalar.)

## V3 — bilinirlik / çeşitlilik / tekrar (rerank + kalite süzgeci sonrası)

| metrik | tümü | quick | serbest | EN | TR |
| --- | --- | --- | --- | --- | --- |
| n mood | 25 | 8 | 17 | 22 | 3 |
| imdb_votes medyan, ilk 4 | 422306 | 354788 | 424088 | 422799 | 357878 |
| imdb_votes medyan, ilk 8 | 422748 | 399883 | 422799 | 418996 | 563420 |
| <100 bin oy, ilk 4 | 6.0% | 6.3% | 5.9% | 6.8% | 0.0% |
| <100 bin oy, ilk 8 | 9.0% | 7.8% | 9.6% | 10.2% | 0.0% |
| <50 bin oy, ilk 4 | 3.0% | 3.1% | 2.9% | 3.4% | 0.0% |
| <50 bin oy, ilk 8 | 3.5% | 3.1% | 3.7% | 4.0% | 0.0% |
| oy bilgisi yok (NULL/0), ilk 8 | 0/200 | 0/64 | 0/136 | 0/176 | 0/24 |
| farklı on yıl, ilk 4 (ort.) | 2.68 | 2.88 | 2.59 | 2.68 | 2.67 |
| en sık türün payı, ilk 4 (ort.) | 97.0% | 96.9% | 97.1% | 96.6% | 100.0% |
| ≥3 moodda görünen film, ilk 4 (adet / slot payı) | 4 / 12.0% | 0 / 0.0% | 0 / 0.0% | 2 / 6.8% | 0 / 0.0% |
| ≥3 moodda görünen film, ilk 8 (adet / slot payı) | 19 / 32.0% | 1 / 4.7% | 1 / 2.9% | 14 / 26.7% | 0 / 0.0% |
| pre-1970 film, ilk 4 (toplam) | 3 | 3 | 0 | 3 | 0 |
| pre-1970 film, ilk 8 (toplam) | 10 | 6 | 4 | 10 | 0 |

**≥3 moodda ilk 4'te görünen filmler (V3, tümü):** Before Sunrise (1995) ×3; Paddington 2 (2017) ×3; Klaus (2019) ×3; The Emperor's New Groove (2000) ×3

**≥3 moodda ilk 8'de görünen filmler (V3, tümü):** Inception (2010) ×5; Call Me by Your Name (2017) ×4; Moonlight (2016) ×4; The Farewell (2019) ×4; Eternal Sunshine of the Spotless Mind (2004) ×4; Paddington 2 (2017) ×4; Before Sunrise (1995) ×3; Portrait of a Lady on Fire (2019) ×3; Lost in Translation (2003) ×3; The Prestige (2006) ×3; Arrival (2016) ×3; Mulholland Drive (2001) ×3; Amélie (2001) ×3; Klaus (2019) ×3; Boyhood (2014) ×3; The Emperor's New Groove (2000) ×3; The Lego Movie (2014) ×3; Knives Out (2019) ×3; Manchester by the Sea (2016) ×3

(TR segmentinde 3 mood vardır; "≥3 mood" eşiği orada yalnız hepsinde görünen filmi yakalar.)

## Era etkisi (V0 ↔ V1: vektörde era segmenti sıfırlanmış)

_V1 rerank henüz tamamlanmadı; final liste kesişimi yok._

### 1970 öncesi film sayısı (ilk 4 / ilk 8, tümü)

| varyant | sıra | n mood | pre-1970 ilk 4 | pre-1970 ilk 8 |
| --- | --- | --- | --- | --- |
| V0 | rerank sonrası | 25 | 6 | 12 |
| V0 | RPC sırası | 25 | 3 | 8 |

## Rerank aday etkisi (V0 ↔ V2: 30 aday/150 kr ↔ 20 aday/100 kr)

_V0 ve V2 birlikte tamamlanmadı._

