// Mapa local de icono por medalla (Ionicons).
// Para añadir una medalla nueva:
//   1) insertar la fila en la tabla `badges` de Supabase (id, name, description, icon_key)
//   2) añadir aquí esa misma `id` -> nombre de icono de Ionicons
export const BADGE_ICON = {
  streak_3: 'flame-outline',
  streak_7: 'flame',
  streak_30: 'trophy-outline',
  first_post: 'rocket-outline',
  activities_5: 'flash-outline',
  activities_25: 'fitness-outline',
  distance_10: 'map-outline',
  variety_3: 'apps-outline',
  climb_start: 'trending-up-outline',
  planner_3: 'calendar-outline',
  week_3: 'calendar-number-outline',
  active_300: 'time-outline',
};

export function iconForBadge(badgeId) {
  return BADGE_ICON[badgeId] || 'ribbon-outline';
}
