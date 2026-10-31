# MOOD-VEC-2b Faz 1 — üretim özeti

- Arşiv: 1633; kapıyı doğrudan geçen: 682
- A adayı (DB rating+votes dolu): 469; B adayı (rating NULL): 208; B çözülemeyen (TMDb/tmdb_id): 5
- rating dolu ama votes NULL (kapsam dışı): 0
- B: veri dosyasında yok: 4
- Tier'ı arşivde KALAN (kural B): 259 (A 145, B 114)
- Tier'ı arşivden ÇIKACAK adaylar (tier != archive): 414 → SQL'e giren 77, hariç tutulan 337 (A 282, B 55)
- Hariç tutulanların BİRİNCİL nedeni (CTO filtre sırası; bir film birden çok bayrak taşıyabilir):
  - votes: 271 (bu bayrağı taşıyan toplam 271)
  - inconsistent: 60 (bu bayrağı taşıyan toplam 60)
  - content: 2 (bu bayrağı taşıyan toplam 22)
  - imdbid: 0 (bu bayrağı taşıyan toplam 0)
  - concert: 0 (bu bayrağı taşıyan toplam 6)
  - trending079: 4 (bu bayrağı taşıyan toplam 4)
  - tierfloor: 0 (bu bayrağı taşıyan toplam 20)
- **Faz 1A SQL: 42 film** (core 0, extended 42)
- **Faz 1B SQL: 35 film** (core 1, extended 34; imdb_id yazılan 0)

## Bayrak dağılımı (film başına birden çok bayrak olabilir; sayılar bayrak adedi)
- [votes] votes N < N ((…)): 271
- [inconsistent] oy tutarsız: kullanılan N (< N), diğer kaynak N ((…)): 38
- [inconsistent] oy tutarsız: kullanılan N (>= N), diğer kaynak N ((…)): 22
- [tierfloor] oy tabanı altı: votes N < N ama determineCurationTier core döndürdü: 20
- [content] genres Documentary: 15
- [concert] konser/performans listesi ('…'): 5
- [content] titleType=tvMovie: 4
- [trending079] N trending-restore ile düşen ('…'): 4
- [content] titleType=video: 2
- [content] titleType=tvMiniSeries: 1
- [content] basics runtime yok: 1
- [concert] konser/performans listesi ('…'m tim'): 1

## B — veri dosyasında bulunamayan
- I Am The Bride (tt38288913)
- Diamond Made Man (tt39674832)
- Faithless (tt43625242)
- Her Private Hell (tt36629891)

## B — çözülemeyen
- Mosquito Halo: TMDb external_ids imdb_id döndürmedi (null veya 404)
- The Kingdom: TMDb external_ids imdb_id döndürmedi (null veya 404)
- Veerabhadrudu: TMDb external_ids imdb_id döndürmedi (null veya 404)
- Catman: TMDb external_ids imdb_id döndürmedi (null veya 404)
- Waffle F1 - The Movie: TMDb external_ids imdb_id döndürmedi (null veya 404)
