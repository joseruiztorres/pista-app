-- Cierra el único hueco de seguridad encontrado: la tabla `sports` no tenía
-- Row Level Security activado. Sin RLS, Supabase no restringe nada por
-- políticas: con la clave pública (anon) cualquiera podría insertar, editar
-- o borrar filas de esta tabla desde fuera de la app. No hay datos
-- personales aquí, pero es la lista de deportes que ve todo el mundo, así
-- que la dejamos de solo lectura pública y sin escritura desde el cliente.
alter table public.sports enable row level security;

create policy "sports: lectura pública" on public.sports
  for select using (true);

-- A propósito no se crea ninguna política de insert/update/delete: sin
-- ellas, ni el cliente anónimo ni un usuario autenticado pueden escribir en
-- esta tabla por la API. Solo se podrá modificar desde el editor SQL de
-- Supabase (o con la service_role, que nunca debe usarse en la app).
