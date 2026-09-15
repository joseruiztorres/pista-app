import * as Location from 'expo-location';

// La interfaz nunca pide coordenadas. Esta utilidad las obtiene del dispositivo
// y las devuelve solo para guardarlas internamente y abrir el punto en el mapa.
export async function getCurrentCoordinates() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('location-permission-denied');

  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    lat: Number(current.coords.latitude.toFixed(5)),
    lng: Number(current.coords.longitude.toFixed(5)),
  };
}

// Convierte una dirección normal en coordenadas. La búsqueda solo se ejecuta
// cuando la persona pulsa "Ver en el mapa", para evitar peticiones innecesarias.
export async function geocodeLocation(query) {
  const text = query?.trim();
  if (!text || text.length < 3) throw new Error('location-query-too-short');

  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    'accept-language': 'es',
    q: text,
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('location-search-failed');

  const [match] = await response.json();
  if (!match) throw new Error('location-not-found');

  return {
    lat: Number(Number(match.lat).toFixed(5)),
    lng: Number(Number(match.lon).toFixed(5)),
    displayName: match.display_name,
  };
}
