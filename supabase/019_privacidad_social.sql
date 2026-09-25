-- Segundo bloque de la auditoría del 25/09/2026: privacidad de fotos y
-- comentarios, solicitudes de seguimiento, autoingreso a chats y bloqueos,
-- y las listas de "ocultar historia"/"mejores amigos" que no funcionaban.
-- Todo esto es solo permisos (RLS/funciones): no toca ninguna pantalla de
-- la app, y se comprobó contra el código actual de cada pantalla afectada
-- para no romper los flujos que ya funcionan (FollowRequestsScreen.js,
-- FollowButton.js, chat.js).

-- ============================================================
-- 1) Fotos, vídeos y comentarios heredan la privacidad de la publicación.
--    Antes eran de lectura pública sin condición; ahora solo se ven si el
--    post asociado es visible para ti (la propia policy de "posts" ya
--    aplicada dentro de esta subconsulta se encarga del resto).
-- ============================================================
drop policy if exists "post_media: lectura pública" on public.post_media;
create policy "post_media: visible si se ve la publicación" on public.post_media for select
  using (exists (select 1 from public.posts p where p.id = post_media.post_id));

drop policy if exists "comments: lectura pública" on public.comments;
create policy "comments: visibles si se ve la publicación" on public.comments for select
  using (exists (select 1 from public.posts p where p.id = comments.post_id));

-- ============================================================
-- 2) Solicitudes de seguimiento: aceptar/rechazar no funcionaba (RLS lo
--    bloqueaba en silencio) y el propio seguidor podía forzar pending=false
--    sin aprobación. Ahora: el seguidor solo crea/borra su solicitud (y el
--    "pending" real lo decide un trigger, no lo que mande el cliente); solo
--    el destinatario puede aceptar (pending->false) o rechazar (borrar).
-- ============================================================
drop policy if exists "follows: cada uno gestiona a quién sigue" on public.follows;

create policy "follows: el seguidor crea la solicitud" on public.follows for insert
  with check (follower_id = auth.uid());
create policy "follows: el seguidor deja de seguir" on public.follows for delete
  using (follower_id = auth.uid());
create policy "follows: el destino acepta la solicitud" on public.follows for update
  using (following_id = auth.uid()) with check (following_id = auth.uid());
create policy "follows: el destino rechaza o quita seguidor" on public.follows for delete
  using (following_id = auth.uid());

create or replace function public.set_follow_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(is_private, false) into new.pending
  from public.profiles where id = new.following_id;
  return new;
end;
$$;

drop trigger if exists follows_set_pending on public.follows;
create trigger follows_set_pending
before insert on public.follows
for each row execute function public.set_follow_pending();

-- ============================================================
-- 3) Chats: nadie podía autoincorporarse a una conversación ajena solo por
--    conocer su UUID, y los bloqueos no impedían escribir en un chat ya
--    existente. Ahora solo quien crea la conversación puede añadir a sus
--    participantes (coincide con cómo chat.js crea el primer chat), y no
--    se puede enviar un mensaje si hay un bloqueo de por medio.
-- ============================================================
alter table public.conversations add column if not exists created_by uuid references public.profiles(id) on delete set null;

create or replace function public.set_conversation_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists conversations_set_created_by on public.conversations;
create trigger conversations_set_created_by
before insert on public.conversations
for each row execute function public.set_conversation_created_by();

drop policy if exists "conversation_participants: te anades a ti o a una tuya" on public.conversation_participants;
create policy "conversation_participants: solo quien crea el chat anade participantes" on public.conversation_participants for insert
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );

drop policy if exists "messages: el remitente escribe en las suyas" on public.messages;
create policy "messages: el remitente escribe en las suyas" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and not exists (
      select 1 from public.conversation_participants cp
      join public.blocks b on (
        (b.blocker_id = cp.profile_id and b.blocked_id = auth.uid())
        or (b.blocked_id = cp.profile_id and b.blocker_id = auth.uid())
      )
      where cp.conversation_id = messages.conversation_id and cp.profile_id <> auth.uid()
    )
  );

-- ============================================================
-- 4) "Ocultar esta historia" y "mejores amigos" tenían permisos
--    incompatibles: la policy de historias necesitaba leer la lista de
--    OTRA persona (el autor) para decidir si te la enseña, pero esas listas
--    solo se pueden leer si eres su dueño. El resultado era que ocultar no
--    ocultaba, y mejores amigos no dejaba ver nada a nadie (ni al elegido).
--    Se resuelve con dos funciones de solo-consulta (security definer) que
--    no exponen la lista completa, solo responden sí/no para un usuario.
-- ============================================================
create or replace function public.is_hidden_from_story(p_author_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.story_hidden_users
    where owner_id = p_author_id and hidden_id = p_viewer_id
  );
$$;
revoke all on function public.is_hidden_from_story(uuid, uuid) from public;
grant execute on function public.is_hidden_from_story(uuid, uuid) to authenticated;

create or replace function public.is_close_friend(p_owner_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.close_friends
    where owner_id = p_owner_id and friend_id = p_viewer_id
  );
$$;
revoke all on function public.is_close_friend(uuid, uuid) from public;
grant execute on function public.is_close_friend(uuid, uuid) to authenticated;

drop policy if exists "stories: visibles por audiencia y privacidad" on public.stories;
create policy "stories: visibles por audiencia y privacidad" on public.stories for select
  using (
    public.can_view_profile_content(author_id)
    and not public.is_hidden_from_story(author_id, auth.uid())
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
        and public.is_close_friend(stories.author_id, auth.uid())
      )
    )
    and (
      expires_at > now()
      or author_id = auth.uid()
      or exists (select 1 from public.highlight_stories hs where hs.story_id = stories.id)
    )
  );
