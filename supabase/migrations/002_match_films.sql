create or replace function match_films(
  query_vector vector(384),
  match_count int default 20
)
returns table (
  id uuid,
  tmdb_id int,
  title text,
  year int,
  poster_url text,
  backdrop_url text,
  overview text,
  genres text[],
  runtime int,
  vote_average float,
  similarity float,
  dimensions_json jsonb
)
language sql stable
as $$
  select
    f.id, f.tmdb_id, f.title, f.year, f.poster_url,
    f.backdrop_url, f.overview, f.genres, f.runtime,
    f.vote_average,
    1 - (fp.profile_vector <=> query_vector) as similarity,
    fp.dimensions_json
  from film_profiles fp
  join films f on f.id = fp.film_id
  order by fp.profile_vector <=> query_vector
  limit match_count;
$$;
