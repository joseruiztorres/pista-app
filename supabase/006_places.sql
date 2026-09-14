-- ============================================================
-- Pista -- Fase 8: reseñas de sitios (lugares)
-- Ejecutar una sola vez en el SQL Editor de Supabase, despues de 005_notifications.sql.
-- ============================================================

-- Directorio de lugares (gimnasios, parques, rutas...) sobre los que se
-- pueden dejar reseñas. La nota (rating) de cada reseña vive en
-- posts.details.rating, siguiendo el mismo patron extensible que el resto
-- de la app; aqui solo guardamos el sitio en si.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport_id text references public.sports(id),
  lat double precision,
  lng double precision,
  address text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);
create index places_sport_idx on public.places(sport_id);

alter table public.posts add column if not exists place_id uuid references public.places(id) on delete set null;
create index if not exists posts_place_idx on public.posts(place_id);

alter table public.places enable row level security;
create policy "places: lectura publica" on public.places for select using (true);
create policy "places: cualquiera autenticado crea sitios" on public.places for insert
  with check (auth.uid() = created_by);
create policy "places: el creador edita el suyo" on public.places for update
  using (auth.uid() = created_by) with check (auth.uid() = created_by);
