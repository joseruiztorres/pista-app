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
