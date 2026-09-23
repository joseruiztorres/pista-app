import { supabase } from './supabase';

// Revisa la racha actual y otorga (upsert, sin duplicar) las medallas de
// constancia que ya se hayan alcanzado. Se llama después de cada marcaje
// del reto diario.
export async function checkStreakBadges(profileId) {
  if (!profileId) return;
  const { data: streakVal } = await supabase.rpc('current_streak', { p_profile_id: profileId });
  const streak = streakVal || 0;
  const milestones = [[3, 'streak_3'], [7, 'streak_7'], [30, 'streak_30']];
  const earned = milestones.filter(([n]) => streak >= n).map(([, id]) => id);
  if (earned.length === 0) return;
  await supabase.from('profile_badges')
    .upsert(earned.map((badge_id) => ({ profile_id: profileId, badge_id })), {
      onConflict: 'profile_id,badge_id',
      ignoreDuplicates: true,
    });
}

// Otorga la medalla de primera publicación. Se llama tras crear un post.
export async function checkFirstPostBadge(profileId) {
  if (!profileId) return;
  await supabase.from('profile_badges')
    .upsert({ profile_id: profileId, badge_id: 'first_post' }, {
      onConflict: 'profile_id,badge_id',
      ignoreDuplicates: true,
    });
}

export async function awardBadge(profileId, badgeId) {
  if (!profileId || !badgeId) return;
  await supabase.from('profile_badges')
    .upsert({ profile_id: profileId, badge_id: badgeId }, {
      onConflict: 'profile_id,badge_id',
      ignoreDuplicates: true,
    });
}

// Recalcula los hitos acumulados. Las consultas son deliberadamente simples:
// se ejecutan al guardar una actividad o completar un entrenamiento planificado,
// no durante el desplazamiento por el feed.
export async function checkActivityBadges(profileId) {
  if (!profileId) return;
  const [postsRes, checkinsRes, plansRes] = await Promise.all([
    supabase.from('posts').select('sport_id, details').eq('author_id', profileId),
    supabase.from('daily_checkins').select('sport_id, check_date').eq('profile_id', profileId),
    supabase.from('training_events').select('id').eq('profile_id', profileId).eq('status', 'completed'),
  ]);
  const posts = postsRes.data || [];
  const checkins = checkinsRes.data || [];
  const sessionDays = new Set(checkins.map((row) => row.check_date)).size;
  const sports = new Set([...posts.map((row) => row.sport_id), ...checkins.map((row) => row.sport_id)].filter(Boolean));
  const totalDistance = posts.reduce((sum, row) => sum + Number(row.details?.distance_km || 0), 0);
  const climbingSessions = new Set(checkins.filter((row) => row.sport_id === 'escalada').map((row) => row.check_date)).size;
  const earned = [];
  if (sessionDays >= 5) earned.push('activities_5');
  if (sessionDays >= 25) earned.push('activities_25');
  if (totalDistance >= 10) earned.push('distance_10');
  if (sports.size >= 3) earned.push('variety_3');
  if (climbingSessions >= 3) earned.push('climb_start');
  if ((plansRes.data || []).length >= 3) earned.push('planner_3');
  if (earned.length) {
    await supabase.from('profile_badges').upsert(
      earned.map((badge_id) => ({ profile_id: profileId, badge_id })),
      { onConflict: 'profile_id,badge_id', ignoreDuplicates: true },
    );
  }
}
