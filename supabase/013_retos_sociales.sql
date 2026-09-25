-- ============================================================
-- Pista -- Fase 17: retos sociales, equipos y liga semanal.
-- Ejecutar despues de 012_gamificacion_adaptativa.sql.
-- ============================================================

create table if not exists public.social_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 60),
  mode text not null check (mode in ('race', 'team')),
  metric text not null check (metric in ('sessions', 'distance_km', 'minutes')),
  target numeric not null check (target > 0),
  reward_xp integer not null default 150 check (reward_xp between 0 and 1000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'completed', 'expired')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.social_challenge_members (
  challenge_id uuid not null references public.social_challenges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined')),
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (challenge_id, profile_id)
);

create table if not exists public.social_challenge_rewards (
  challenge_id uuid not null references public.social_challenges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null check (points >= 0),
  position integer,
  earned_at timestamptz not null default now(),
  primary key (challenge_id, profile_id)
);

create index if not exists social_challenges_creator_idx on public.social_challenges(creator_id, created_at desc);
create index if not exists social_members_profile_idx on public.social_challenge_members(profile_id, created_at desc);
create index if not exists social_rewards_profile_idx on public.social_challenge_rewards(profile_id, earned_at desc);

alter table public.social_challenges enable row level security;
alter table public.social_challenge_members enable row level security;
alter table public.social_challenge_rewards enable row level security;

create or replace function public.is_social_challenge_member(p_challenge_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.social_challenge_members
    where challenge_id = p_challenge_id and profile_id = auth.uid()
  );
$$;

revoke all on function public.is_social_challenge_member(uuid) from public;
grant execute on function public.is_social_challenge_member(uuid) to authenticated;

drop policy if exists "social_challenges: participantes leen" on public.social_challenges;
create policy "social_challenges: participantes leen" on public.social_challenges for select using (
  creator_id = auth.uid() or public.is_social_challenge_member(id)
);

drop policy if exists "social_members: participantes leen" on public.social_challenge_members;
create policy "social_members: participantes leen" on public.social_challenge_members for select using (
  profile_id = auth.uid() or public.is_social_challenge_member(challenge_id)
);

drop policy if exists "social_rewards: cada uno ve los suyos" on public.social_challenge_rewards;
create policy "social_rewards: cada uno ve los suyos" on public.social_challenge_rewards for select
  using (profile_id = auth.uid());

insert into public.badges (id, name, description, icon_key, difficulty, category, xp_reward, sort_order) values
  ('team_first', 'Juntos sumamos', 'Completa tu primer reto en equipo', 'people-circle-outline', 'facil', 'social', 80, 102),
  ('social_challenge_5', 'Rival sano', 'Completa 5 retos con otros deportistas', 'podium-outline', 'dificil', 'social', 180, 103)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  icon_key = excluded.icon_key,
  difficulty = excluded.difficulty,
  category = excluded.category,
  xp_reward = excluded.xp_reward,
  sort_order = excluded.sort_order;

