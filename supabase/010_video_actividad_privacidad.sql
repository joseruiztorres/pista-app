-- ============================================================
-- Pista -- Fase 14: video, privacidad granular y nuevos deportes.
-- Ejecutar una sola vez despues de 009_historias_destacados.sql.
-- ============================================================

alter table public.post_media
  add column if not exists media_type text not null default 'image'
  check (media_type in ('image', 'video'));

alter table public.posts
  add column if not exists audience text not null default 'public'
  check (audience in ('public', 'followers', 'private'));

alter table public.stories
  add column if not exists media_type text not null default 'image'
  check (media_type in ('image', 'video'));
alter table public.stories
  add column if not exists audience text not null default 'followers'
  check (audience in ('public', 'followers', 'close_friends'));

create table if not exists public.close_friends (
  owner_id uuid references public.profiles(id) on delete cascade,
  friend_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  check (owner_id <> friend_id)
);

create table if not exists public.story_hidden_users (
  owner_id uuid references public.profiles(id) on delete cascade,
  hidden_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, hidden_id),
  check (owner_id <> hidden_id)
);

create table if not exists public.mutes (
  owner_id uuid references public.profiles(id) on delete cascade,
  muted_id uuid references public.profiles(id) on delete cascade,
  mute_posts boolean not null default false,
  mute_stories boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (owner_id, muted_id),
  check (owner_id <> muted_id)
);

alter table public.close_friends enable row level security;
alter table public.story_hidden_users enable row level security;
alter table public.mutes enable row level security;

create policy "close_friends: el dueño gestiona su lista" on public.close_friends for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "story_hidden: el dueño gestiona su lista" on public.story_hidden_users for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "mutes: el dueño gestiona sus silencios" on public.mutes for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "posts: lectura publica salvo bloqueos y privados" on public.posts;
create policy "posts: lectura por audiencia bloqueos y perfil" on public.posts for select
  using (
    not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = posts.author_id)
         or (b.blocked_id = auth.uid() and b.blocker_id = posts.author_id)
    )
    and (
      posts.author_id = auth.uid()
      or (
        posts.audience <> 'private'
        and (
          posts.audience = 'public'
          or exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid() and f.following_id = posts.author_id and f.pending = false
          )
        )
        and (
          not exists (select 1 from public.profiles p where p.id = posts.author_id and p.is_private)
          or exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid() and f.following_id = posts.author_id and f.pending = false
          )
        )
      )
    )
  );

drop policy if exists "stories: visibles durante 24h o en destacados" on public.stories;
create policy "stories: visibles por audiencia y privacidad" on public.stories for select
  using (
    public.can_view_profile_content(author_id)
    and not exists (
      select 1 from public.story_hidden_users h
      where h.owner_id = stories.author_id and h.hidden_id = auth.uid()
    )
    and (
      author_id = auth.uid()
      or audience = 'public'
      or (
        audience = 'followers'
        and exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid() and f.following_id = stories.author_id and f.pending = false
        )
      )
      or (
        audience = 'close_friends'
        and exists (
          select 1 from public.close_friends c
          where c.owner_id = stories.author_id and c.friend_id = auth.uid()
        )
      )
    )
    and (
      expires_at > now()
      or author_id = auth.uid()
      or exists (select 1 from public.highlight_stories hs where hs.story_id = stories.id)
    )
  );

insert into public.sports (id, name, icon_key) values
  ('caminar', 'Caminar', 'footsteps'),
  ('senderismo', 'Senderismo', 'trail-sign'),
  ('trail', 'Trail running', 'mountain'),
  ('padel', 'Pádel', 'tennisball'),
  ('futbol', 'Fútbol', 'football'),
  ('tenis', 'Tenis', 'tennisball'),
  ('crossfit', 'CrossFit', 'barbell'),
  ('yoga', 'Yoga', 'body'),
  ('escalada', 'Escalada', 'trending-up'),
  ('patinaje', 'Patinaje', 'speedometer'),
  ('esqui', 'Esquí', 'snow'),
  ('surf', 'Surf', 'water')
on conflict (id) do update set name = excluded.name, icon_key = excluded.icon_key;
