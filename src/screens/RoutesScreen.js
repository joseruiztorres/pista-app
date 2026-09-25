import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { colors, shape } from '../lib/theme';
import { iconFor } from '../lib/sports';
import RoutePreview from '../components/RoutePreview';
import SportLoader from '../components/SportLoader';

export default function RoutesScreen({ navigation }) {
  const { user } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('posts')
      .select('id, sport_id, caption, details, audience, created_at, sports:sport_id(name)')
      .eq('author_id', user.id).eq('type', 'ruta')
      .order('created_at', { ascending: false });
    setRoutes((data || []).filter((row) => Array.isArray(row.details?.route) && row.details.route.length >= 2));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    return navigation.addListener('focus', load);
  }, [load, navigation]);

  if (loading) return <View style={styles.center}><SportLoader label="Cargando tus rutas…" /></View>;

  return (
    <FlatList
      style={styles.screen}
      data={routes}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>TU MAPA</Text>
          <Text style={styles.title}>Todos tus recorridos</Text>
          <Text style={styles.hint}>Revive una actividad o úsala como guía para volver a hacerla.</Text>
          <Pressable style={styles.record} onPress={() => navigation.navigate('Tabs', { screen: 'Registrar' })}>
            <Ionicons name="navigate-circle-outline" size={18} color={colors.bg} />
            <Text style={styles.recordText}>Grabar una ruta nueva</Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="map-outline" size={34} color={colors.textDim} />
          <Text style={styles.emptyTitle}>Tu mapa está esperando</Text>
          <Text style={styles.emptyText}>Cuando termines una actividad con GPS, aparecerá aquí.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const details = item.details || {};
        const distance = Number(details.distance_km || details.approach_distance_km || 0);
        const minutes = Number(details.duration_min || details.approach_duration_min || 0);
        return (
          <Pressable style={styles.card} onPress={() => navigation.navigate('ActivityDetail', { postId: item.id })}>
            <View style={styles.cardHead}>
              <View style={styles.sportPill}><Ionicons name={iconFor(item.sport_id)} size={14} color={colors.bg} /><Text style={styles.sportText}>{item.sports?.name || item.sport_id}</Text></View>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('es-ES')}</Text>
            </View>
            <RoutePreview route={details.route} height={120} label="Toca para abrir el mapa completo" />
            <View style={styles.cardStats}>
              <Text style={styles.cardStat}><Text style={styles.cardValue}>{distance ? `${distance.toFixed(2)} km` : 'Ruta GPS'}</Text> · {minutes ? `${minutes} min` : 'sin tiempo'}</Text>
              <Ionicons name="chevron-forward" size={17} color={colors.textDim} />
            </View>
            {!!item.caption && <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text>}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  intro: { gap: 6, marginBottom: 18 },
  eyebrow: { color: colors.accentStrong, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 24, fontWeight: '900' },
  hint: { color: colors.textDim, fontSize: 12, lineHeight: 17 },
  record: { marginTop: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.accent, ...shape.button, paddingHorizontal: 14, paddingVertical: 10 },
  recordText: { color: colors.bg, fontSize: 12, fontWeight: '900' },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 9 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sportPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  sportText: { color: colors.bg, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  date: { color: colors.textDim, fontSize: 10 },
  cardStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardStat: { color: colors.textDim, fontSize: 11 },
  cardValue: { color: colors.text, fontWeight: '900', fontSize: 14 },
  caption: { color: colors.text, fontSize: 12, lineHeight: 17 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 30 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  emptyText: { color: colors.textDim, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
