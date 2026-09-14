-- ============================================================
-- Pista — esquema inicial (Fase 1: perfil, feed, racha diaria)
-- Pensado para que añadir deportes o campos internos por deporte
-- (p.ej. la ruta de un ciclismo) NO requiera tocar el esquema:
--   - Nuevo deporte  -> insertar una fila en `sports`
--   - Nuevo campo de un deporte (ruta, desnivel, series, lo que sea)
--     -> se guarda dentro de `posts.details`, que es JSON libre
-- ============================================================

create extension if not exists "pgcrypto";

-- Catálogo de deportes. Añadir uno nuevo = una fila aquí, nada más.
create table public.sports (
  id text primary key,            -- slug: 'running', 'ciclismo', ...
  name text not null,
  icon_key text not null,         -- referencia al icono en src/lib/sports.js
  created_at timestamptz default now()
);

insert into public.sports (id, name, icon_key) values
  ('running',    'Running',    'walk-outline'),
  ('ciclismo',   'Ciclismo',   'bicycle-outline'),
  ('gym',        'Gym',        'barbell-outline'),
  ('calistenia', 'Calistenia', 'body-outline'),
  ('natacion',   'Natación',   'water-outline')
on conflict (id) do nothing;

-- Perfil público de cada usuario (1:1 con auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  onboarded boolean not null default false, -- true en cuanto pasa (o salta) la elección de deportes
  created_at timestamptz default now()
);

-- Deportes que practica cada usuario (elegidos en el onboarding, editable luego)
create table public.profile_sports (
  profile_id uuid references public.profiles(id) on delete cascade,
  sport_id text references public.sports(id) on delete cascade,
  primary key (profile_id, sport_id)
);

-- Publicaciones. `details` es JSON libre: cada deporte/tipo mete ahí lo suyo
-- sin necesitar una migración. Ejemplos:
--   ruta + ciclismo -> {"distance_km":42.3,"duration_min":95,"elevation_m":610,"route":[[41.40,2.19],[41.41,2.20],...]}
--   progreso + gym  -> {"exercise":"sentadilla","before":60,"after":75,"unit":"kg"}
--   resena          -> {"place":"CrossFit Poblenou","rating":4}
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  sport_id text references public.sports(id),
  type text not null check (type in ('ruta','progreso','comida','tip','resena')),
  caption text,
  details jsonb not null default '{}'::jsonb,
  location text,
  created_at timestamptz default now()
);
create index posts_author_idx on public.posts(author_id);
create index posts_sport_idx on public.posts(sport_id);
create index posts_details_gin on public.posts using gin (details);

-- Fotos de un post (0 o varias)
create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  url text not null,
  position int default 0
);

create table public.likes (
  post_id uuid references public.posts(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, profile_id)
);

create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- Reto diario / racha: una fila por usuario y día que marca actividad
create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade not null,
  sport_id text references public.sports(id),
  check_date date not null default current_date,
  created_at timestamptz default now(),
  unique (profile_id, check_date)
);

-- Racha actual (días consecutivos hasta hoy) calculada al vuelo, sin duplicar estado
create or replace function public.current_streak(p_profile_id uuid)
returns int language sql stable as $$
  with days as (
    select check_date from public.daily_checkins
    where profile_id = p_profile_id
    order by check_date desc
  ), numbered as (
    select check_date, row_number() over (order by check_date desc) as rn from days
  )
  select coalesce(count(*), 0)::int from numbered
  where check_date = current_date - (rn - 1) * interval '1 day';
$$;

-- ============================================================
-- Row Level Security: lectura pública (es una red social), escritura
-- solo del propio dueño de cada fila.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.profile_sports enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.daily_checkins enable row level security;

create policy "profiles: lectura pública" on public.profiles for select using (true);
create policy "profiles: el dueño se crea" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: el dueño se edita" on public.profiles for update using (auth.uid() = id);

create policy "profile_sports: lectura pública" on public.profile_sports for select using (true);
create policy "profile_sports: el dueño gestiona los suyos" on public.profile_sports for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "posts: lectura pública" on public.posts for select using (true);
create policy "posts: el autor gestiona los suyos" on public.posts for all
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

create policy "post_media: lectura pública" on public.post_media for select using (true);
create policy "post_media: el autor del post gestiona sus fotos" on public.post_media for all
  using (exists (select 1 from public.posts where posts.id = post_media.post_id and posts.author_id = auth.uid()))
  with check (exists (select 1 from public.posts where posts.id = post_media.post_id and posts.author_id = auth.uid()));

create policy "likes: lectura pública" on public.likes for select using (true);
create policy "likes: cada uno gestiona los suyos" on public.likes for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "follows: lectura pública" on public.follows for select using (true);
create policy "follows: cada uno gestiona a quién sigue" on public.follows for all
  using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

create policy "checkins: lectura pública" on public.daily_checkins for select using (true);
create policy "checkins: cada uno marca los suyos" on public.daily_checkins for insert
  with check (auth.uid() = profile_id);

-- Bucket de Storage para fotos de posts y avatares (ejecutar una vez)
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media: lectura pública" on storage.objects for select using (bucket_id = 'media');
create policy "media: solo usuarios autenticados suben" on storage.objects for insert
  with check (bucket_id = 'media' and auth.role() = 'authenticated');
