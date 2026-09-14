-- ============================================================
-- Pista -- Fase 4: chat en tiempo real
-- Ejecutar una sola vez en el SQL Editor de Supabase, despues de 003_quedadas.sql.
-- ============================================================

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (conversation_id, profile_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

-- Funcion auxiliar (security definer) para evitar recursion en las policies:
-- comprueba si el usuario actual participa en una conversacion.
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and profile_id = auth.uid()
  );
$$;

-- Cuando llega un mensaje, actualiza el updated_at de su conversacion
-- (asi la lista de chats se puede ordenar por actividad reciente).
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation();

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create policy "conversations: solo participantes leen" on public.conversations for select
  using (public.is_conversation_participant(id));
create policy "conversations: cualquiera autenticado crea" on public.conversations for insert
  with check (auth.uid() is not null);

create policy "conversation_participants: solo participantes leen" on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_id));
create policy "conversation_participants: te anades a ti o a una tuya" on public.conversation_participants for insert
  with check (profile_id = auth.uid() or public.is_conversation_participant(conversation_id));

create policy "messages: solo participantes leen" on public.messages for select
  using (public.is_conversation_participant(conversation_id));
create policy "messages: el remitente escribe en las suyas" on public.messages for insert
  with check (sender_id = auth.uid() and public.is_conversation_participant(conversation_id));

-- Activa Realtime (mensajes en vivo) para la tabla messages.
alter publication supabase_realtime add table public.messages;
