import { supabase } from './supabase';
import { activityMetric, dateKey, startOfWeek } from './engagement';

export const LEVELS = [
  { level: 1, name: 'En marcha', min: 0 },
  { level: 2, name: 'Activo', min: 150 },
  { level: 3, name: 'Persistente', min: 350 },
  { level: 4, name: 'Constante', min: 650 },
  { level: 5, name: 'Avanzado', min: 1100 },
  { level: 6, name: 'Especialista', min: 1700 },
  { level: 7, name: 'Experto', min: 2500 },
  { level: 8, name: 'Referente', min: 3500 },
  { level: 9, name: 'Maestro', min: 4800 },
  { level: 10, name: 'Élite Pista', min: 6500 },
];

const POWER_SPORTS = new Set(['gym', 'crossfit', 'calistenia', 'halterofilia']);
const ENDURANCE_SPORTS = new Set(['running', 'ciclismo', 'natacion', 'trail', 'senderismo', 'caminar', 'esqui']);

export function levelFromXp(xp = 0) {
  return [...LEVELS].reverse().find((item) => xp >= item.min) || LEVELS[0];
}

export function levelProgress(xp = 0) {
  const current = levelFromXp(xp);
  const next = LEVELS.find((item) => item.level === current.level + 1);
  if (!next) return { current, next: null, percent: 100, remaining: 0 };
  const span = next.min - current.min;
  return { current, next, percent: Math.min(100, Math.round(((xp - current.min) / span) * 100)), remaining: Math.max(0, next.min - xp) };
}

export function athleteIdentity(stats = {}) {
  const counts = stats.sportCounts || {};
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if ((stats.meetups || 0) >= 5) return { id: 'social', label: 'Deportista social', icon: 'people-outline', description: 'Te mueve compartir el deporte y sumar gente al plan.' };
  if ((stats.sports || 0) >= 5) return { id: 'explorador', label: 'Explorador deportivo', icon: 'compass-outline', description: 'Disfrutas probando disciplinas y cambiando de terreno.' };
  if (dominant === 'escalada' || (stats.climbingSessions || 0) >= 5) return { id: 'vertical', label: 'Atleta vertical', icon: 'trending-up-outline', description: 'Tu terreno favorito está hacia arriba.' };
  if (POWER_SPORTS.has(dominant)) return { id: 'potencia', label: 'Atleta de potencia', icon: 'barbell-outline', description: 'Tu progreso se construye con fuerza, control y repetición.' };
  if (ENDURANCE_SPORTS.has(dominant) && ((stats.distance || 0) >= 25 || (stats.minutes || 0) >= 600)) return { id: 'resistencia', label: 'Motor de resistencia', icon: 'speedometer-outline', description: 'Te motivan el recorrido, el tiempo y llegar un poco más lejos.' };
  if ((stats.activeWeeks || 0) >= 4 || (stats.streak || 0) >= 7) return { id: 'constante', label: 'Atleta constante', icon: 'flame-outline', description: 'Tu superpoder es aparecer una semana tras otra.' };
  return { id: 'en_evolucion', label: 'En evolución', icon: 'sparkles-outline', description: 'Cada actividad ayuda a descubrir qué tipo de deportista eres.' };
}

function roundedTarget(value, step, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Math.ceil(value / step) * step));
}

export function adaptiveChallengeRows(profileId, posts = [], checkins = [], stats = {}, date = new Date()) {
  const week = startOfWeek(date);
  const nextWeek = new Date(week);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const recent = new Date(week);
  recent.setDate(recent.getDate() - 28);
  const sessions28 = activityMetric('sessions', posts, checkins, { since: recent });
  const minutes28 = activityMetric('minutes', posts, checkins, { since: recent });
  const distance28 = activityMetric('distance_km', posts, checkins, { since: recent });
  const averageSessions = sessions28 / 4;
  const sessionTarget = Math.min(6, Math.max(2, Math.ceil(averageSessions * 1.12)));
  const rows = [{
    profile_id: profileId,
    template_key: 'ritmo_semanal',
    title: sessions28 === 0 ? 'Volver a moverte' : 'Supera tu ritmo',
    description: sessions28 === 0 ? 'Completa 2 actividades esta semana para volver a arrancar.' : `Tu media reciente es ${averageSessions.toFixed(1)}. Esta semana vamos a por ${sessionTarget}.`,
    icon_key: 'pulse-outline', metric: 'sessions', target: sessionTarget,
    difficulty: sessionTarget >= 5 ? 'dificil' : 'normal', points: sessionTarget >= 5 ? 180 : 110,
  }];
  if (distance28 >= 5) {
    const target = roundedTarget((distance28 / 4) * 1.12, 1, 5, 80);
    rows.push({ profile_id: profileId, template_key: 'distancia_semanal', title: 'Un poco más lejos', description: `Suma ${target} km esta semana, ajustado a tus últimas rutas.`, icon_key: 'map-outline', metric: 'distance_km', target, difficulty: target >= 30 ? 'dificil' : 'normal', points: target >= 30 ? 200 : 120 });
  } else {
    const target = Math.min(4, Math.max(2, Number(stats.sports || 0) + 1));
    rows.push({ profile_id: profileId, template_key: 'variedad_semanal', title: 'Cambia de movimiento', description: `Practica ${target} deportes distintos esta semana.`, icon_key: 'apps-outline', metric: 'sports', target, difficulty: target >= 4 ? 'dificil' : 'normal', points: target >= 4 ? 180 : 110 });
  }
  const minuteTarget = roundedTarget((minutes28 / 4) * 1.1, 30, 60, 420);
  rows.push({ profile_id: profileId, template_key: 'minutos_semanales', title: 'Tiempo de calidad', description: `Acumula ${minuteTarget} minutos de actividad sin subir más de golpe.`, icon_key: 'time-outline', metric: 'minutes', target: minuteTarget, difficulty: minuteTarget >= 240 ? 'dificil' : 'normal', points: minuteTarget >= 240 ? 200 : 120 });
  return rows.map((row) => ({ ...row, week_start: dateKey(week), starts_at: week.toISOString(), expires_at: nextWeek.toISOString() }));
}

