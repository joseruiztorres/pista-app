-- ============================================================
-- Pista -- Fase 13: historias de 24 horas y destacados del perfil.
-- Ejecutar una sola vez despues de 008_admin_reportes.sql.
-- ============================================================

-- Datos que ayudan a decidir si una quedada encaja antes de apuntarse.
alter table public.meetups add column if not exists level text not null default 'todos'
  check (level in ('todos', 'principiante', 'intermedio', 'avanzado'));
alter table public.meetups add column if not exists capacity int
  check (capacity is null or capacity > 0);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  media_url text not null,
  caption text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists stories_active_idx on public.stories(expires_at desc);
create index if not exists stories_author_idx on public.stories(author_id, created_at desc);

create table if not exists public.story_views (
  story_id uuid references public.stories(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, profile_id)
);

create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  title text not null check (char_length(title) between 1 and 30),
  cover_url text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists highlights_owner_idx on public.highlights(owner_id, position, created_at);

create table if not exists public.highlight_stories (
  highlight_id uuid references public.highlights(id) on delete cascade,
  story_id uuid references public.stories(id) on delete cascade,
  position int not null default 0,
  added_at timestamptz not null default now(),
  primary key (highlight_id, story_id)
);

-- Centraliza las reglas de privacidad y bloqueo para historias y destacados.
create or replace function public.can_view_profile_content(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_profile_id = auth.uid()
    or (
      not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p_profile_id)
           or (b.blocked_id = auth.uid() and b.blocker_id = p_profile_id)
      )
      and (
        not exists (select 1 from public.profiles p where p.id = p_profile_id and p.is_private)
        or exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid()
            and f.following_id = p_profile_id
            and f.pending = false
        )
      )
    );
$$;

alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.highlights enable row level security;
alter table public.highlight_stories enable row level security;

create policy "stories: visibles durante 24h o en destacados" on public.stories for select
  using (
    public.can_view_profile_content(author_id)
    and (
      expires_at > now()
      or author_id = auth.uid()
      or exists (
        select 1 from public.highlight_stories hs where hs.story_id = stories.id
      )
    )
  );
create policy "stories: el autor crea" on public.stories for insert
  with check (auth.uid() = author_id);
create policy "stories: el autor edita" on public.stories for update
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "stories: el autor borra" on public.stories for delete
  using (auth.uid() = author_id);

create policy "story_views: la persona registra su vista" on public.story_views for insert
  with check (auth.uid() = profile_id);
create policy "story_views: lector y autor ven las vistas" on public.story_views for select
  using (
    auth.uid() = profile_id
    or exists (
      select 1 from public.stories s where s.id = story_views.story_id and s.author_id = auth.uid()
    )
  );

create policy "highlights: visibles segun privacidad" on public.highlights for select
  using (public.can_view_profile_content(owner_id));
create policy "highlights: el dueño crea" on public.highlights for insert
  with check (auth.uid() = owner_id);
create policy "highlights: el dueño edita" on public.highlights for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "highlights: el dueño borra" on public.highlights for delete
  using (auth.uid() = owner_id);

create policy "highlight_stories: visibles con el destacado" on public.highlight_stories for select
  using (
    exists (
      select 1 from public.highlights h
      where h.id = highlight_stories.highlight_id
        and public.can_view_profile_content(h.owner_id)
    )
  );
create policy "highlight_stories: el dueño añade" on public.highlight_stories for insert
  with check (
    exists (
      select 1 from public.highlights h
      where h.id = highlight_stories.highlight_id and h.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.stories s
      where s.id = highlight_stories.story_id and s.author_id = auth.uid()
    )
  );
create policy "highlight_stories: el dueño quita" on public.highlight_stories for delete
  using (
    exists (
      select 1 from public.highlights h
      where h.id = highlight_stories.highlight_id and h.owner_id = auth.uid()
    )
  );
