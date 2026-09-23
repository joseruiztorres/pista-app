-- ============================================================
-- Pista -- Fase 15: objetivos, retos, calendario y nuevas medallas.
-- Ejecutar una sola vez despues de 010_video_actividad_privacidad.sql.
-- ============================================================

create table if not exists public.challenges (
  id text primary key,
  title text not null,
  description text not null,
  icon_key text not null default 'trophy-outline',
  metric text not null check (metric in ('sessions', 'distance_km', 'minutes', 'sports')),
  target numeric not null check (target > 0),
  duration_days integer not null default 7 check (duration_days between 1 and 365),
  sport_id text references public.sports(id) on delete set null,
  badge_id text references public.badges(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_members (
  profile_id uuid references public.profiles(id) on delete cascade,
  challenge_id text references public.challenges(id) on delete cascade,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (profile_id, challenge_id)
);

create table if not exists public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade not null,
  metric text not null check (metric in ('sessions', 'distance_km', 'minutes')),
  target numeric not null check (target > 0),
  sport_id text references public.sports(id) on delete set null,
  week_start date not null,
  created_at timestamptz not null default now(),
  unique (profile_id, metric, week_start)
);

create table if not exists public.training_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade not null,
  sport_id text references public.sports(id) on delete set null,
  title text not null,
  scheduled_for timestamptz not null,
  duration_min integer check (duration_min is null or duration_min between 1 and 1440),
  notes text,
  status text not null default 'planned' check (status in ('planned', 'completed', 'skipped')),
  created_at timestamptz not null default now()
);

create index if not exists challenge_members_profile_idx on public.challenge_members(profile_id);
create index if not exists weekly_goals_profile_week_idx on public.weekly_goals(profile_id, week_start);
create index if not exists training_events_profile_date_idx on public.training_events(profile_id, scheduled_for);

alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
alter table public.weekly_goals enable row level security;
alter table public.training_events enable row level security;

create policy "challenges: lectura publica" on public.challenges for select using (true);
create policy "challenge_members: lectura publica" on public.challenge_members for select using (true);
create policy "challenge_members: cada uno gestiona los suyos" on public.challenge_members for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "weekly_goals: cada uno ve los suyos" on public.weekly_goals for select using (auth.uid() = profile_id);
create policy "weekly_goals: cada uno gestiona los suyos" on public.weekly_goals for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "training_events: cada uno ve los suyos" on public.training_events for select using (auth.uid() = profile_id);
create policy "training_events: cada uno gestiona los suyos" on public.training_events for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

insert into public.badges (id, name, description, icon_key) values
  ('activities_5', 'En marcha', 'Completa 5 entrenamientos', 'flash-outline'),
  ('activities_25', 'Imparable', 'Completa 25 entrenamientos', 'fitness-outline'),
  ('distance_10', 'Primeros 10K', 'Acumula 10 km en actividades', 'map-outline'),
  ('variety_3', 'Multideporte', 'Entrena 3 deportes distintos', 'apps-outline'),
  ('climb_start', 'Hacia arriba', 'Completa 3 sesiones de escalada', 'trending-up-outline'),
  ('planner_3', 'Plan cumplido', 'Completa 3 entrenamientos planificados', 'calendar-outline'),
  ('week_3', 'Semana en marcha', 'Completa 3 entrenamientos en 7 días', 'calendar-number-outline'),
  ('active_300', 'Semana 300', 'Acumula 300 minutos de deporte', 'time-outline')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  icon_key = excluded.icon_key;

insert into public.challenges (id, title, description, icon_key, metric, target, duration_days, sport_id, badge_id) values
  ('week_3', 'Tres días en movimiento', 'Completa 3 entrenamientos en 7 días.', 'calendar-outline', 'sessions', 3, 7, null, 'week_3'),
  ('distance_10', 'Suma 10 kilómetros', 'Acumula 10 km durante los próximos 14 días.', 'map-outline', 'distance_km', 10, 14, null, 'distance_10'),
  ('variety_3', 'Prueba tres deportes', 'Registra 3 deportes diferentes en 14 días.', 'apps-outline', 'sports', 3, 14, null, 'variety_3'),
  ('active_300', 'Semana 300', 'Acumula 300 minutos de deporte en 14 días.', 'time-outline', 'minutes', 300, 14, null, 'active_300'),
  ('climb_3', 'Tres días hacia arriba', 'Completa 3 sesiones de escalada en 21 días.', 'trending-up-outline', 'sessions', 3, 21, 'escalada', 'climb_start')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  icon_key = excluded.icon_key,
  metric = excluded.metric,
  target = excluded.target,
  duration_days = excluded.duration_days,
  sport_id = excluded.sport_id,
  badge_id = excluded.badge_id,
  active = true;
