# MOOD-VEC-2 — IMDb veri dosyası backfill özeti

- Kapsam: 158 film (tier core/extended/trending, imdb_rating IS NULL)
- Dosyada bulundu (rating + votes yazılacak): 150
- Dosyada yok (rating NULL kalır): 8
  - bunlardan imdb_votes NULL'a çekilecek (kirli TMDb vekili): 0
- TMDb external_ids ile imdb_id tamamlanan: 2
- imdb_id bulunamadı, SQL dışı: 0

## Dosyada bulunamayan filmler
- The Cat in the Hat (tt2321555, tmdb 1117898)
- Ebenezer (tt38773219, tmdb 1567605)
- Ramayana: Rise of a Legend (tt27988879, tmdb 656908)
- Ghost Soldier (tt38686316, tmdb 1562642)
- The Mongoose (tt13611778, tmdb 1294189)
- Dune: Part Three (tt31378509, tmdb 1170608)
- Avengers: Doomsday (tt21357150, tmdb 1003596)
- Madden (tt24818230, tmdb 1131943)

## imdb_id bulunamayan filmler (SQL dışı)
_yok_

## TMDb ile tamamlanan imdb_id
- The Bourne Ultimatum: tt0440963
- The Crow: tt0109506
