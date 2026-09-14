-- ============================================================
-- Pista -- Fase 5: notificaciones (centro en la app + base para push nativas)
-- Ejecutar una sola vez en el SQL Editor de Supabase, despues de 004_chat.sql.
-- ============================================================

-- Notificaciones que ve el usuario dentro de la app.
-- `data` es JSONB libre (post_id, meetup_id, conversation_id, badge_id...)
-- siguiendo el mismo patron extensible que posts.details.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade not null,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz default now()
);
create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

alter table public.notifications enable row level security;
create policy "notifications: solo el destinatario lee" on public.notifications for select
  using (auth.uid() = recipient_id);
create policy "notifications: el destinatario las marca leidas" on public.notifications for update
  using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
-- No hay policy de insert para clientes: las crean las funciones de abajo (security definer).

-- Tokens de push (Expo push token por dispositivo). Se rellenara cuando la app
-- se instale como app nativa via EAS Build; en la web no se usa.
create table public.push_tokens (
  profile_id uuid references public.profiles(id) on delete cascade,
  token text not null,
  created_at timestamptz default now(),
  primary key (profile_id, token)
);
alter table public.push_tokens enable row level security;
create policy "push_tokens: cada uno gestiona los suyos" on public.push_tokens for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- ---- Funciones que generan notificaciones automaticamente ----

create or replace function public.notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (recipient_id, actor_id, type, data)
  values (new.following_id, new.follower_id, 'follow', '{}'::jsonb);
  return new;
end;
$$;
create trigger follows_notify after insert on public.follows
for each row execute function public.notify_follow();

create or replace function public.notify_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  if v_author is not null and v_author <> new.profile_id then
    insert into public.notifications (recipient_id, actor_id, type, data)
    values (v_author, new.profile_id, 'like', jsonb_build_object('post_id', new.post_id));
  end if;
  return new;
end;
$$;
create trigger likes_notify after insert on public.likes
for each row execute function public.notify_like();

create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  if v_author is not null and v_author <> new.author_id then
    insert into public.notifications (recipient_id, actor_id, type, data)
    values (v_author, new.author_id, 'comment', jsonb_build_object('post_id', new.post_id));
  end if;
  return new;
end;
$$;
create trigger comments_notify after insert on public.comments
for each row execute function public.notify_comment();

create or replace function public.notify_badge()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (recipient_id, actor_id, type, data)
  values (new.profile_id, null, 'badge', jsonb_build_object('badge_id', new.badge_id));
  return new;
end;
$$;
create trigger profile_badges_notify after insert on public.profile_badges
for each row execute function public.notify_badge();

create or replace function public.notify_meetup_join()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_organizer uuid;
begin
  select organizer_id into v_organizer from public.meetups where id = new.meetup_id;
  if v_organizer is not null and v_organizer <> new.profile_id then
    insert into public.notifications (recipient_id, actor_id, type, data)
    values (v_organizer, new.profile_id, 'meetup_join', jsonb_build_object('meetup_id', new.meetup_id));
  end if;
  return new;
end;
$$;
create trigger meetup_attendees_notify after insert on public.meetup_attendees
for each row execute function public.notify_meetup_join();

create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_recipient uuid;
begin
  select profile_id into v_recipient from public.conversation_participants
    where conversation_id = new.conversation_id and profile_id <> new.sender_id
    limit 1;
  if v_recipient is not null then
    insert into public.notifications (recipient_id, actor_id, type, data)
    values (v_recipient, new.sender_id, 'message', jsonb_build_object('conversation_id', new.conversation_id));
  end if;
  return new;
end;
$$;
create trigger messages_notify after insert on public.messages
for each row execute function public.notify_message();

-- Activa Realtime para que el contador de no-leidas se pueda refrescar en vivo.
alter publication supabase_realtime add table public.notifications;
