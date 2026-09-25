-- ============================================================
-- Pista -- Fase 16: niveles, identidad deportiva, logros y retos adaptativos.
-- Ejecutar una sola vez despues de 011_motivacion_objetivos_calendario.sql.
-- ============================================================

alter table public.badges add column if not exists difficulty text not null default 'normal';
alter table public.badges add column if not exists category text not null default 'general';
alter table public.badges add column if not exists xp_reward integer not null default 50;
alter table public.badges add column if not exists sort_order integer not null default 0;

alter table public.challenges add column if not exists difficulty text not null default 'normal';
alter table public.challenges add column if not exists category text not null default 'constancia';
alter table public.challenges add column if not exists points integer not null default 100;
alter table public.challenges add column if not exists is_template boolean not null default false;
alter table public.challenges add column if not exists season_key text;

create table if not exists public.profile_progress (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  athlete_type text not null default 'en_evolucion',
  athlete_label text not null default 'En evolución',
  stats jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);

create table if not exists public.personal_challenges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  template_key text not null,
  title text not null,
  description text not null,
  icon_key text not null default 'sparkles-outline',
  metric text not null check (metric in ('sessions', 'distance_km', 'minutes', 'sports')),
  target numeric not null check (target > 0),
  sport_id text references public.sports(id) on delete set null,
  difficulty text not null default 'normal' check (difficulty in ('facil', 'normal', 'dificil', 'epico')),
  points integer not null default 100 check (points >= 0),
  week_start date not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, template_key, week_start)
);

create index if not exists personal_challenges_profile_week_idx on public.personal_challenges(profile_id, week_start);

alter table public.profile_progress enable row level security;
alter table public.personal_challenges enable row level security;

drop policy if exists "profile_progress: lectura publica" on public.profile_progress;
create policy "profile_progress: lectura publica" on public.profile_progress for select using (true);
drop policy if exists "profile_progress: cada uno gestiona el suyo" on public.profile_progress;
create policy "profile_progress: cada uno gestiona el suyo" on public.profile_progress for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "personal_challenges: cada uno ve los suyos" on public.personal_challenges;
create policy "personal_challenges: cada uno ve los suyos" on public.personal_challenges for select
  using (auth.uid() = profile_id);
drop policy if exists "personal_challenges: cada uno gestiona los suyos" on public.personal_challenges;
create policy "personal_challenges: cada uno gestiona los suyos" on public.personal_challenges for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

