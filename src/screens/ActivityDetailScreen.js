import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, shape } from '../lib/theme';
import { iconFor } from '../lib/sports';
import RouteMap from '../components/RouteMap';
import SportLoader from '../components/SportLoader';

const CLIMB_TYPES = { rocodromo: 'Rocódromo', roca: 'Roca', boulder: 'Boulder' };

function durationLabel(details) {
  const minutes = Number(details.duration_min || details.approach_duration_min || 0);
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export default function ActivityDetailScreen({ navigation, route: navRoute }) {
  const { postId } = navRoute.params || {};
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    const { data } = await supabase.from('posts')
      .select('*, profiles:author_id(username, display_name), sports:sport_id(name)')
      .eq('id', postId).maybeSingle();
    setPost(data || null);
    setLoading(false);
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  const details = post?.details || {};
  const recordedRoute = useMemo(() => Array.isArray(details.route) ? details.route : [], [details.route]);
  const distance = Number(details.distance_km || details.approach_distance_km || 0);

  function repeatRoute() {
    navigation.navigate('Tabs', {
      screen: 'Registrar',
      params: { targetRoute: recordedRoute, targetSportId: post.sport_id, sourcePostId: post.id },
    });
  }

  function openStartDirections() {
    const first = recordedRoute[0];
    if (!first) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${first[0]},${first[1]}`)}&dir_action=navigate`);
  }

  if (loading) return <View style={styles.center}><SportLoader label="Cargando recorrido…" /></View>;
  if (!post || recordedRoute.length < 2) return <View style={styles.center}><Text style={styles.empty}>Este recorrido ya no está disponible.</Text></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <View style={styles.sportIcon}><Ionicons name={iconFor(post.sport_id)} size={24} color={colors.bg} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{post.sports?.name || post.sport_id}</Text>
          <Text style={styles.title}>{post.caption || 'Actividad con GPS'}</Text>
          <Text style={styles.meta}>{post.profiles?.display_name || post.profiles?.username} · {new Date(post.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </View>
      </View>

      <RouteMap route={recordedRoute} height={310} onPressAttribution={() => Linking.openURL('https://www.openstreetmap.org/copyright')} />

      <View style={styles.metrics}>
        <Metric label={details.activity_kind === 'climbing' ? 'Aproximación' : 'Distancia'} value={distance ? `${distance.toFixed(2)} km` : '—'} />
        <Metric label="Tiempo" value={durationLabel(details)} />
        <Metric label={details.avg_speed_kmh ? 'Velocidad media' : 'Ritmo medio'} value={details.avg_speed_kmh || details.pace_min_km || '—'} />
        <Metric label="Desnivel" value={details.elevation_m ? `${details.elevation_m} m` : '—'} />
      </View>

      {details.activity_kind === 'climbing' && (
        <View style={styles.climbCard}>
          <Text style={styles.sectionTitle}>Sesión de escalada</Text>
          <View style={styles.climbRows}>
            <MiniStat label="Tipo" value={CLIMB_TYPES[details.climb_type] || details.climb_type || '—'} />
            <MiniStat label="Vías" value={details.routes_completed || '—'} />
            <MiniStat label="Grado máximo" value={details.highest_grade || '—'} />
            <MiniStat label="Altura total" value={details.vertical_m ? `${details.vertical_m} m` : '—'} />
          </View>
        </View>
      )}

      <View style={styles.infoRow}>
        <Ionicons name={details.hidden_ends ? 'shield-checkmark' : 'eye-outline'} size={18} color={colors.accentStrong} />
        <Text style={styles.infoText}>{details.hidden_ends ? 'El inicio y el final se han recortado para proteger la privacidad.' : 'Recorrido completo compartido por su autor.'}</Text>
      </View>

      <Pressable style={styles.primary} onPress={repeatRoute}>
        <Ionicons name="navigate-circle-outline" size={20} color={colors.bg} />
        <Text style={styles.primaryText}>Repetir esta ruta</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={openStartDirections}>
        <Ionicons name="map-outline" size={18} color={colors.accentStrong} />
        <Text style={styles.secondaryText}>Cómo llegar al inicio</Text>
      </Pressable>
    </ScrollView>
  );
}

function Metric({ label, value }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function MiniStat({ label, value }) {
  return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { color: colors.textDim, textAlign: 'center' },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sportIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.accentStrong, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 20, lineHeight: 24, fontWeight: '900', marginTop: 2 },
  meta: { color: colors.textDim, fontSize: 11, marginTop: 3 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '48%', backgroundColor: colors.surface, borderRadius: 15, borderWidth: 1, borderColor: colors.line, padding: 13 },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  metricLabel: { color: colors.textDim, fontSize: 10, marginTop: 3 },
  climbCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  climbRows: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mini: { minWidth: '46%', flex: 1, backgroundColor: colors.surface2, borderRadius: 12, padding: 10 },
  miniLabel: { color: colors.textDim, fontSize: 9, textTransform: 'uppercase' },
  miniValue: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 3 },
  infoRow: { flexDirection: 'row', gap: 9, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 12 },
  infoText: { flex: 1, color: colors.textDim, fontSize: 11, lineHeight: 16 },
  primary: { minHeight: 48, ...shape.button, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: colors.bg, fontSize: 14, fontWeight: '900' },
  secondary: { minHeight: 46, ...shape.button, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { color: colors.accentStrong, fontSize: 13, fontWeight: '800' },
});
