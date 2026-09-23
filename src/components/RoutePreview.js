import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { colors } from '../lib/theme';

// Dibuja la silueta de una ruta a partir de details.route (array de [lat,lng]).
// Es una previsualización ligera con react-native-svg: funciona en Expo Go sin
// configuración nativa. El mapa real (Google/Apple Maps interactivo) es trabajo
// de la Fase 3, cuando se añadan las quedadas con ubicación real.
export default function RoutePreview({ route, comparisonRoute, width = 280, height = 90, label = 'recorrido registrado con GPS' }) {
  if (!route || route.length < 2) return null;

  const allPoints = comparisonRoute?.length >= 2 ? [...route, ...comparisonRoute] : route;
  const lats = allPoints.map((p) => p[0]);
  const lngs = allPoints.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const pad = 10;

  const project = ([lat, lng]) => {
    const x = maxLng === minLng ? width / 2 : pad + ((lng - minLng) / (maxLng - minLng)) * (width - pad * 2);
    const y = maxLat === minLat ? height / 2 : height - pad - ((lat - minLat) / (maxLat - minLat)) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  const points = route
    .map(([lat, lng]) => {
      const x = maxLng === minLng ? width / 2 : pad + ((lng - minLng) / (maxLng - minLng)) * (width - pad * 2);
      const y = maxLat === minLat ? height / 2 : height - pad - ((lat - minLat) / (maxLat - minLat)) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const comparisonPoints = comparisonRoute?.length >= 2 ? comparisonRoute.map(project).join(' ') : null;

  const [firstX, firstY] = points.split(' ')[0].split(',').map(Number);
  const [lastX, lastY] = points.split(' ').slice(-1)[0].split(',').map(Number);

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {comparisonPoints && (
          <Polyline points={comparisonPoints} fill="none" stroke={colors.textDim} strokeWidth={3}
            strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        <Polyline points={points} fill="none" stroke={colors.accentStrong} strokeWidth={3}
          strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={firstX} cy={firstY} r={4} fill={colors.accentStrong} />
        <Circle cx={lastX} cy={lastY} r={4} fill={colors.amber} />
      </Svg>
      <Text style={styles.hint}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface2, borderRadius: 14, padding: 10, gap: 4 },
  hint: { color: colors.textDim, fontSize: 10 },
});
