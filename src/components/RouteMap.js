import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

const TILE_SIZE = 256;

function toWorld(lat, lng, zoom) {
  const size = TILE_SIZE * (2 ** zoom);
  const safeLat = Math.max(-85, Math.min(85, lat));
  const rad = safeLat * Math.PI / 180;
  return {
    x: ((lng + 180) / 360) * size,
    y: (1 - Math.log(Math.tan(rad) + (1 / Math.cos(rad))) / Math.PI) / 2 * size,
  };
}

function routeBounds(route) {
  return route.reduce((bounds, point) => ({
    minLat: Math.min(bounds.minLat, Number(point[0])),
    maxLat: Math.max(bounds.maxLat, Number(point[0])),
    minLng: Math.min(bounds.minLng, Number(point[1])),
    maxLng: Math.max(bounds.maxLng, Number(point[1])),
  }), { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 });
}

function fitMap(route, width, height) {
  const bounds = routeBounds(route);
  const center = { lat: (bounds.minLat + bounds.maxLat) / 2, lng: (bounds.minLng + bounds.maxLng) / 2 };
  let zoom = 18;
  for (; zoom > 2; zoom -= 1) {
    const a = toWorld(bounds.maxLat, bounds.minLng, zoom);
    const b = toWorld(bounds.minLat, bounds.maxLng, zoom);
    if (Math.abs(b.x - a.x) <= width - 54 && Math.abs(b.y - a.y) <= height - 54) break;
  }
  return { center, zoom };
}

function buildTiles(center, zoom, width, height) {
  const scale = 2 ** zoom;
  const world = toWorld(center.lat, center.lng, zoom);
  const centerTileX = Math.floor(world.x / TILE_SIZE);
  const centerTileY = Math.floor(world.y / TILE_SIZE);
  const fractionX = world.x / TILE_SIZE - centerTileX;
  const fractionY = world.y / TILE_SIZE - centerTileY;
  const radiusX = Math.ceil(width / TILE_SIZE / 2) + 1;
  const radiusY = Math.ceil(height / TILE_SIZE / 2) + 1;
  const tiles = [];
  for (let dy = -radiusY; dy <= radiusY; dy += 1) {
    for (let dx = -radiusX; dx <= radiusX; dx += 1) {
      const rawX = centerTileX + dx;
      const rawY = centerTileY + dy;
      if (rawY < 0 || rawY >= scale) continue;
      tiles.push({
        x: ((rawX % scale) + scale) % scale,
        y: rawY,
        left: width / 2 + (dx - fractionX) * TILE_SIZE,
        top: height / 2 + (dy - fractionY) * TILE_SIZE,
      });
    }
  }
  return tiles;
}

export default function RouteMap({ route, comparisonRoute, height = 280, onPressAttribution }) {
  const [width, setWidth] = useState(360);
  const validRoute = (route || []).filter((point) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));
  const validComparison = (comparisonRoute || []).filter((point) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));
  const allPoints = validComparison.length >= 2 ? [...validRoute, ...validComparison] : validRoute;

  const map = useMemo(() => {
    if (allPoints.length < 2) return null;
    const fit = fitMap(allPoints, width, height);
    const centerWorld = toWorld(fit.center.lat, fit.center.lng, fit.zoom);
    const project = (point) => {
      const world = toWorld(Number(point[0]), Number(point[1]), fit.zoom);
      return [width / 2 + world.x - centerWorld.x, height / 2 + world.y - centerWorld.y];
    };
    return {
      ...fit,
      tiles: buildTiles(fit.center, fit.zoom, width, height),
      routePoints: validRoute.map(project),
      comparisonPoints: validComparison.map(project),
    };
  }, [height, width, route, comparisonRoute]);

  if (!map) return null;
  const routePolyline = map.routePoints.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const comparisonPolyline = map.comparisonPoints.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const start = map.routePoints[0];
  const end = map.routePoints[map.routePoints.length - 1];

  return (
    <View style={[styles.map, { height }]} onLayout={(event) => setWidth(Math.max(280, event.nativeEvent.layout.width))}>
      {map.tiles.map((tile) => (
        <Image key={`${map.zoom}-${tile.x}-${tile.y}`} source={{ uri: `https://tile.openstreetmap.org/${map.zoom}/${tile.x}/${tile.y}.png` }} style={[styles.tile, { left: tile.left, top: tile.top }]} />
      ))}
      <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFillObject}>
        {comparisonPolyline && <Polyline points={comparisonPolyline} fill="none" stroke={colors.text} strokeOpacity={0.7} strokeWidth={5} strokeDasharray="8 7" strokeLinecap="round" strokeLinejoin="round" />}
        <Polyline points={routePolyline} fill="none" stroke={colors.accentStrong} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={start[0]} cy={start[1]} r={7} fill={colors.accentStrong} stroke={colors.bg} strokeWidth={3} />
        <Circle cx={end[0]} cy={end[1]} r={7} fill={colors.amber} stroke={colors.bg} strokeWidth={3} />
      </Svg>
      <View pointerEvents="none" style={styles.legend}>
        <Ionicons name="lock-closed-outline" size={13} color={colors.text} />
        <Text style={styles.legendText}>Recorrido fijado</Text>
      </View>
      <Pressable style={styles.attribution} onPress={onPressAttribution} disabled={!onPressAttribution}>
        <Text style={styles.attributionText}>© OpenStreetMap</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { position: 'relative', overflow: 'hidden', borderRadius: 18, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  tile: { position: 'absolute', width: TILE_SIZE, height: TILE_SIZE },
  legend: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: 'rgba(15,23,18,0.86)' },
  legendText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  attribution: { position: 'absolute', right: 5, bottom: 5, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.9)' },
  attributionText: { color: '#25302A', fontSize: 9, fontWeight: '600' },
});
