# MOOD-VEC V3 ↔ V5 özet (ölçüm; puanlama yok)

V3 kaynağı: `docs\investigations\mood-vec-2c\eval` · V5 kaynağı: `docs\investigations\mood-vec-2e\eval`
Örneklem: V3 25 mood · V5 25 mood (quick 8) · önbellekli geçiş 8 quick mood.
V5 = istemcinin saf hattı (`services/moodGauntlet.ts` doğrudan): parse v2 + quick_mood_id → match_films_v4 → id-rerank {count:4, reason:false, ilk 20} → reasons {reason:true, yalnız 4 film}. Yoğunluk / "Başka bir dörtlü" yok; soğuk eval hesabı (dışlama yok).

## Süre (ms, aşama bazında; eval bekleme süreleri düşülmüş)

dörtlü-görünür = parse + v4 + pick (V3: parse + RPC + birleşik rerank). `reasons` dörtlü göründükten sonra arkadan gelir, görünürlüğe dahil değildir.

| Küme | n | parse p50 | v4 p50 | pick p50 | reasons p50 | birleşik rerank p50 (V3) | dörtlü-görünür p50 | dörtlü-görünür p90 | hedef |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V3 tümü (2c) | 25 | 6561 | 832 | — | — | 4022 | 11424 | 12535 | — |
| V3 serbest | 17 | 6369 | 832 | — | — | 3892 | 11354 | 12231 | — |
| V3 quick | 8 | 6836 | 837 | — | — | 4055 | 11851 | 13079 | — |
| V5 tümü (ilk geçiş) | 25 | 4559 | 828 | 1466 | 2516 | — | 6819 | 7177 | — |
| V5 serbest (ilk geçiş) | 17 | 4575 | 817 | 1425 | 2490 | — | 6819 | 7256 | GEÇTİ (≤8000) |
| V5 quick (ilk geçiş, önbelleksiz) | 8 | 4331 | 908 | 1542 | 2596 | — | 6799 | 7105 | — |
| V5 quick (ÖNBELLEKLİ ikinci geçiş) | 8 | 813 | 957 | 1399 | 2484 | — | 3231 | 3706 | GEÇTİ (≤5000) |

pick p50 (V5, ilk + önbellekli geçiş): **1442 ms** — hedef ≤ 3000 → **GEÇTİ** (n=33).

## Kalite: V3 ↔ V5 ilk 4 kesişimi

Ortalama kesişim: **1.20 / 4** (25 mood) · birebir aynı küme: 0/25.

| mood | tür | dil | ortak | n (V3/V5) | durum |
| --- | --- | --- | --- | --- | --- |
| qm_rainy | quick | en | 2 | 4/4 | DEĞİŞTİ |
| qm_mindbending | quick | en | 1 | 4/4 | DEĞİŞTİ |
| qm_date | quick | en | 1 | 4/4 | DEĞİŞTİ |
| qm_adrenaline | quick | en | 2 | 4/4 | DEĞİŞTİ |
| qm_comedy | quick | en | 2 | 4/4 | DEĞİŞTİ |
| qm_nostalgia | quick | en | 0 | 4/4 | DEĞİŞTİ |
| qm_cozy | quick | en | 0 | 4/4 | DEĞİŞTİ |
| qm_emotional | quick | en | 1 | 4/4 | DEĞİŞTİ |
| ft_physics | free | en | 0 | 4/4 | DEĞİŞTİ |
| ft_tired_light | free | en | 0 | 4/4 | DEĞİŞTİ |
| ft_date_first | free | en | 1 | 4/4 | DEĞİŞTİ |
| ft_family_kids | free | en | 1 | 4/4 | DEĞİŞTİ |
| ft_friends_scary | free | en | 2 | 4/4 | DEĞİŞTİ |
| ft_like_interstellar | free | en | 1 | 4/4 | DEĞİŞTİ |
| ft_sad_cry | free | en | 0 | 4/4 | DEĞİŞTİ |
| ft_heist | free | en | 2 | 4/4 | DEĞİŞTİ |
| ft_90min | free | en | 1 | 4/4 | DEĞİŞTİ |
| ft_slow_beautiful | free | en | 1 | 4/4 | DEĞİŞTİ |
| ft_true_story | free | en | 2 | 4/4 | DEĞİŞTİ |
| ft_breakup | free | en | 2 | 4/4 | DEĞİŞTİ |
| ft_nostalgia_80s | free | en | 2 | 4/4 | DEĞİŞTİ |
| ft_dark_thriller | free | en | 3 | 4/4 | DEĞİŞTİ |
| ft_tr_hafif | free | tr | 1 | 4/4 | DEĞİŞTİ |
| ft_tr_aile | free | tr | 0 | 4/4 | DEĞİŞTİ |
| ft_tr_gerilim | free | tr | 2 | 4/4 | DEĞİŞTİ |

Değişen satırlar (V5 dörtlüsünde olup V3 ilk 4'te olmayanlar): `changed-rows.csv` — mood_id, rank, title, year, imdb_votes, channels, reason.

## Tanınırlık ve tekrar

| ölçü | V3 ilk 4 | V5 dörtlü |
| --- | --- | --- |
| imdb_votes medyan | 422306 | 362974 |
| < 100k payı (imdb_votes olanlar içinde) | 6.0% | 10.0% |
| imdb_votes NULL/0 (hariç) | 0/100 | 0/100 |
| ≥3 moodda tekrar eden film sayısı | 4 | 1 |
| tekrarlı filmlerin slot payı | 12.0% | 3.0% |
| farklı film (toplam slot içinde) | 81/100 | 85/100 |

V3 ≥3 moodda tekrar: Before Sunrise (1995) ×3, Paddington 2 (2017) ×3, Klaus (2019) ×3, The Emperor's New Groove (2000) ×3

V5 ≥3 moodda tekrar: Klaus (2019) ×3

## Kanal dağılımı (match_films_v4: v = vektör, a = anahtar kelime, c = referans/öneri; dörtlü satırları)

| kanal | V3 satır | V3 pay | V5 satır | V5 pay |
| --- | --- | --- | --- | --- |
| a | 4 | 4.0% | 0 | 0.0% |
| a+c | 4 | 4.0% | 6 | 6.0% |
| a+c+v | 2 | 2.0% | 2 | 2.0% |
| a+v | 3 | 3.0% | 6 | 6.0% |
| c | 55 | 55.0% | 40 | 40.0% |
| c+v | 7 | 7.0% | 3 | 3.0% |
| v | 25 | 25.0% | 43 | 43.0% |

## Gerekçeler ve yedek yollar (V5: ilk geçiş + önbellekli geçiş)

Gerekçe çağrısı: 33 · başarısız/zaman aşımı: 0 · dörtlü slotu: 132 · gerekçesi gelen: 129 · 12 kelimeyi aşan: 40 · 16 kelimeyi aşan: 0.
**reasons_dropped (sunucu yanıt sayaçları toplamı): 3.** reason_model: claude-haiku-4-5 ×33.
Yedek yol (onFallback): yok.


Tüm gerekçeler: `reasons-v5.csv` (TR bozuk Türkçe kontrolü için gözle bakılır).
