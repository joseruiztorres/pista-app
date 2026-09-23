export function startOfWeek(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value;
}

export function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function formatMetric(metric, value) {
  if (metric === 'distance_km') return `${Number(value).toFixed(value >= 10 ? 0 : 1)} km`;
  if (metric === 'minutes') return `${Math.round(value)} min`;
  if (metric === 'sports') return `${Math.round(value)} deportes`;
  return `${Math.round(value)} sesiones`;
}

export function metricLabel(metric) {
  return { sessions: 'Entrenamientos', distance_km: 'Kilómetros', minutes: 'Minutos', sports: 'Deportes' }[metric] || metric;
}

export function activityMetric(metric, posts = [], checkins = [], options = {}) {
  const since = options.since ? new Date(options.since) : null;
  const sportId = options.sportId || null;
  const filteredPosts = posts.filter((row) => {
    if (sportId && row.sport_id !== sportId) return false;
    return !since || new Date(row.created_at) >= since;
  });
  const filteredCheckins = checkins.filter((row) => {
    if (sportId && row.sport_id !== sportId) return false;
    return !since || new Date(`${row.check_date}T23:59:59`) >= since;
  });
  if (metric === 'sessions') return new Set(filteredCheckins.map((row) => row.check_date)).size;
  if (metric === 'distance_km') return filteredPosts.reduce((sum, row) => sum + Number(row.details?.distance_km || 0), 0);
  if (metric === 'minutes') return filteredPosts.reduce((sum, row) => sum + Number(row.details?.duration_min || row.details?.workout_duration_min || 0), 0);
  if (metric === 'sports') return new Set([...filteredPosts.map((row) => row.sport_id), ...filteredCheckins.map((row) => row.sport_id)].filter(Boolean)).size;
  return 0;
}

export function progressPercent(value, target) {
  return Math.min(100, Math.max(0, Math.round((Number(value || 0) / Number(target || 1)) * 100)));
}
