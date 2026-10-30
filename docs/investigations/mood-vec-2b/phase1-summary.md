# MOOD-VEC-2b Faz 1 — üretim özeti

- Arşiv: 1633; kapıyı doğrudan geçen: 682
- A adayı (DB rating+votes dolu): 469; B adayı (rating NULL): 208; B çözülemeyen (TMDb/tmdb_id): 5
- rating dolu ama votes NULL (kapsam dışı): 0
- B: veri dosyasında yok: 4
- Tier'ı arşivde KALAN (kural B): 259 (A 145, B 114)
- İçerik bayraklı: A 39, B 11
- İçerik taramasına takılan (tier'ı archive'dan çıkacaktı, SQL'e GİRMEDİ): 50 (KESIN 1, yalnız ELLE 49)
- **Faz 1A SQL: 285 film** (core 36, extended 249)
- **Faz 1B SQL: 79 film** (core 4, extended 75; imdb_id yazılan 0)

## Bayrak dağılımı (film başına birden çok bayrak olabilir)
- ELLE: oy tabanı altı: votes N < N ama determineCurationTier core döndürdü: 20
- ELLE: genres Music: 14
- ELLE: genres Documentary: 9
- ELLE: genres Documentary/Music: 6
- ELLE: başlıkta '…': 5
- ELLE: titleType=tvMovie: 4
- ELLE: titleType=video: 3
- KESIN: titleType=tvMiniSeries: 1
- ELLE: basics runtime yok: 1
- toplam bayrak: KESIN 1, ELLE 62

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
