import { dateKey, progressPercent } from './engagement';

export function motivationFor(progress, personal = []) {
  const stats = progress?.stats || {};
  const open = personal.filter((item) => !item.completed_at);
  const completed = personal.length - open.length;
  const day = new Date().getDay();
  if (personal.length && completed === personal.length) return { icon: 'sparkles', title: 'Semana completada', text: 'Has terminado tus tres retos personales. Disfruta el progreso.', tone: 'success', target: 'WeeklyRecap' };
  if (day === 0 && open.length) return { icon: 'hourglass-outline', title: 'Último día de la semana', text: `Te quedan ${open.length} retos. Una actividad hoy todavía puede cerrarlos.`, tone: 'urgent', target: 'Challenges' };
  if ((stats.streak || 0) > 0) return { icon: 'flame-outline', title: `Protege tu racha de ${stats.streak} días`, text: 'Registra una actividad hoy para mantener la cadena.', tone: 'warm', target: 'Challenges' };
  if (completed > 0) return { icon: 'trophy-outline', title: `${completed} de ${personal.length} retos completados`, text: 'Ya has avanzado esta semana. El siguiente está más cerca de lo que parece.', tone: 'success', target: 'Challenges' };
  const next = open[0];
  if (next) return { icon: next.icon_key || 'flag-outline', title: next.title, text: next.description, tone: 'normal', target: 'Challenges' };
  return { icon: 'walk-outline', title: 'Tu próximo paso cuenta', text: 'Registra una actividad y Pista ajustará tus próximos objetivos.', tone: 'normal', target: 'Registrar' };
}

export function challengeProgress(challenge, posts, checkins, activityMetric) {
  const value = activityMetric(challenge.metric, posts, checkins, { since: challenge.starts_at, sportId: challenge.sport_id });
  return progressPercent(value, challenge.target);
}

export function reminderKey(profileId) {
  return `@pista:smart-reminder:${profileId}:${dateKey(new Date())}`;
}
