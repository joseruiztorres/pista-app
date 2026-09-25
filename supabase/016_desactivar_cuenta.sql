-- Añade la opción de desactivar la cuenta temporalmente (reversible), aparte
-- de la eliminación permanente ya creada en 015_eliminar_cuenta.sql.
--
-- Al desactivarse: el perfil y las publicaciones del usuario dejan de verse
-- para el resto (pero no se borra nada). Al volver a iniciar sesión con su
-- email y contraseña, la propia app limpia `deactivated_at` y todo vuelve a
-- estar como antes (ver src/context/AuthProvider.js).

alter table public.profiles add column if not exists deactivated_at timestamptz;

-- El propio usuario siempre puede ver y editar su perfil aunque esté
-- desactivado (para poder reactivarlo); el resto solo ve perfiles activos.
drop policy if exists "profiles: lectura pública" on public.profiles;
create policy "profiles: lectura pública" on public.profiles
  for select using (deactivated_at is null or auth.uid() = id);

-- Igual para las publicaciones: el autor siempre ve las suyas; el resto no ve
-- las de una cuenta desactivada.
drop policy if exists "posts: lectura pública" on public.posts;
create policy "posts: lectura pública" on public.posts
  for select using (
    auth.uid() = author_id
    or not exists (
      select 1 from public.profiles p
      where p.id = posts.author_id and p.deactivated_at is not null
    )
  );

-- Función que el usuario autenticado llama para desactivar SU PROPIA cuenta
-- (auth.uid() asegura que nadie pueda desactivar la de otra persona).
create or replace function public.deactivate_own_account()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set deactivated_at = now() where id = auth.uid();
$$;

revoke all on function public.deactivate_own_account() from public;
grant execute on function public.deactivate_own_account() to authenticated;
