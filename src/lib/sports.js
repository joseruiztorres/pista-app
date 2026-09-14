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
};

export function iconFor(sportId) {
  return SPORT_ICON[sportId] || 'flash-outline';
}
