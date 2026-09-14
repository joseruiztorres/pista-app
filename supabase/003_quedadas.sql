-- ============================================================
-- Pista -- Fase 3: quedadas con ubicacion real
-- Ejecutar una sola vez en el SQL Editor de Supabase, despues de 002_social.sql.
-- ============================================================

create table public.meetups (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid references public.profiles(id) on delete cascade not null,
  sport_id text references public.sports(id) not null,
  title text not null,
  description text,
  location_name text not null,
  lat double precision,
  lng double precision,
  scheduled_at timestamptz not null,
  created_at timestamptz default now()
);
create index meetups_scheduled_idx on public.meetups(scheduled_at);
create index meetups_sport_idx on public.meetups(sport_id);

alter table public.meetups enable row level security;
create policy "meetups: lectura publica" on public.meetups for select using (true);
create policy "meetups: el organizador crea" on public.meetups for insert
  with check (auth.uid() = organizer_id);
create policy "meetups: el organizador edita las suyas" on public.meetups for update
  using (auth.uid() = organizer_id) with check (auth.uid() = organizer_id);
create policy "meetups: el organizador borra las suyas" on public.meetups for delete
  using (auth.uid() = organizer_id);

-- Gente apuntada a cada quedada
create table public.meetup_attendees (
  meetup_id uuid references public.meetups(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (meetup_id, profile_id)
);

alter table public.meetup_attendees enable row level security;
create policy "meetup_attendees: lectura publica" on public.meetup_attendees for select using (true);
create policy "meetup_attendees: cada uno gestiona su apunte" on public.meetup_attendees for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
