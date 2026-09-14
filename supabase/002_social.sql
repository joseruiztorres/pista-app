-- ============================================================
-- Pista — Fase 2: comentarios reales y medallas
-- Ejecutar una sola vez en el SQL Editor de Supabase, después de schema.sql.
-- (Seguir gente ya funciona: usa la tabla `follows` que ya existía.)
-- ============================================================

-- Comentarios reales en publicaciones
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);
create index comments_post_idx on public.comments(post_id);

alter table public.comments enable row level security;
create policy "comments: lectura pública" on public.comments for select using (true);
create policy "comments: el autor gestiona los suyos" on public.comments for all
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- Catálogo de medallas. Añadir una nueva = una fila aquí + su icono en src/lib/badges.js
create table public.badges (
  id text primary key,
  name text not null,
  description text not null,
  icon_key text not null
);

insert into public.badges (id, name, description, icon_key) values
  ('streak_3',   'Constancia x3', '3 días seguidos marcando actividad', 'flame-outline'),
  ('streak_7',   'Una semana',    '7 días seguidos marcando actividad', 'flame'),
  ('streak_30',  'Un mes entero', '30 días seguidos marcando actividad', 'trophy-outline'),
  ('first_post', 'Primer paso',   'Tu primera publicación en Pista', 'rocket-outline')
on conflict (id) do nothing;

-- Medallas ya conseguidas por cada usuario
create table public.profile_badges (
  profile_id uuid references public.profiles(id) on delete cascade,
  badge_id text references public.badges(id) on delete cascade,
  earned_at timestamptz default now(),
  primary key (profile_id, badge_id)
);

alter table public.badges enable row level security;
alter table public.profile_badges enable row level security;
create policy "badges: lectura pública" on public.badges for select using (true);
create policy "profile_badges: lectura pública" on public.profile_badges for select using (true);
create policy "profile_badges: cada uno gestiona las suyas" on public.profile_badges for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