create or replace function public.social_metric_progress(
  p_profile_id uuid,
  p_metric text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare v_value numeric;
begin
  if p_metric = 'sessions' then
    select count(distinct check_date)::numeric into v_value
    from public.daily_checkins
    where profile_id = p_profile_id
      and check_date >= p_starts_at::date
      and check_date <= p_ends_at::date;
  elsif p_metric = 'distance_km' then
    select coalesce(sum(
      coalesce(nullif(details->>'distance_km', '')::numeric, 0) +
      coalesce(nullif(details->>'approach_distance_km', '')::numeric, 0)
    ), 0) into v_value
    from public.posts
    where author_id = p_profile_id and created_at >= p_starts_at and created_at <= p_ends_at;
  elsif p_metric = 'minutes' then
    select coalesce(sum(
      coalesce(nullif(details->>'duration_min', '')::numeric, 0) +
      coalesce(nullif(details->>'workout_duration_min', '')::numeric, 0) +
      coalesce(nullif(details->>'approach_duration_min', '')::numeric, 0)
    ), 0) into v_value
    from public.posts
    where author_id = p_profile_id and created_at >= p_starts_at and created_at <= p_ends_at;
  else
    v_value := 0;
  end if;
  return coalesce(v_value, 0);
end;
$$;

revoke all on function public.social_metric_progress(uuid, text, timestamptz, timestamptz) from public;

create or replace function public.create_social_challenge(
  p_title text,
  p_mode text,
  p_metric text,
  p_target numeric,
  p_duration_days integer,
  p_invitee_ids uuid[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_invitee uuid;
  v_valid_count integer := 0;
  v_title text := trim(p_title);
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesion'; end if;
  if char_length(v_title) < 3 or char_length(v_title) > 60 then raise exception 'Pon un titulo de 3 a 60 caracteres'; end if;
  if p_mode not in ('race', 'team') then raise exception 'Tipo de reto no valido'; end if;
  if p_metric not in ('sessions', 'distance_km', 'minutes') then raise exception 'Metrica no valida'; end if;
  if p_target <= 0 then raise exception 'El objetivo debe ser mayor que cero'; end if;
  if p_duration_days not between 1 and 30 then raise exception 'La duracion debe estar entre 1 y 30 dias'; end if;

  insert into public.social_challenges (creator_id, title, mode, metric, target, reward_xp, ends_at)
  values (auth.uid(), v_title, p_mode, p_metric, p_target, case when p_mode = 'team' then 180 else 150 end, now() + make_interval(days => p_duration_days))
  returning id into v_id;

  insert into public.social_challenge_members (challenge_id, profile_id, status, invited_by, joined_at)
  values (v_id, auth.uid(), 'accepted', auth.uid(), now());

  for v_invitee in select distinct unnest(coalesce(p_invitee_ids, array[]::uuid[])) limit 10 loop
    if v_invitee <> auth.uid() and exists (
      select 1 from public.follows f
      where f.pending = false and (
        (f.follower_id = auth.uid() and f.following_id = v_invitee) or
        (f.following_id = auth.uid() and f.follower_id = v_invitee)
      )
    ) then
      insert into public.social_challenge_members (challenge_id, profile_id, status, invited_by)
      values (v_id, v_invitee, 'invited', auth.uid()) on conflict do nothing;
      insert into public.notifications (recipient_id, actor_id, type, data)
      values (v_invitee, auth.uid(), 'social_challenge_invite', jsonb_build_object('challenge_id', v_id, 'title', v_title));
      v_valid_count := v_valid_count + 1;
    end if;
  end loop;

  if v_valid_count = 0 then raise exception 'Elige al menos un amigo'; end if;
  return v_id;
end;
$$;

create or replace function public.respond_social_challenge(p_challenge_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_creator uuid;
begin
  update public.social_challenge_members
  set status = case when p_accept then 'accepted' else 'declined' end,
      joined_at = case when p_accept then now() else null end
  where challenge_id = p_challenge_id and profile_id = auth.uid() and status = 'invited';
  if not found then raise exception 'Invitacion no disponible'; end if;
  if p_accept then
    select creator_id into v_creator from public.social_challenges where id = p_challenge_id;
    if v_creator <> auth.uid() then
      insert into public.notifications (recipient_id, actor_id, type, data)
      values (v_creator, auth.uid(), 'social_challenge_join', jsonb_build_object('challenge_id', p_challenge_id));
    end if;
  end if;
end;
$$;

create or replace function public.social_challenge_progress(p_challenge_id uuid)
returns table (
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  member_status text,
  progress numeric
) language plpgsql stable security definer set search_path = public as $$
declare v_challenge public.social_challenges%rowtype;
begin
  select * into v_challenge from public.social_challenges where id = p_challenge_id;
  if v_challenge.id is null or not exists (
    select 1 from public.social_challenge_members m
    where m.challenge_id = p_challenge_id and m.profile_id = auth.uid()
  ) then raise exception 'Reto no disponible'; end if;

  return query
  select p.id, p.username, p.display_name, p.avatar_url, m.status,
    case when m.status = 'accepted' then public.social_metric_progress(p.id, v_challenge.metric, v_challenge.starts_at, v_challenge.ends_at) else 0 end
  from public.social_challenge_members m
  join public.profiles p on p.id = m.profile_id
  where m.challenge_id = p_challenge_id
  order by m.status = 'accepted' desc, 6 desc, m.created_at;
end;
$$;

create or replace function public.claim_social_challenge(p_challenge_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_challenge public.social_challenges%rowtype;
  v_team_progress numeric := 0;
  v_winner uuid;
  v_completed boolean := false;
  v_rewarded boolean := false;
  v_points integer := 0;
  v_member record;
begin
  select * into v_challenge from public.social_challenges where id = p_challenge_id for update;
  if v_challenge.id is null or not exists (
    select 1 from public.social_challenge_members where challenge_id = p_challenge_id and profile_id = auth.uid()
  ) then raise exception 'Reto no disponible'; end if;

  if v_challenge.status = 'active' then
    if v_challenge.mode = 'team' then
      select coalesce(sum(public.social_metric_progress(m.profile_id, v_challenge.metric, v_challenge.starts_at, v_challenge.ends_at)), 0)
      into v_team_progress from public.social_challenge_members m
      where m.challenge_id = p_challenge_id and m.status = 'accepted';
      v_completed := v_team_progress >= v_challenge.target;
    else
      select m.profile_id into v_winner from public.social_challenge_members m
      where m.challenge_id = p_challenge_id and m.status = 'accepted'
        and public.social_metric_progress(m.profile_id, v_challenge.metric, v_challenge.starts_at, v_challenge.ends_at) >= v_challenge.target
      order by public.social_metric_progress(m.profile_id, v_challenge.metric, v_challenge.starts_at, v_challenge.ends_at) desc
      limit 1;
      v_completed := v_winner is not null;
    end if;

    if v_completed then
      update public.social_challenges set status = 'completed', completed_at = now() where id = p_challenge_id;
      for v_member in select * from public.social_challenge_members where challenge_id = p_challenge_id and status = 'accepted' loop
        v_points := case when v_challenge.mode = 'team' or v_member.profile_id = v_winner then v_challenge.reward_xp else greatest(30, v_challenge.reward_xp / 5) end;
        insert into public.social_challenge_rewards (challenge_id, profile_id, points, position)
        values (p_challenge_id, v_member.profile_id, v_points, case when v_member.profile_id = v_winner then 1 else null end)
        on conflict do nothing;
        insert into public.notifications (recipient_id, actor_id, type, data)
        values (v_member.profile_id, null, 'social_challenge_complete', jsonb_build_object('challenge_id', p_challenge_id, 'title', v_challenge.title, 'points', v_points));
        if v_challenge.mode = 'team' then
          insert into public.profile_badges (profile_id, badge_id) values (v_member.profile_id, 'team_first') on conflict do nothing;
        end if;
        if (select count(*) from public.social_challenge_rewards where profile_id = v_member.profile_id) >= 5 then
          insert into public.profile_badges (profile_id, badge_id) values (v_member.profile_id, 'social_challenge_5') on conflict do nothing;
        end if;
      end loop;
    elsif now() > v_challenge.ends_at then
      update public.social_challenges set status = 'expired' where id = p_challenge_id;
    end if;
  else
    v_completed := v_challenge.status = 'completed';
  end if;

  select r.points into v_points from public.social_challenge_rewards r
  where r.challenge_id = p_challenge_id and r.profile_id = auth.uid();
  if v_points is not null then
    v_rewarded := true;
  else
    v_points := 0;
  end if;
  return jsonb_build_object('completed', v_completed, 'rewarded', v_rewarded, 'points', v_points, 'title', v_challenge.title);
end;
$$;

create or replace function public.weekly_leaderboard()
returns table (
  rank bigint,
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  sessions bigint,
  distance_km numeric,
  minutes numeric,
  score numeric
) language sql stable security definer set search_path = public as $$
  with connected as (
    select auth.uid() as id
    union
    select case when f.follower_id = auth.uid() then f.following_id else f.follower_id end
    from public.follows f
    where f.pending = false and (f.follower_id = auth.uid() or f.following_id = auth.uid())
  ), checkin_stats as (
    select d.profile_id, count(distinct d.check_date)::bigint as sessions
    from public.daily_checkins d join connected c on c.id = d.profile_id
    where d.check_date >= date_trunc('week', now())::date
    group by d.profile_id
  ), post_stats as (
    select p.author_id as profile_id,
      coalesce(sum(coalesce(nullif(p.details->>'distance_km', '')::numeric, 0) + coalesce(nullif(p.details->>'approach_distance_km', '')::numeric, 0)), 0) as distance_km,
      coalesce(sum(coalesce(nullif(p.details->>'duration_min', '')::numeric, 0) + coalesce(nullif(p.details->>'workout_duration_min', '')::numeric, 0) + coalesce(nullif(p.details->>'approach_duration_min', '')::numeric, 0)), 0) as minutes
    from public.posts p join connected c on c.id = p.author_id
    where p.created_at >= date_trunc('week', now())
    group by p.author_id
  ), totals as (
    select p.id, p.username, p.display_name, p.avatar_url,
      coalesce(cs.sessions, 0) as sessions,
      round(coalesce(ps.distance_km, 0), 1) as distance_km,
      round(coalesce(ps.minutes, 0)) as minutes,
      coalesce(cs.sessions, 0) * 100 + coalesce(ps.distance_km, 0) * 4 + coalesce(ps.minutes, 0) / 5 as score
    from connected c join public.profiles p on p.id = c.id
    left join checkin_stats cs on cs.profile_id = p.id
    left join post_stats ps on ps.profile_id = p.id
  )
  select row_number() over (order by totals.score desc, totals.sessions desc, totals.display_name),
    totals.id, totals.username, totals.display_name, totals.avatar_url,
    totals.sessions, totals.distance_km, totals.minutes, round(totals.score)
  from totals
  order by 1;
$$;

grant execute on function public.create_social_challenge(text, text, text, numeric, integer, uuid[]) to authenticated;
grant execute on function public.respond_social_challenge(uuid, boolean) to authenticated;
grant execute on function public.social_challenge_progress(uuid) to authenticated;
grant execute on function public.claim_social_challenge(uuid) to authenticated;
grant execute on function public.weekly_leaderboard() to authenticated;
