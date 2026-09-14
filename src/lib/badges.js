// Mapa local de icono por medalla (Ionicons).
// Para añadir una medalla nueva:
//   1) insertar la fila en la tabla `badges` de Supabase (id, name, description, icon_key)
//   2) añadir aquí esa misma `id` -> nombre de icono de Ionicons
export const BADGE_ICON = {
  streak_3: 'flame-outline',
  streak_7: 'flame',
  streak_30: 'trophy-outline',
  first_post: 'rocket-outline',
};

export function iconForBadge(badgeId) {
  return BADGE_ICON[badgeId] || 'ribbon-outline';
}
