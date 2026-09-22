import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Image, PanResponder, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

const TILE_SIZE = 256;
const MAP_HEIGHT = 260;
const DEFAULT_ZOOM = 16;
const MIN_ZOOM = 13;
const MAX_ZOOM = 18;

function hasCoordinateValues(latitude, longitude) {
  return latitude !== '' && longitude !== '' && latitude != null && longitude != null;
}

function validCoordinates(latitude, longitude) {
  if (!hasCoordinateValues(latitude, longitude)) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -85 && lat <= 85 && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null;
}

export default function GoogleMapCard({
  query,
  latitude,
  longitude,
  label = 'Ubicación',
  onLocationChange,
}) {
  const suppliedCoordinates = validCoordinates(latitude, longitude);
  const hasLocation = suppliedCoordinates || query?.trim();
  if (!hasLocation) return null;

  return (
    <MapCardContent
      suppliedCoordinates={suppliedCoordinates}
      label={label}
      onLocationChange={onLocationChange}
    />
  );
}

function MapCardContent({ suppliedCoordinates, label, onLocationChange }) {
  const editable = typeof onLocationChange === 'function';
  const [center, setCenter] = useState(suppliedCoordinates);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [mapWidth, setMapWidth] = useState(360);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (suppliedCoordinates) {
      setCenter(suppliedCoordinates);
      setDrag({ x: 0, y: 0 });
    }
  }, [suppliedCoordinates?.lat, suppliedCoordinates?.lng]);

  function finishDrag(dx, dy) {
    if (!center) return;
    const next = moveCenter(center, dx, dy, zoom);
    setCenter(next);
    setDrag({ x: 0, y: 0 });
    setDragging(false);
    onLocationChange?.(next);
  }

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => editable && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
    onMoveShouldSetPanResponderCapture: (_event, gesture) => editable && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
    onPanResponderGrant: () => setDragging(true),
    onPanResponderMove: (_event, gesture) => setDrag({ x: gesture.dx, y: gesture.dy }),
    onPanResponderRelease: (_event, gesture) => finishDrag(gesture.dx, gesture.dy),
    onPanResponderTerminate: (_event, gesture) => finishDrag(gesture.dx, gesture.dy),
  }), [center, zoom, editable, onLocationChange]);

  const tiles = useMemo(
    () => center ? mapTiles(center.lat, center.lng, mapWidth, zoom, drag) : [],
    [center, mapWidth, zoom, drag],
  );

  function changeZoom(amount) {
    setZoom((current) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + amount)));
    setDrag({ x: 0, y: 0 });
  }

  function openDirections() {
    if (!center) return;
    const destination = `${center.lat},${center.lng}`;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&dir_action=navigate`);
  }

  return (
    <View style={styles.card}>
      {center ? (
        <View
          style={[
            styles.map,
            Platform.OS === 'web' && (editable ? styles.mapWebEditable : styles.mapWebLocked),
          ]}
          onLayout={(event) => setMapWidth(event.nativeEvent.layout.width)}
          {...panResponder.panHandlers}
        >
          {tiles.map((tile) => (
            <Image
              key={`${zoom}-${tile.x}-${tile.y}`}
              source={{ uri: `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png` }}
              style={[styles.tile, { left: tile.left, top: tile.top }]}
            />
          ))}

          <View pointerEvents="none" style={styles.dragHint}>
            <Ionicons name={editable ? 'hand-left-outline' : 'lock-closed-outline'} size={13} color={colors.text} />
            <Text style={styles.dragHintText}>
              {editable
                ? (dragging ? 'Suelta para colocar la chincheta' : 'Arrastra el mapa para ajustar')
                : 'Ubicación fijada por quien la creó'}
            </Text>
          </View>

          <View pointerEvents="none" style={styles.markerShadow} />
          <View pointerEvents="none" style={styles.marker}>
            <Ionicons name="location" size={40} color={colors.clay} />
          </View>

          <View style={styles.zoomControls}>
            <Pressable
              accessibilityLabel="Acercar mapa"
              style={[styles.zoomButton, zoom === MAX_ZOOM && styles.zoomButtonDisabled]}
              onPress={() => changeZoom(1)}
              disabled={zoom === MAX_ZOOM}
            >
              <Ionicons name="add" size={22} color={colors.text} />
            </Pressable>
            <View style={styles.zoomDivider} />
            <Pressable
              accessibilityLabel="Alejar mapa"
              style={[styles.zoomButton, zoom === MIN_ZOOM && styles.zoomButtonDisabled]}
              onPress={() => changeZoom(-1)}
              disabled={zoom === MIN_ZOOM}
            >
              <Ionicons name="remove" size={22} color={colors.text} />
            </Pressable>
          </View>

          <Pressable style={styles.attribution} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>
            <Text style={styles.attributionText}>© OpenStreetMap</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.emptyPreview}>
          <Ionicons name="map-outline" size={36} color={colors.accent} />
          <Text style={styles.emptyTitle}>Falta ubicar el punto exacto</Text>
          <Text style={styles.emptyText} numberOfLines={2}>{label}</Text>
        </View>
      )}

      <View style={styles.selectionBar}>
        <Ionicons name="checkmark-circle" size={18} color={center ? colors.accentStrong : colors.textDim} />
        <View style={styles.selectionTextWrap}>
          <Text style={styles.selectionTitle}>{center ? (editable ? 'Punto seleccionado' : 'Ubicación') : 'Ubicación sin punto exacto'}</Text>
          <Text style={styles.selectionText} numberOfLines={1}>
            {center
              ? (editable ? 'La chincheta central es la ubicación que se guardará.' : 'La chincheta marca el punto exacto elegido al crearla.')
              : label}
          </Text>
        </View>
      </View>

      {!editable && center && (
        <Pressable accessibilityRole="link" style={styles.directionsButton} onPress={openDirections}>
          <Ionicons name="navigate-outline" size={18} color={colors.bg} />
          <Text style={styles.directionsButtonText}>Cómo llegar desde mi ubicación</Text>
        </Pressable>
      )}
    </View>
  );
}

function latLngToWorldPixel(lat, lng, zoom) {
  const worldSize = TILE_SIZE * (2 ** zoom);
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * worldSize,
    y: (1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2 * worldSize,
  };
}

function worldPixelToLatLng(x, y, zoom) {
  const worldSize = TILE_SIZE * (2 ** zoom);
  const wrappedX = ((x % worldSize) + worldSize) % worldSize;
  const limitedY = Math.max(0, Math.min(worldSize, y));
  const lng = (wrappedX / worldSize) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * limitedY) / worldSize;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
  };
}

function moveCenter(center, dragX, dragY, zoom) {
  const current = latLngToWorldPixel(center.lat, center.lng, zoom);
  return worldPixelToLatLng(current.x - dragX, current.y - dragY, zoom);
}

function mapTiles(lat, lng, width, zoom, drag) {
  const scale = 2 ** zoom;
  const world = latLngToWorldPixel(lat, lng, zoom);
  const worldTileX = world.x / TILE_SIZE;
  const worldTileY = world.y / TILE_SIZE;
  const centerX = Math.floor(worldTileX);
  const centerY = Math.floor(worldTileY);
  const fractionX = worldTileX - centerX;
  const fractionY = worldTileY - centerY;
  const tiles = [];

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const x = (centerX + dx + scale) % scale;
      const y = Math.max(0, Math.min(scale - 1, centerY + dy));
      tiles.push({
        x,
        y,
        left: width / 2 + (dx - fractionX) * TILE_SIZE + drag.x,
        top: MAP_HEIGHT / 2 + (dy - fractionY) * TILE_SIZE + drag.y,
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
  mapWebEditable: { touchAction: 'none', userSelect: 'none', cursor: 'grab' },
  mapWebLocked: { userSelect: 'none', cursor: 'default' },
  tile: { position: 'absolute', width: TILE_SIZE, height: TILE_SIZE },
  dragHint: {
    position: 'absolute', top: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(15,23,18,0.86)',
  },
  dragHintText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  marker: {
    position: 'absolute', left: '50%', top: '50%', marginLeft: -20, marginTop: -38,
  },
  markerShadow: {
    position: 'absolute', left: '50%', top: '50%', width: 20, height: 8,
    marginLeft: -10, marginTop: -2, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.3)',
  },
  zoomControls: {
    position: 'absolute', right: 10, top: 52, borderRadius: 10, overflow: 'hidden',
    backgroundColor: 'rgba(15,23,18,0.9)', borderWidth: 1, borderColor: colors.line,
  },
  zoomButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  zoomButtonDisabled: { opacity: 0.35 },
  zoomDivider: { height: 1, backgroundColor: colors.line },
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
  selectionBar: {
    minHeight: 56, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 9,
  },
  selectionTextWrap: { flex: 1, gap: 1 },
  selectionTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  selectionText: { color: colors.textDim, fontSize: 10 },
  directionsButton: {
    marginHorizontal: 12, marginBottom: 12, minHeight: 44, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.accent,
  },
  directionsButtonText: { color: colors.bg, fontSize: 13, fontWeight: '800' },
});
