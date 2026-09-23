import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import RoutePreview from './RoutePreview';
import RouteMap from './RouteMap';
import { haversineKm, routeDistanceKm } from '../lib/geo';
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
export default function RouteRecorder({ onFinish, targetRoute }) {
  const [status, setStatus] = useState('idle'); // idle | recording | paused | done
  const [route, setRoute] = useState([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(null);
  const pausedAccumRef = useRef(0);
  const routeRef = useRef([]);

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
        (pos) => addPoint(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude, pos.coords.accuracy),
        (err) => setError(err.message || 'No se pudo acceder a tu ubicación.'),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
      );
      return;
    }
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error('Permite usar la ubicación para grabar la actividad.');
    watchIdRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 3 },
      (pos) => addPoint(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude, pos.coords.accuracy),
    );
  }

  function addPoint(latitude, longitude, altitude, accuracy) {
    if (Number.isFinite(accuracy) && accuracy > 60) return;
    setRoute((prev) => {
      const next = altitude == null ? [latitude, longitude] : [latitude, longitude, altitude];
      if (!prev.length) {
        routeRef.current = [next];
        return routeRef.current;
      }
      const deltaKm = haversineKm(prev[prev.length - 1], next);
      if (deltaKm < 0.002 || deltaKm > 0.25) return prev;
      routeRef.current = [...prev, next];
      return routeRef.current;
    });
  }

  async function start() {
    if (!available) {
      setError('Este dispositivo no permite compartir ubicación en tiempo real.');
      return;
    }
    setError(null);
    routeRef.current = [];
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
    const finalRoute = routeRef.current;
    setStatus('done');
    if (finalRoute.length < 2) {
      setError(finalRoute.length
        ? 'Solo hemos recibido un punto GPS. Muévete unos metros y prueba de nuevo para poder dibujar el recorrido.'
        : 'No hemos recibido ninguna ubicación. Comprueba el permiso de ubicación y vuelve a intentarlo.');
      return;
    }
    setError(null);
    const distanceKm = routeDistanceKm(finalRoute);
    const durationSec = Math.max(1, Math.round(elapsedSec));
    const durationMin = Math.max(1, Math.round(durationSec / 60));
    const altitudes = finalRoute.map((point) => point[2]).filter((value) => Number.isFinite(value));
    let elevationM = 0;
    for (let i = 1; i < altitudes.length; i++) {
      const gain = altitudes[i] - altitudes[i - 1];
      if (gain >= 1 && gain <= 25) elevationM += gain;
    }
    onFinish({ route: finalRoute, distanceKm, durationMin, durationSec, elevationM: Math.round(elevationM) });
  }

  function reset() {
    setStatus('idle');
    routeRef.current = [];
    setRoute([]);
    setError(null);
    setElapsedSec(0);
  }

  const distanceKm = routeDistanceKm(route);
  const targetDistanceKm = routeDistanceKm(targetRoute || []);

  return (
    <View style={styles.wrap}>
      {status === 'idle' && (
        <View style={styles.idleWrap}>
          {!!targetDistanceKm && <RoutePreview route={targetRoute} height={120} label={`Ruta de referencia · ${targetDistanceKm.toFixed(2)} km`} />}
          <Pressable style={styles.startBtn} onPress={start}>
            <Ionicons name="navigate-circle-outline" size={18} color={colors.accentStrong} />
            <Text style={styles.startBtnText}>{targetDistanceKm ? 'Empezar siguiendo esta ruta' : 'Empezar a grabar ruta con GPS'}</Text>
          </Pressable>
        </View>
      )}

      {(status === 'recording' || status === 'paused') && (
        <View style={styles.recordingCard}>
          <View style={styles.statsRow}>
            <Stat label="Distancia" value={`${distanceKm.toFixed(2)} km`} />
            <Stat label="Tiempo" value={formatDuration(elapsedSec)} />
            <Stat label="Puntos" value={String(route.length)} />
            {!!targetDistanceKm && <Stat label="Objetivo" value={`${targetDistanceKm.toFixed(2)} km`} />}
          </View>
          {route.length >= 1 ? (
            <RouteMap route={route} comparisonRoute={targetRoute} height={190} statusLabel="Grabando ahora" />
          ) : (
            <View style={styles.waitingGps}><Ionicons name="locate-outline" size={20} color={colors.accentStrong} /><Text style={styles.waitingText}>Buscando tu posición GPS…</Text></View>
          )}
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
          <View style={styles.doneTitleRow}>
            <Ionicons name={route.length >= 2 ? 'checkmark-circle' : 'warning'} size={22} color={route.length >= 2 ? colors.accentStrong : colors.amber} />
            <View style={{ flex: 1 }}><Text style={styles.doneTitle}>{route.length >= 2 ? 'Ruta lista para guardar' : 'No hay recorrido suficiente'}</Text><Text style={styles.doneHint}>{route.length >= 2 ? 'Revisa el mapa y guarda la actividad debajo.' : 'La grabación se ha detenido, pero todavía no podemos dibujar una ruta.'}</Text></View>
          </View>
          <View style={styles.statsRow}>
            <Stat label="Distancia" value={`${distanceKm.toFixed(2)} km`} />
            <Stat label="Tiempo" value={formatDuration(elapsedSec)} />
            <Stat label="Puntos GPS" value={String(route.length)} />
          </View>
          {route.length >= 1 && <RouteMap route={route} comparisonRoute={targetRoute} height={220} statusLabel={route.length >= 2 ? 'Grabación terminada' : 'Único punto recibido'} />}
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
  idleWrap: { gap: 10 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface2,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignSelf: 'flex-start',
  },
  startBtnText: { color: colors.accentStrong, fontSize: 13, fontWeight: '700' },
  recordingCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 12, gap: 10, borderWidth: 1, borderColor: colors.line },
  doneCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 12, gap: 10, borderWidth: 1, borderColor: colors.line },
  doneTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  doneTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  doneHint: { color: colors.textDim, fontSize: 10, lineHeight: 15, marginTop: 2 },
  waitingGps: { height: 120, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', gap: 7 },
  waitingText: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
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
