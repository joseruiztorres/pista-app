import { supabase } from './supabase';
import { syncGamification } from './gamification';
import { queueCelebrations } from './celebrations';

async function awardBadges(profileId, badgeIds = []) {
  const ids = [...new Set(badgeIds.filter(Boolean))];
  if (!profileId || !ids.length) return [];
  const { data: existingRows } = await supabase.from('profile_badges').select('badge_id').eq('profile_id', profileId).in('badge_id', ids);
  const existing = new Set((existingRows || []).map((row) => row.badge_id));
  const fresh = ids.filter((id) => !existing.has(id));
  if (!fresh.length) return [];
  await supabase.from('profile_badges').upsert(
    fresh.map((badge_id) => ({ profile_id: profileId, badge_id })),
    { onConflict: 'profile_id,badge_id', ignoreDuplicates: true },
  );
  const { data: badges } = await supabase.from('badges').select('id, name, description, icon_key, xp_reward').in('id', fresh);
  await queueCelebrations(profileId, (badges || []).map((badge) => ({ type: 'badge', id: badge.id, name: badge.name, description: badge.description, icon: badge.icon_key, xp: badge.xp_reward })));
  return fresh;
}

// Revisa la racha actual y otorga (upsert, sin duplicar) las medallas de
// constancia que ya se hayan alcanzado. Se llama después de cada marcaje
// del reto diario.
export async function checkStreakBadges(profileId) {
  if (!profileId) return;
  const { data: streakVal } = await supabase.rpc('current_streak', { p_profile_id: profileId });
  const streak = streakVal || 0;
  const milestones = [[3, 'streak_3'], [7, 'streak_7'], [30, 'streak_30'], [60, 'streak_60'], [100, 'streak_100']];
  const earned = milestones.filter(([n]) => streak >= n).map(([, id]) => id);
  return awardBadges(profileId, earned);
}

// Otorga la medalla de primera publicación. Se llama tras crear un post.
export async function checkFirstPostBadge(profileId) {
  if (!profileId) return;
  return awardBadges(profileId, ['first_post']);
}

export async function awardBadge(profileId, badgeId) {
  if (!profileId || !badgeId) return;
  return awardBadges(profileId, [badgeId]);
}

// Recalcula los hitos acumulados. Las consultas son deliberadamente simples:
// se ejecutan al guardar una actividad o completar un entrenamiento planificado,
// no durante el desplazamiento por el feed.
export async function checkActivityBadges(profileId) {
  if (!profileId) return;
  const [postsRes, checkinsRes, plansRes, meetupsRes, streakRes] = await Promise.all([
    supabase.from('posts').select('sport_id, details, created_at').eq('author_id', profileId),
    supabase.from('daily_checkins').select('sport_id, check_date').eq('profile_id', profileId),
    supabase.from('training_events').select('id').eq('profile_id', profileId).eq('status', 'completed'),
    supabase.from('meetup_attendees').select('meetup_id').eq('profile_id', profileId),
    supabase.rpc('current_streak', { p_profile_id: profileId }),
  ]);
  const posts = postsRes.data || [];
  const checkins = checkinsRes.data || [];
  const sessionDays = new Set(checkins.map((row) => row.check_date)).size;
  const sports = new Set([...posts.map((row) => row.sport_id), ...checkins.map((row) => row.sport_id)].filter(Boolean));
  const totalDistance = posts.reduce((sum, row) => sum + Number(row.details?.distance_km || row.details?.approach_distance_km || 0), 0);
  const totalMinutes = posts.reduce((sum, row) => sum + Number(row.details?.duration_min || row.details?.workout_duration_min || row.details?.approach_duration_min || 0), 0);
  const totalElevation = posts.reduce((sum, row) => sum + Number(row.details?.elevation_m || 0), 0);
  const totalClimbingVertical = posts.reduce((sum, row) => sum + Number(row.details?.vertical_m || 0), 0);
  const routeCount = posts.filter((row) => Array.isArray(row.details?.route) && row.details.route.length > 1).length;
  const climbingSessions = new Set(checkins.filter((row) => row.sport_id === 'escalada').map((row) => row.check_date)).size;
  const plans = (plansRes.data || []).length;
  const meetups = (meetupsRes.data || []).length;
  const streak = Number(streakRes.data || 0);
  const activeWeeks = {};
  checkins.forEach((row) => {
    const date = new Date(`${row.check_date}T12:00:00`);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    const key = date.toISOString().slice(0, 10);
    if (!activeWeeks[key]) activeWeeks[key] = new Set();
    activeWeeks[key].add(row.check_date);
  });
  const regularWeeks = Object.values(activeWeeks).filter((days) => days.size >= 2).length;
  const earned = [];
  if (posts.length >= 1) earned.push('first_post');
  [[5, 'activities_5'], [10, 'activities_10'], [25, 'activities_25'], [50, 'activities_50'], [100, 'activities_100'], [250, 'activities_250']].forEach(([n, id]) => { if (sessionDays >= n) earned.push(id); });
  [[5, 'distance_5'], [10, 'distance_10'], [25, 'distance_25'], [50, 'distance_50'], [100, 'distance_100'], [250, 'distance_250'], [500, 'distance_500'], [1000, 'distance_1000']].forEach(([n, id]) => { if (totalDistance >= n) earned.push(id); });
  [[300, 'active_300'], [600, 'active_600'], [1500, 'active_1500'], [3000, 'active_3000'], [6000, 'active_6000']].forEach(([n, id]) => { if (totalMinutes >= n) earned.push(id); });
  [[3, 'variety_3'], [5, 'variety_5'], [10, 'variety_10']].forEach(([n, id]) => { if (sports.size >= n) earned.push(id); });
  [[1000, 'elevation_1000'], [5000, 'elevation_5000'], [10000, 'elevation_10000']].forEach(([n, id]) => { if (totalElevation >= n) earned.push(id); });
  [[3, 'climb_start'], [10, 'climb_10'], [25, 'climb_25']].forEach(([n, id]) => { if (climbingSessions >= n) earned.push(id); });
  [[3, 'planner_3'], [10, 'planner_10'], [25, 'planner_25']].forEach(([n, id]) => { if (plans >= n) earned.push(id); });
  [[5, 'route_5'], [25, 'route_25'], [50, 'route_50']].forEach(([n, id]) => { if (routeCount >= n) earned.push(id); });
  [[3, 'meetup_3'], [10, 'meetup_10']].forEach(([n, id]) => { if (meetups >= n) earned.push(id); });
  [[3, 'streak_3'], [7, 'streak_7'], [30, 'streak_30'], [60, 'streak_60'], [100, 'streak_100']].forEach(([n, id]) => { if (streak >= n) earned.push(id); });
  if (routeCount >= 1) earned.push('first_route');
  if (plans >= 1) earned.push('first_plan');
  if (meetups >= 1) earned.push('first_meetup');
  if (totalClimbingVertical >= 1000) earned.push('climb_vertical_1000');
  if (regularWeeks >= 4) earned.push('weeks_4');
  await awardBadges(profileId, earned);
  return syncGamification(profileId);
}
