import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import RoutePreview from './RoutePreview';
import { routeDistanceKm } from '../lib/geo';
import { colors } from '../lib/theme';

function formatDuration(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Graba una ruta real con la Geolocation API del navegador (watchPosition):
// empezar/pausar/reanudar/parar, mapa en vivo (RoutePreview) y distancia,
// duración y ritmo calculados a partir de las posiciones reales, no de un
// trazado de ejemplo. Al terminar, entrega { route, distanceKm, durationMin }
// al padre para que rellene el formulario de publicación.
export default function RouteRecorder({ onFinish }) {
  const [status, setStatus] = useState('idle'); // idle | recording | paused | done
  const [route, setRoute] = useState([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(null);
  const pausedAccumRef = useRef(0);

  const available = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && !!navigator.geolocation);

  useEffect(() => () => stopWatch(), []);

  function stopWatch() {
    if (watchIdRef.current != null) {
      if (Platform.OS === 'web' && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
      else watchIdRef.current?.remove?.();
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    startedAtRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSec(pausedAccumRef.current + (Date.now() - startedAtRef.current) / 1000);
    }, 1000);
  }

  async function startLocationWatch() {
    if (Platform.OS === 'web') {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => addPoint(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude),
        (err) => setError(err.message || 'No se pudo acceder a tu ubicación.'),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
      );
      return;
    }
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error('Permite usar la ubicación para grabar la actividad.');
    watchIdRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 3 },
      (pos) => addPoint(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude),
    );
  }

  function addPoint(latitude, longitude, altitude) {
    setRoute((prev) => [...prev, altitude == null ? [latitude, longitude] : [latitude, longitude, altitude]]);
  }

  async function start() {
    if (!available) {
      setError('Este dispositivo no permite compartir ubicación en tiempo real.');
      return;
    }
    setError(null);
    setRoute([]);
    pausedAccumRef.current = 0;
    setElapsedSec(0);
    setStatus('recording');
    startTimer();
    try { await startLocationWatch(); } catch (err) { setError(err.message); stopWatch(); setStatus('idle'); }
  }

  function pause() {
    stopWatch();
    pausedAccumRef.current = elapsedSec;
    setStatus('paused');
  }

  async function resume() {
    setStatus('recording');
    startTimer();
    try { await startLocationWatch(); } catch (err) { setError(err.message); stopWatch(); setStatus('paused'); }
  }

  function stop() {
    stopWatch();
    if (route.length < 2) {
      Alert.alert('Ruta muy corta', 'Graba al menos unos segundos de movimiento antes de parar.');
      setStatus('idle');
      return;
    }
    setStatus('done');
    const distanceKm = routeDistanceKm(route);
    const durationSec = Math.max(1, Math.round(elapsedSec));
    const durationMin = Math.max(1, Math.round(durationSec / 60));
    const altitudes = route.map((point) => point[2]).filter((value) => Number.isFinite(value));
    let elevationM = 0;
    for (let i = 1; i < altitudes.length; i++) elevationM += Math.max(0, altitudes[i] - altitudes[i - 1]);
    onFinish({ route, distanceKm, durationMin, durationSec, elevationM: Math.round(elevationM) });
  }

  function reset() {
    setStatus('idle');
    setRoute([]);
    setElapsedSec(0);
  }

  const distanceKm = routeDistanceKm(route);

  return (
    <View style={styles.wrap}>
      {status === 'idle' && (
        <Pressable style={styles.startBtn} onPress={start}>
          <Ionicons name="navigate-circle-outline" size={18} color={colors.accentStrong} />
          <Text style={styles.startBtnText}>Empezar a grabar ruta con GPS</Text>
        </Pressable>
      )}

      {(status === 'recording' || status === 'paused') && (
        <View style={styles.recordingCard}>
          <View style={styles.statsRow}>
            <Stat label="Distancia" value={`${distanceKm.toFixed(2)} km`} />
            <Stat label="Tiempo" value={formatDuration(elapsedSec)} />
            <Stat label="Puntos" value={String(route.length)} />
          </View>
          {route.length >= 2 && <RoutePreview route={route} height={110} />}
          <View style={styles.controlsRow}>
            {status === 'recording' ? (
              <Pressable style={styles.controlBtn} onPress={pause}>
                <Ionicons name="pause" size={18} color={colors.text} />
                <Text style={styles.controlBtnText}>Pausar</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.controlBtn} onPress={resume}>
                <Ionicons name="play" size={18} color={colors.text} />
                <Text style={styles.controlBtnText}>Reanudar</Text>
              </Pressable>
            )}
            <Pressable style={[styles.controlBtn, styles.stopBtn]} onPress={stop}>
              <Ionicons name="stop" size={18} color={colors.bg} />
              <Text style={[styles.controlBtnText, { color: colors.bg }]}>Parar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {status === 'done' && (
        <View style={styles.doneCard}>
          <View style={styles.statsRow}>
            <Stat label="Distancia" value={`${distanceKm.toFixed(2)} km`} />
            <Stat label="Tiempo" value={formatDuration(elapsedSec)} />
          </View>
          <RoutePreview route={route} height={110} />
          <Pressable style={styles.secondaryBtn} onPress={reset}>
            <Ionicons name="refresh" size={14} color={colors.accentStrong} />
            <Text style={styles.secondaryBtnText}>Grabar de nuevo</Text>
          </Pressable>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface2,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignSelf: 'flex-start',
  },
  startBtnText: { color: colors.accentStrong, fontSize: 13, fontWeight: '700' },
  recordingCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 12, gap: 10, borderWidth: 1, borderColor: colors.line },
  doneCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 12, gap: 10, borderWidth: 1, borderColor: colors.line },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 10, marginTop: 2 },
  controlsRow: { flexDirection: 'row', gap: 10 },
  controlBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface2, borderRadius: 999, paddingVertical: 10,
  },
  controlBtnText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  stopBtn: { backgroundColor: colors.clay },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  secondaryBtnText: { color: colors.accentStrong, fontSize: 12, fontWeight: '600' },
  error: { color: colors.clay, fontSize: 12 },
});