insert into public.badges (id, name, description, icon_key, difficulty, category, xp_reward, sort_order) values
  ('first_post', 'Primer paso', 'Publica por primera vez en Pista', 'rocket-outline', 'facil', 'inicio', 30, 1),
  ('first_route', 'Primera huella', 'Graba tu primera ruta con GPS', 'navigate-outline', 'facil', 'rutas', 40, 2),
  ('first_plan', 'Con intención', 'Completa tu primer entrenamiento planificado', 'calendar-outline', 'facil', 'planificacion', 40, 3),
  ('first_meetup', 'En compañía', 'Apúntate a tu primera quedada', 'people-outline', 'facil', 'social', 40, 4),
  ('activities_5', 'En marcha', 'Completa 5 entrenamientos', 'flash-outline', 'facil', 'constancia', 50, 10),
  ('activities_10', 'Buen ritmo', 'Completa 10 entrenamientos', 'footsteps-outline', 'normal', 'constancia', 70, 11),
  ('activities_25', 'Imparable', 'Completa 25 entrenamientos', 'fitness-outline', 'normal', 'constancia', 100, 12),
  ('activities_50', 'Medio centenar', 'Completa 50 entrenamientos', 'barbell-outline', 'dificil', 'constancia', 150, 13),
  ('activities_100', 'Centenario', 'Completa 100 entrenamientos', 'medal-outline', 'dificil', 'constancia', 250, 14),
  ('activities_250', 'Leyenda activa', 'Completa 250 entrenamientos', 'diamond-outline', 'epico', 'constancia', 500, 15),
  ('streak_3', 'Constancia x3', 'Mantén una racha de 3 días', 'flame-outline', 'facil', 'racha', 35, 20),
  ('streak_7', 'Una semana', 'Mantén una racha de 7 días', 'flame', 'normal', 'racha', 75, 21),
  ('streak_30', 'Un mes entero', 'Mantén una racha de 30 días', 'trophy-outline', 'dificil', 'racha', 250, 22),
  ('streak_60', 'Fuego continuo', 'Mantén una racha de 60 días', 'bonfire-outline', 'dificil', 'racha', 400, 23),
  ('streak_100', 'Cien sin parar', 'Mantén una racha de 100 días', 'infinite-outline', 'epico', 'racha', 700, 24),
  ('weeks_4', 'Un mes constante', 'Completa 2 días activos durante 4 semanas', 'calendar-number-outline', 'normal', 'racha', 120, 25),
  ('distance_5', 'Primeros 5K', 'Acumula 5 km en actividades', 'map-outline', 'facil', 'distancia', 40, 30),
  ('distance_10', 'Primeros 10K', 'Acumula 10 km en actividades', 'map-outline', 'normal', 'distancia', 60, 31),
  ('distance_25', '25 kilómetros', 'Acumula 25 km en actividades', 'trail-sign-outline', 'normal', 'distancia', 90, 32),
  ('distance_50', 'Medio centenar', 'Acumula 50 km en actividades', 'trail-sign-outline', 'dificil', 'distancia', 140, 33),
  ('distance_100', 'Club de los 100K', 'Acumula 100 km en actividades', 'earth-outline', 'dificil', 'distancia', 220, 34),
  ('distance_250', 'Gran fondo', 'Acumula 250 km en actividades', 'globe-outline', 'dificil', 'distancia', 350, 35),
  ('distance_500', 'Horizonte 500', 'Acumula 500 km en actividades', 'compass-outline', 'epico', 'distancia', 550, 36),
  ('distance_1000', 'Mil kilómetros', 'Acumula 1.000 km en actividades', 'planet-outline', 'epico', 'distancia', 900, 37),
  ('active_300', 'Semana 300', 'Acumula 300 minutos de deporte', 'time-outline', 'facil', 'tiempo', 50, 40),
  ('active_600', 'Diez horas', 'Acumula 600 minutos de deporte', 'timer-outline', 'normal', 'tiempo', 80, 41),
  ('active_1500', '25 horas', 'Acumula 1.500 minutos de deporte', 'hourglass-outline', 'normal', 'tiempo', 140, 42),
  ('active_3000', '50 horas', 'Acumula 3.000 minutos de deporte', 'stopwatch-outline', 'dificil', 'tiempo', 250, 43),
  ('active_6000', 'Cien horas', 'Acumula 6.000 minutos de deporte', 'watch-outline', 'epico', 'tiempo', 500, 44),
  ('variety_3', 'Multideporte', 'Entrena 3 deportes distintos', 'apps-outline', 'normal', 'variedad', 75, 50),
  ('variety_5', 'Todoterreno', 'Entrena 5 deportes distintos', 'grid-outline', 'dificil', 'variedad', 150, 51),
  ('variety_10', 'Atleta total', 'Entrena 10 deportes distintos', 'color-palette-outline', 'epico', 'variedad', 350, 52),
  ('elevation_1000', 'Primer mil vertical', 'Acumula 1.000 m de desnivel', 'trending-up-outline', 'normal', 'desnivel', 90, 60),
  ('elevation_5000', 'Cinco cumbres', 'Acumula 5.000 m de desnivel', 'analytics-outline', 'dificil', 'desnivel', 220, 61),
  ('elevation_10000', 'Techo de Pista', 'Acumula 10.000 m de desnivel', 'triangle-outline', 'epico', 'desnivel', 450, 62),
  ('climb_start', 'Hacia arriba', 'Completa 3 sesiones de escalada', 'trending-up-outline', 'facil', 'escalada', 60, 70),
  ('climb_10', 'Agarre firme', 'Completa 10 sesiones de escalada', 'hand-left-outline', 'normal', 'escalada', 120, 71),
  ('climb_25', 'Vertical', 'Completa 25 sesiones de escalada', 'podium-outline', 'dificil', 'escalada', 250, 72),
  ('climb_vertical_1000', 'Mil metros verticales', 'Acumula 1.000 m escalando', 'trending-up', 'dificil', 'escalada', 220, 73),
  ('planner_3', 'Plan cumplido', 'Completa 3 entrenamientos planificados', 'calendar-outline', 'facil', 'planificacion', 60, 80),
  ('planner_10', 'Agenda activa', 'Completa 10 entrenamientos planificados', 'calendar-clear-outline', 'normal', 'planificacion', 130, 81),
  ('planner_25', 'Disciplina total', 'Completa 25 entrenamientos planificados', 'checkbox-outline', 'dificil', 'planificacion', 280, 82),
  ('route_5', 'Explorador', 'Graba 5 rutas con GPS', 'navigate-outline', 'normal', 'rutas', 90, 90),
  ('route_25', 'Cartógrafo', 'Graba 25 rutas con GPS', 'map-outline', 'dificil', 'rutas', 220, 91),
  ('route_50', 'Sin fronteras', 'Graba 50 rutas con GPS', 'compass-outline', 'epico', 'rutas', 420, 92),
  ('meetup_3', 'Buen equipo', 'Participa en 3 quedadas', 'people-circle-outline', 'normal', 'social', 90, 100),
  ('meetup_10', 'Comunidad Pista', 'Participa en 10 quedadas', 'people-outline', 'dificil', 'social', 220, 101)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  icon_key = excluded.icon_key,
  difficulty = excluded.difficulty,
  category = excluded.category,
  xp_reward = excluded.xp_reward,
  sort_order = excluded.sort_order;

update public.challenges set difficulty = 'normal', category = 'constancia', points = 100 where id = 'week_3';
update public.challenges set difficulty = 'normal', category = 'distancia', points = 120 where id = 'distance_10';
update public.challenges set difficulty = 'dificil', category = 'variedad', points = 160 where id = 'variety_3';
update public.challenges set difficulty = 'dificil', category = 'tiempo', points = 160 where id = 'active_300';
update public.challenges set difficulty = 'normal', category = 'escalada', points = 120 where id = 'climb_3';

insert into public.challenges (id, title, description, icon_key, metric, target, duration_days, badge_id, difficulty, category, points, active, season_key) values
  ('season_consistency_12', 'Temporada constante', 'Completa 12 entrenamientos en 30 días.', 'calendar-number-outline', 'sessions', 12, 30, null, 'dificil', 'temporada', 300, true, 'mensual'),
  ('season_distance_50', '50K de temporada', 'Suma 50 km en 30 días.', 'map-outline', 'distance_km', 50, 30, null, 'dificil', 'temporada', 350, true, 'mensual'),
  ('season_variety_5', 'Pasaporte deportivo', 'Practica 5 deportes en 30 días.', 'apps-outline', 'sports', 5, 30, null, 'epico', 'temporada', 500, true, 'mensual')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  icon_key = excluded.icon_key,
  metric = excluded.metric,
  target = excluded.target,
  duration_days = excluded.duration_days,
  difficulty = excluded.difficulty,
  category = excluded.category,
  points = excluded.points,
  active = true,
  season_key = excluded.season_key;
