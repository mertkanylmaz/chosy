# MOOD-VEC-2b Adım 1c — Faz 1C (tutarsız oy filmleri)

31 Eki 2026 · dal `feat/mood-vec-2b` (kaynak HEAD `bcb3c84`) · **yalnız hazırlık**, canlıya yazılmadı. 1A canlıda uygulandı (42 film); 1B (`phase1b-apply.sql`) henüz uygulanmadı.

## Kapsam ve kural

Adım 1b'deki "oy tutarsız" kuralının atladığı 60 film (22 B + 38 A) dosya (IMDb dataset, 26 Eki) oyuyla işlendi:
- Oy tabanı kontrolü dosya değeriyle ≥ 10.000; tier `determineCurationTier` ile (A: DB rating + dosya oyu, B: dosya rating + dosya oyu).
- Diğer filtreler aynı: titleType (yalnız *Angel's Egg* tvMovie/video istisnası), isAdult, runtime ≥ 60, Documentary, konser listesi, 079'un 4 filmi.
- Betik: `scripts/backfill-imdb-archive.ts --1c` (yalnız `phase1c-*` yazar; 1A/1B dosyalarına ve CSV'ye dokunmaz).

## Sonuç: 60 → 58 UPDATE

| | UPDATE | core | extended |
|---|---|---|---|
| A (38 → 36) | 36 | 6 | 30 |
| B (22) | 22 | 2 | 20 |
| **1C** | **58** | **8** | **50** |

Dosya başına: **1C-1 = 30**, **1C-2 = 28** (terminal kesilmesin diye iki parça; her biri kendi yedek tablosunu açar: `films_phase1c1_backup_20261031`, `films_phase1c2_backup_20261031`).

Hariç (2, ikisi de Documentary): *The Gleaners and I* (dosya 10.433), *The Mole Agent* (10.384).

Core (8): *Satluj* (B, 8,8/106.958), *Satantango* (B, 8,2/14.693), *Dr. Mabuse, the Gambler* (7,8/10.117), *Early Summer* (8,1/10.947), *The Wonderful Story of Henry Sugar and Three More* (7,1/13.762), *Scenes from a Marriage* (8,3/10.743), *Barefoot Gen* (8/10.685), *Othello* (7,5/10.343). A'daki core'lar `determineCurationTier` core kurallarından (auteur/oscar/Criterion vb.) gelir; fonksiyon değişmedi.

*Angel's Egg* (1985, A, 7,7 / dosya 18.380, eski DB oyu 7.817) → extended, dahil.

## UPDATE şablonu

- A: `SET imdb_votes = <dosya>, curation_tier = '<yeni>' WHERE id = … AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM <eski DB oyu>`
- B: `SET imdb_votes = <dosya>, imdb_rating = <dosya>, curation_tier = … WHERE id = … AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM <eski> AND imdb_rating IS NULL`
- `imdb_id` yazılan: 0.

## Kapsam dışı not

A'da DB oyu bayat olduğu için tier'ı hâlâ `archive` kalıp dosya oyu ≥ 10k olan film: **1** (*Burning Days*, 2022, DB 7,5/144 → bu betiğin eski tutarsızlık kuralının kapsamında değildi). 60'lık listenin parçası değil, SQL'e girmedi.

## Etki (canlı SELECT, 1A uygulanmış hâl → 1B + 1C birlikte)

Günlük havuz (core+extended+trending, kapıdan geçen): 1.990 → **2.083** (+93 = 35 + 58). Tier eklenen: core +9 (1B 1 + 1C 8), extended +84.

| | önce | sonra |
|---|---|---|
| p55 oy | 85.119 | **83.010** (−%2,5) |
| p80 oy | 323.963 | **307.747** (−%5,0) |
| medyan | 66.989 | 63.197 |
| bant içi (mevcut filmler) | 498 / 1.990 | 15 çıkıyor, 17 giriyor |
| bant içi (yeni filmler) | – | 20 / 93 |
| ort. tanınırlık puanı (mevcut / yeni) | 0,325 | 0,328 / 0,249 |

Yalnız 1C (1B'siz): havuz 1.990 → 2.048, p55 → 83.647, p80 → 310.352, 11 çıkan / 13 giren, yeni filmlerden bantta 12/58.

**Global slot havuzu (core+trending):** 906 → **915** (+9), p55 290.328 → 285.729, p80 684.003 → 682.124; mevcutlardan bandı terk eden 2, giren 4; yeni 9 filmden bantta 0. Giren core filmler:

| film | rating / oy |
|---|---|
| *Satluj* (2026, B) | 8,8 / 106.958 |
| *Jailer 2* (2026, B, 1B) | 8,2 / 15.326 |
| *Satantango* (1994, B) | 8,2 / 14.693 |
| *The Wonderful Story of Henry Sugar and Three More* (2024, A) | 7,1 / 13.762 |
| *Early Summer* (1951, A) | 8,1 / 10.947 |
| *Scenes from a Marriage* (1974, A) | 8,3 / 10.743 |
| *Barefoot Gen* (1983, A) | 8,0 / 10.685 |
| *Othello* (1951, A) | 7,5 / 10.343 |
| *Dr. Mabuse, the Gambler* (1922, A) | 7,8 / 10.117 |

Global slotta core eklerin hepsi 10k–107k oy bandında; global p55 (≈286k) altında oldukları için hiçbiri bantta değil.
