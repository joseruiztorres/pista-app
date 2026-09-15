import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

const TILE_SIZE = 256;
const MAP_HEIGHT = 220;
const ZOOM = 15;

function locationTarget({ query, latitude, longitude }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoordinates = latitude !== '' && longitude !== ''
    && latitude != null && longitude != null
    && Number.isFinite(lat) && Number.isFinite(lng);

  if (hasCoordinates) return `${lat},${lng}`;
  return query?.trim() || '';
}

export function googleMapsUrl(location) {
  const target = locationTarget(location);
  return target
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`
    : null;
}

export default function GoogleMapCard({ query, latitude, longitude, label = 'Ubicación' }) {
  const target = locationTarget({ query, latitude, longitude });
  if (!target) return null;

  const mapsUrl = googleMapsUrl({ query, latitude, longitude });

  return (
    <MapCardContent
      mapsUrl={mapsUrl}
      latitude={latitude}
      longitude={longitude}
      label={label}
    />
  );
}

function validCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -85 && lat <= 85 && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null;
}

function MapCardContent({ mapsUrl, latitude, longitude, label }) {
  const coordinates = validCoordinates(latitude, longitude);
  const [mapWidth, setMapWidth] = useState(360);

  const tiles = useMemo(() => coordinates ? mapTiles(coordinates.lat, coordinates.lng, mapWidth) : [], [coordinates, mapWidth]);

  function openGoogleMaps() {
    if (mapsUrl) Linking.openURL(mapsUrl);
  }

  return (
    <View style={styles.card}>
      {coordinates ? (
        <View style={styles.map} onLayout={(event) => setMapWidth(event.nativeEvent.layout.width)}>
          {tiles.map((tile) => (
            <Image
              key={`${tile.x}-${tile.y}`}
              source={{ uri: `https://tile.openstreetmap.org/${ZOOM}/${tile.x}/${tile.y}.png` }}
              style={[styles.tile, { left: tile.left, top: tile.top }]}
            />
          ))}
          <View pointerEvents="none" style={styles.markerShadow} />
          <View pointerEvents="none" style={styles.marker}>
            <Ionicons name="location" size={34} color={colors.clay} />
          </View>
          <Pressable style={styles.attribution} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>
            <Text style={styles.attributionText}>© OpenStreetMap</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.emptyPreview}>
          <Ionicons name="map-outline" size={36} color={colors.accent} />
          <Text style={styles.emptyTitle}>Abrir ubicación</Text>
          <Text style={styles.emptyText} numberOfLines={2}>{label}</Text>
        </View>
      )}

      <Pressable style={styles.mapsButton} onPress={openGoogleMaps}>
        <Ionicons name="navigate-circle-outline" size={19} color={colors.bg} />
        <Text style={styles.mapsButtonText}>Abrir en Google Maps</Text>
        <Ionicons name="open-outline" size={15} color={colors.bg} />
      </Pressable>
    </View>
  );
}

function mapTiles(lat, lng, width) {
  const scale = 2 ** ZOOM;
  const worldX = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const worldY = (1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2 * scale;
  const centerX = Math.floor(worldX);
  const centerY = Math.floor(worldY);
  const fractionX = worldX - centerX;
  const fractionY = worldY - centerY;
  const tiles = [];

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const x = (centerX + dx + scale) % scale;
      const y = Math.max(0, Math.min(scale - 1, centerY + dy));
      tiles.push({
        x,
        y,
        left: width / 2 + (dx - fractionX) * TILE_SIZE,
        top: MAP_HEIGHT / 2 + (dy - fractionY) * TILE_SIZE,
      });
    }
  }
  return tiles;
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  map: { height: MAP_HEIGHT, overflow: 'hidden', backgroundColor: colors.surface2 },
  tile: { position: 'absolute', width: TILE_SIZE, height: TILE_SIZE },
  marker: {
    position: 'absolute', left: '50%', top: '50%', marginLeft: -17, marginTop: -32,
  },
  markerShadow: {
    position: 'absolute', left: '50%', top: '50%', width: 18, height: 7,
    marginLeft: -9, marginTop: -2, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.28)',
  },
  attribution: {
    position: 'absolute', right: 5, bottom: 5, paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.9)',
  },
  attributionText: { color: '#25302A', fontSize: 9, fontWeight: '600' },
  emptyPreview: {
    minHeight: MAP_HEIGHT,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface2,
  },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  emptyText: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
  mapsButton: {
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.accent,
  },
  mapsButtonText: { color: colors.bg, fontSize: 13, fontWeight: '800' },
});
