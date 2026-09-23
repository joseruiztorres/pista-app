// Mapa local de icono por deporte (Ionicons, ya incluido en Expo).
// Para añadir un deporte nuevo:
//   1) insertar la fila en la tabla `sports` de Supabase (id, name, icon_key)
//   2) añadir aquí esa misma `id` -> nombre de icono de Ionicons
// Nada más cambia: el feed, el onboarding y el reto diario leen `sports` de la BD.
export const SPORT_ICON = {
  running: 'walk-outline',
  ciclismo: 'bicycle-outline',
  gym: 'barbell-outline',
  calistenia: 'body-outline',
  natacion: 'water-outline',
  caminar: 'footsteps-outline',
  senderismo: 'trail-sign-outline',
  trail: 'trending-up-outline',
  padel: 'tennisball-outline',
  futbol: 'football-outline',
  tenis: 'tennisball-outline',
  crossfit: 'barbell-outline',
  yoga: 'body-outline',
  escalada: 'trending-up-outline',
  patinaje: 'speedometer-outline',
  esqui: 'snow-outline',
  surf: 'water-outline',
};

export function iconFor(sportId) {
  return SPORT_ICON[sportId] || 'flash-outline';
}
