-- ============================================================
-- Pista -- Fase 11: moderacion (reportes, bloqueos, editar/borrar
-- publicaciones) y privacidad (perfiles privados con solicitudes
-- de seguimiento).
-- Ejecutar una sola vez en el SQL Editor de Supabase, despues de 006_places.sql.
-- ============================================================

-- Publicaciones: marca de "editado" (el borrado ya lo permite la policy
-- "posts: el autor gestiona los suyos" que ya existia).
alter table public.posts add column if not exists edited_at timestamptz;

-- Perfiles privados: sus publicaciones solo las ve quien ya le sigue.
alter table public.profiles add column if not exists is_private boolean not null default false;

-- Solicitudes de seguimiento: si el destino es privado, el follow entra
-- como pendiente hasta que el dueño lo acepta.
alter table public.follows add column if not exists pending boolean not null default false;

-- Bloqueos entre usuarios.
create table public.blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "blocks: ambas partes ven el bloqueo" on public.blocks for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);
create policy "blocks: el que bloquea crea el bloqueo" on public.blocks for insert
  with check (auth.uid() = blocker_id);
create policy "blocks: el que bloqueo puede desbloquear" on public.blocks for delete
  using (auth.uid() = blocker_id);

-- Reportes de contenido/perfiles.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('post', 'comment', 'profile')),
  target_id uuid not null,
  reason text,
  created_at timestamptz default now()
);
alter table public.reports enable row level security;
create policy "reports: cada uno crea los suyos" on public.reports for insert
  with check (auth.uid() = reporter_id);
create policy "reports: cada uno ve los suyos" on public.reports for select
  using (auth.uid() = reporter_id);

-- ---- Lectura de publicaciones: oculta bloqueos y respeta privacidad ----
drop policy if exists "posts: lectura pública" on public.posts;
create policy "posts: lectura publica salvo bloqueos y privados" on public.posts for select
  using (
    not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = posts.author_id)
         or (b.blocked_id = auth.uid() and b.blocker_id = posts.author_id)
    )
    and (
      posts.author_id = auth.uid()
      or not exists (select 1 from public.profiles p where p.id = posts.author_id and p.is_private)
      or exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid() and f.following_id = posts.author_id and f.pending = false
      )
    )
  );

-- ---- Notificaciones de seguimiento: distinguir solicitud / aceptacion ----
create or replace function public.notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pending then
    insert into public.notifications (recipient_id, actor_id, type, data)
    values (new.following_id, new.follower_id, 'follow_request', '{}'::jsonb);
  else
    insert into public.notifications (recipient_id, actor_id, type, data)
    values (new.following_id, new.follower_id, 'follow', '{}'::jsonb);
  end if;
  return new;
end;
$$;

create or replace function public.notify_follow_accept()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.pending = true and new.pending = false then
    insert into public.notifications (recipient_id, actor_id, type, data)
    values (new.follower_id, new.following_id, 'follow_accept', '{}'::jsonb);
  end if;
  return new;
end;
$$;
drop trigger if exists follows_notify_accept on public.follows;
create trigger follows_notify_accept after update on public.follows
for each row execute function public.notify_follow_accept();
