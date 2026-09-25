import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, PanResponder, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

const TILE_SIZE = 256;
const MAP_HEIGHT = 430;
const MIN_ZOOM = 11;
const MAX_ZOOM = 17;

export default function MeetupsMap({ meetups, onPressMeetup }) {
  const located = useMemo(() => meetups.filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))), [meetups]);
  const initialCenter = useMemo(() => averageCenter(located), [located]);
  const [center, setCenter] = useState(initialCenter);
  const [zoom, setZoom] = useState(13);
  const [width, setWidth] = useState(360);
  const [drag, setDrag] = useState({ x: 0, y: 0 });

  useEffect(() => { if (initialCenter) setCenter(initialCenter); }, [initialCenter?.lat, initialCenter?.lng]);

  function finishDrag(dx, dy) {
    if (!center) return;
    setCenter(moveCenter(center, dx, dy, zoom));
    setDrag({ x: 0, y: 0 });
  }

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
    onMoveShouldSetPanResponderCapture: (_event, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
    onPanResponderMove: (_event, gesture) => setDrag({ x: gesture.dx, y: gesture.dy }),
    onPanResponderRelease: (_event, gesture) => finishDrag(gesture.dx, gesture.dy),
    onPanResponderTerminate: (_event, gesture) => finishDrag(gesture.dx, gesture.dy),
  }), [center, zoom]);

  const tiles = useMemo(() => center ? mapTiles(center, width, zoom, drag) : [], [center, width, zoom, drag]);
  const markers = useMemo(() => center ? located.map((meetup) => ({
    meetup,
    ...pointPosition(center, { lat: Number(meetup.lat), lng: Number(meetup.lng) }, width, zoom, drag),
  })) : [], [center, located, width, zoom, drag]);

  if (!located.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="map-outline" size={30} color={colors.textDim} />
        <Text style={styles.emptyTitle}>No hay quedadas ubicadas en el mapa</Text>
        <Text style={styles.emptyText}>Las nuevas quedadas aparecerán aquí cuando incluyan una chincheta.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View
        style={[styles.map, Platform.OS === 'web' && styles.mapWeb]}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        {...responder.panHandlers}
      >
        {tiles.map((tile) => (
          <Image key={`${zoom}-${tile.x}-${tile.y}`} source={{ uri: `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png` }} style={[styles.tile, { left: tile.left, top: tile.top }]} />
        ))}

        <View pointerEvents="none" style={styles.hint}>
          <Ionicons name="hand-left-outline" size={13} color={colors.text} />
          <Text style={styles.hintText}>Mueve el mapa y toca una quedada</Text>
        </View>

        {markers.map(({ meetup, left, top }) => (
          <Pressable
            key={meetup.id}
            accessibilityLabel={`Abrir ${meetup.title}`}
            style={[styles.marker, { left: left - 19, top: top - 38 }]}
            onPress={() => onPressMeetup(meetup)}
          >
            <Ionicons name="location" size={38} color={colors.clay} />
          </Pressable>
        ))}

        <View style={styles.zoomControls}>
          <Pressable accessibilityLabel="Acercar mapa" style={styles.zoomButton} onPress={() => setZoom((value) => Math.min(MAX_ZOOM, value + 1))}>
            <Ionicons name="add" size={21} color={colors.text} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable accessibilityLabel="Alejar mapa" style={styles.zoomButton} onPress={() => setZoom((value) => Math.max(MIN_ZOOM, value - 1))}>
            <Ionicons name="remove" size={21} color={colors.text} />
          </Pressable>
        </View>
        <Pressable style={styles.attribution} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>
          <Text style={styles.attributionText}>© OpenStreetMap</Text>
        </Pressable>
      </View>
      <View style={styles.footer}>
        <Ionicons name="location-outline" size={16} color={colors.accentStrong} />
        <Text style={styles.footerText}>{located.length} quedada{located.length === 1 ? '' : 's'} en el mapa</Text>
      </View>
    </View>
  );
}

function averageCenter(items) {
  if (!items.length) return null;
  return {
    lat: items.reduce((sum, item) => sum + Number(item.lat), 0) / items.length,
    lng: items.reduce((sum, item) => sum + Number(item.lng), 0) / items.length,
  };
}

function worldPixel(lat, lng, zoom) {
  const size = TILE_SIZE * (2 ** zoom);
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * size,
    y: (1 - Math.log(Math.tan(rad) + (1 / Math.cos(rad))) / Math.PI) / 2 * size,
  };
}

function pixelToLatLng(x, y, zoom) {
  const size = TILE_SIZE * (2 ** zoom);
  const wrappedX = ((x % size) + size) % size;
  const limitedY = Math.max(0, Math.min(size, y));
  const lng = (wrappedX / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * limitedY) / size;
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng };
}

function moveCenter(center, dx, dy, zoom) {
  const point = worldPixel(center.lat, center.lng, zoom);
  return pixelToLatLng(point.x - dx, point.y - dy, zoom);
}

function pointPosition(center, point, width, zoom, drag) {
  const centerPixel = worldPixel(center.lat, center.lng, zoom);
  const pointPixel = worldPixel(point.lat, point.lng, zoom);
  return { left: width / 2 + pointPixel.x - centerPixel.x + drag.x, top: MAP_HEIGHT / 2 + pointPixel.y - centerPixel.y + drag.y };
}

function mapTiles(center, width, zoom, drag) {
  const scale = 2 ** zoom;
  const world = worldPixel(center.lat, center.lng, zoom);
  const tileX = world.x / TILE_SIZE;
  const tileY = world.y / TILE_SIZE;
  const baseX = Math.floor(tileX);
  const baseY = Math.floor(tileY);
  const fractionX = tileX - baseX;
  const fractionY = tileY - baseY;
  const tiles = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const x = (baseX + dx + scale) % scale;
      const y = Math.max(0, Math.min(scale - 1, baseY + dy));
      tiles.push({ x, y, left: width / 2 + (dx - fractionX) * TILE_SIZE + drag.x, top: MAP_HEIGHT / 2 + (dy - fractionY) * TILE_SIZE + drag.y });
    }
  }
  return tiles;
}

const styles = StyleSheet.create({
  card: { margin: 16, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  map: { height: MAP_HEIGHT, overflow: 'hidden', backgroundColor: colors.surface2 },
  mapWeb: { touchAction: 'none', userSelect: 'none', cursor: 'grab' },
  tile: { position: 'absolute', width: TILE_SIZE, height: TILE_SIZE },
  hint: { position: 'absolute', top: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(11,14,26,0.88)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  hintText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  marker: { position: 'absolute', width: 38, height: 42, alignItems: 'center' },
  zoomControls: { position: 'absolute', right: 10, top: 52, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(11,14,26,0.9)', borderWidth: 1, borderColor: colors.line },
  zoomButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: colors.line },
  attribution: { position: 'absolute', right: 5, bottom: 5, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.9)' },
  attributionText: { color: '#1D2440', fontSize: 9, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 12 },
  footerText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  empty: { margin: 16, minHeight: 220, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
});
