# MOOD-VEC-2c eval özeti — V0 ↔ V3

Mood sayısı (ikisinde de tamamlanan): 25. Ölçüt: kalite süzgeci sonrası ilk 4 film. Puanlama yok; fit/recognizable elle, rating-top4.csv'de.

## Tanınırlık ve eskilik

| ölçüt | V0 | V3 |
| --- | --- | --- |
| imdb_votes medyan (0/NULL hariç) | 229698 | 422306 |
| < 100k oy payı | 27.0% | 6.0% |
| imdb_votes NULL/0 slot | 0/100 | 0/100 |
| 1970 öncesi film | 6/100 | 3/100 |
| tekil film sayısı | 82 | 81 |

## Tekrar eden filmler (≥3 moodda)

|  | film sayısı | filmler |
| --- | --- | --- |
| V0 | 2 | Klaus (2019) ×4; The Usual Suspects (1995) ×3 |
| V3 | 4 | Before Sunrise (1995) ×3; Paddington 2 (2017) ×3; Klaus (2019) ×3; The Emperor's New Groove (2000) ×3 |

## Tür payı (ilk 4, film başına tüm türler)

| tür | V0 | V3 |
| --- | --- | --- |
| Drama | 54.0% | 50.0% |
| Comedy | 24.0% | 35.0% |
| Adventure | 23.0% | 26.0% |
| Family | 20.0% | 27.0% |
| Animation | 19.0% | 24.0% |
| Thriller | 19.0% | 19.0% |
| Science Fiction | 12.0% | 20.0% |
| Romance | 13.0% | 18.0% |
| Fantasy | 13.0% | 15.0% |
| Action | 14.0% | 10.0% |
| Mystery | 9.0% | 13.0% |
| Crime | 10.0% | 7.0% |
| History | 8.0% | 5.0% |
| Music | 4.0% | 3.0% |
| Horror | 1.0% | 5.0% |

## Süreler (ms) — p50 / p90

| aşama | n (V0) | V0 p50 | V0 p90 | n (V3) | V3 p50 | V3 p90 |
| --- | --- | --- | --- | --- | --- | --- |
| parse | 25 | 4297 | 4574 | 25 | 6561 | 7163 |
| RPC (toplam deneme) | 25 | 1043 | 1286 | 25 | 832 | 1187 |
| rerank | 25 | 2900 | 3476 | 25 | 4022 | 4753 |
| toplam (parse+RPC+rerank) | 25 | 8252 | 8951 | 25 | 11424 | 12535 |

_Parse süreleri istemciden uca ölçülür. V0 parse süresi mood-vec-1 önbelleğinden gelir (eski koşu)._

## V3 kanal dağılımı (ilk 4)

| kanal (çoklu sayılır) | slot | pay |
| --- | --- | --- |
| v | 37 | 37.0% |
| a | 13 | 13.0% |
| c | 68 | 68.0% |

| kanal birleşimi | slot | pay |
| --- | --- | --- |
| c | 55 | 55.0% |
| v | 25 | 25.0% |
| c+v | 7 | 7.0% |
| a+c | 4 | 4.0% |
| a | 4 | 4.0% |
| a+v | 3 | 3.0% |
| a+c+v | 2 | 2.0% |

## V3 notları

- rerank sunucu fallback: 0/25, rerank kaydı olmayan: 0
- rerank > 6 sn (uygulama zaman aşımı): 0
- RPC satır sayısı medyan: 40