function countActiveWeeks(checkins = []) {
  const weeks = {};
  checkins.forEach((row) => {
    const key = dateKey(startOfWeek(new Date(`${row.check_date}T12:00:00`)));
    if (!weeks[key]) weeks[key] = new Set();
    weeks[key].add(row.check_date);
  });
  return Object.values(weeks).filter((days) => days.size >= 2).length;
}

function buildStats(posts, checkins, plans, meetups, streak) {
  const sportCounts = {};
  checkins.forEach((row) => { if (row.sport_id) sportCounts[row.sport_id] = (sportCounts[row.sport_id] || 0) + 1; });
  return {
    sessions: new Set(checkins.map((row) => row.check_date)).size,
    posts: posts.length,
    distance: Number(activityMetric('distance_km', posts, checkins).toFixed(1)),
    minutes: Math.round(activityMetric('minutes', posts, checkins)),
    sports: activityMetric('sports', posts, checkins),
    routes: posts.filter((row) => Array.isArray(row.details?.route) && row.details.route.length > 1).length,
    elevation: Math.round(posts.reduce((sum, row) => sum + Number(row.details?.elevation_m || 0), 0)),
    climbingVertical: Math.round(posts.reduce((sum, row) => sum + Number(row.details?.vertical_m || 0), 0)),
    climbingSessions: new Set(checkins.filter((row) => row.sport_id === 'escalada').map((row) => row.check_date)).size,
    plans: plans.length,
    meetups: meetups.length,
    streak: Number(streak || 0),
    activeWeeks: countActiveWeeks(checkins),
    sportCounts,
  };
}

export async function syncGamification(profileId) {
  if (!profileId) return null;
  const week = dateKey(startOfWeek());
  const [postsRes, checkinsRes, plansRes, meetupsRes, badgesRes, catalogRes, personalRes, streakRes] = await Promise.all([
    supabase.from('posts').select('sport_id, details, created_at').eq('author_id', profileId),
    supabase.from('daily_checkins').select('sport_id, check_date').eq('profile_id', profileId),
    supabase.from('training_events').select('id').eq('profile_id', profileId).eq('status', 'completed'),
    supabase.from('meetup_attendees').select('meetup_id').eq('profile_id', profileId),
    supabase.from('profile_badges').select('badge_id, badges(xp_reward)').eq('profile_id', profileId),
    supabase.from('challenge_members').select('challenge_id, completed_at, challenges(points)').eq('profile_id', profileId),
    supabase.from('personal_challenges').select('*').eq('profile_id', profileId),
    supabase.rpc('current_streak', { p_profile_id: profileId }),
  ]);
  const posts = postsRes.data || [];
  const checkins = checkinsRes.data || [];
  const plans = plansRes.data || [];
  const meetups = meetupsRes.data || [];
  const stats = buildStats(posts, checkins, plans, meetups, streakRes.data || 0);
  let allPersonal = personalRes.data || [];
  let personal = allPersonal.filter((item) => item.week_start === week);
  if (!personal.length) {
    await supabase.from('personal_challenges').upsert(adaptiveChallengeRows(profileId, posts, checkins, stats), { onConflict: 'profile_id,template_key,week_start', ignoreDuplicates: true });
    const { data } = await supabase.from('personal_challenges').select('*').eq('profile_id', profileId).eq('week_start', week).order('created_at');
    personal = data || [];
    allPersonal = [...allPersonal, ...personal];
  }
  const completedNow = personal.filter((challenge) => !challenge.completed_at && activityMetric(challenge.metric, posts, checkins, { since: challenge.starts_at, sportId: challenge.sport_id }) >= Number(challenge.target));
  if (completedNow.length) {
    await Promise.all(completedNow.map((challenge) => supabase.from('personal_challenges').update({ completed_at: new Date().toISOString() }).eq('id', challenge.id).eq('profile_id', profileId)));
    const done = new Set(completedNow.map((item) => item.id));
    personal = personal.map((item) => done.has(item.id) ? { ...item, completed_at: new Date().toISOString() } : item);
    allPersonal = allPersonal.map((item) => done.has(item.id) ? { ...item, completed_at: new Date().toISOString() } : item);
  }
  const badgeXp = (badgesRes.data || []).reduce((sum, row) => sum + Number(row.badges?.xp_reward || 0), 0);
  const catalogXp = (catalogRes.data || []).filter((row) => row.completed_at).reduce((sum, row) => sum + Number(row.challenges?.points || 100), 0);
  const personalXp = allPersonal.filter((row) => row.completed_at).reduce((sum, row) => sum + Number(row.points || 0), 0);
  const xp = Math.round(stats.sessions * 20 + stats.posts * 10 + Math.min(stats.distance * 2, 2000) + Math.min(stats.minutes / 10, 1000) + stats.plans * 15 + stats.meetups * 20 + stats.streak * 5 + badgeXp + catalogXp + personalXp);
  const level = levelFromXp(xp);
  const identity = athleteIdentity(stats);
  const progress = { profile_id: profileId, xp, level: level.level, athlete_type: identity.id, athlete_label: identity.label, stats, calculated_at: new Date().toISOString() };
  await supabase.from('profile_progress').upsert(progress, { onConflict: 'profile_id' });
  return { progress, identity, personal };
}
