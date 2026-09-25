-- Cierra los dos fallos críticos de la auditoría del 25/09/2026.
--
-- 1) "posts: lectura pública" se creó sin querer en 016_desactivar_cuenta.sql
--    (el DROP de esa migración apuntaba a un nombre de política que ya no
--    existía desde 007, así que la nueva política se sumó en vez de
--    sustituir a la correcta). Al combinarse por OR con la política de
--    010_video_actividad_privacidad.sql, dejaba leer por la API cualquier
--    publicación de una cuenta activa sin mirar audiencia, perfiles privados
--    ni bloqueos. Se retira esa política extra y se añade la comprobación de
--    cuenta desactivada a la política que sí evalúa todo lo demás.
--
-- 2) El usuario puede editar su perfil libremente (eso se queda igual), pero
--    tenía permiso de UPDATE/INSERT también sobre profiles.is_admin y no
--    había nada que impidiera ponerse a sí mismo como administrador. Se
--    añade un trigger que ignora cualquier intento de cambiar is_admin desde
--    la API (rol anon/authenticated); solo se puede seguir cambiando a mano
--    desde el editor SQL de Supabase, como ya se hizo para dar el admin
--    inicial en 008_admin_reportes.sql.

-- ---- 1) Posts: una sola política de lectura, con todo junto ----
drop policy if exists "posts: lectura pública" on public.posts;

drop policy if exists "posts: lectura por audiencia bloqueos y perfil" on public.posts;
create policy "posts: lectura por audiencia bloqueos y perfil" on public.posts for select
  using (
    posts.author_id = auth.uid()
    or (
      not exists (
        select 1 from public.profiles p
        where p.id = posts.author_id and p.deactivated_at is not null
      )
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = posts.author_id)
           or (b.blocked_id = auth.uid() and b.blocker_id = posts.author_id)
      )
      and (
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

-- ---- 2) Nadie puede ponerse a sí mismo (ni a otro) de administrador por la API ----
create or replace function public.protect_is_admin()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    elsif tg_op = 'UPDATE' then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_is_admin on public.profiles;
create trigger profiles_protect_is_admin
before insert or update on public.profiles
for each row execute function public.protect_is_admin();
