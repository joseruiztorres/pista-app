-- Permite que un usuario elimine su propia cuenta y todos sus datos asociados,
-- tal y como se lo prometemos en la Política de Privacidad y los Términos de Uso
-- ("puedes eliminar tu cuenta en cualquier momento desde los ajustes de la App").
--
-- Cómo funciona: `profiles.id` referencia a `auth.users(id) on delete cascade`,
-- y el resto de tablas (posts, rutas, mensajes, retos, etc.) referencian a
-- `profiles.id` también con `on delete cascade`. Por tanto, basta con borrar la
-- fila del usuario en `auth.users` para que Postgres borre en cascada todo lo
-- demás automáticamente.
--
-- El cliente (con la clave pública) no tiene permiso para tocar el esquema
-- `auth` directamente, así que exponemos esta función intermedia:
-- - `security definer` hace que se ejecute con los permisos de quien la creó
--   (el rol postgres/administrador), que sí puede borrar de `auth.users`.
-- - Solo borra `auth.uid()`, es decir, el propio usuario que hace la llamada
--   autenticada: nadie puede borrar la cuenta de otra persona con esta función.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- Solo usuarios autenticados pueden ejecutarla, y solo sobre su propia cuenta.
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
