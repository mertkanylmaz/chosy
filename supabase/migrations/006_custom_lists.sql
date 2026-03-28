-- 006_custom_lists.sql
-- Kullanıcı tanımlı özel film listeleri

-- ----------------------------------------------------------------
-- custom_lists — liste meta verisi
-- ----------------------------------------------------------------
create table if not exists public.custom_lists (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null,
  name        text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists custom_lists_user_idx on public.custom_lists (user_id);

alter table public.custom_lists enable row level security;

create policy "custom_lists: kullanıcı kendi listelerini yönetir"
  on public.custom_lists
  for all
  using  (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

-- ----------------------------------------------------------------
-- custom_list_films — liste ↔ film ilişkisi
-- ----------------------------------------------------------------
create table if not exists public.custom_list_films (
  id        uuid        primary key default gen_random_uuid(),
  list_id   uuid        not null references public.custom_lists (id) on delete cascade,
  film_id   text        not null,
  added_at  timestamptz not null default now(),
  unique (list_id, film_id)
);

create index if not exists custom_list_films_list_idx on public.custom_list_films (list_id);

alter table public.custom_list_films enable row level security;

create policy "custom_list_films: liste sahibi yönetir"
  on public.custom_list_films
  for all
  using (
    exists (
      select 1 from public.custom_lists
      where id = list_id
        and user_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from public.custom_lists
      where id = list_id
        and user_id = auth.uid()::text
    )
  );
