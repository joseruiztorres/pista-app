-- ============================================================
-- Pista -- Fase 12: panel de reportes solo para el dueño de la app
-- Ejecutar una sola vez en el SQL Editor de Supabase, despues de 007_moderacion_privacidad.sql.
-- ============================================================

-- Marca de administrador. Solo se activa a mano para la cuenta del dueño.
alter table public.profiles add column if not exists is_admin boolean not null default false;

update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'joseruiztorres1@gmail.com');

-- Estado de gestión de cada reporte.
alter table public.reports add column if not exists resolved boolean not null default false;
alter table public.reports add column if not exists resolved_at timestamptz;

-- El admin puede ver y resolver todos los reportes (además de que cada uno
-- ya podía ver los suyos propios, policy que se queda igual).
create policy "reports: el admin ve todos" on public.reports for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "reports: el admin los resuelve" on public.reports for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "reports: el admin los borra" on public.reports for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- El admin puede borrar directamente el contenido reportado (publicaciones
-- o comentarios de cualquiera), además del propio autor que ya podía.
create policy "posts: el admin borra cualquiera" on public.posts for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "comments: el admin borra cualquiera" on public.comments for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
