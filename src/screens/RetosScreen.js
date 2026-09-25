import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SportLoader from '../components/SportLoader';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';
import { iconForBadge } from '../lib/badges';

// Hitos de racha que además tienen medalla asociada (ver supabase/002_social.sql).
const STREAK_MILESTONES = [3, 7, 30];
// Cuántas medallas por conseguir se enseñan aquí antes de mandar al catálogo
// completo — la pantalla de Retos es un vistazo rápido, no una lista larga.
const UPCOMING_COUNT = 3;

export default function RetosScreen({ navigation }) {
  const { user } = useAuth();
  const [badges, setBadges] = useState([]);
  const [earnedIds, setEarnedIds] = useState({});
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: allBadges }, streakRes] = await Promise.all([
      supabase.from('badges').select('*').order('id'),
      user ? supabase.rpc('current_streak', { p_profile_id: user.id }) : Promise.resolve({ data: 0 }),
    ]);
    setBadges(allBadges || []);
    setStreak(streakRes.data || 0);

    if (user) {
      const { data: earned } = await supabase.from('profile_badges').select('badge_id').eq('profile_id', user.id);
      const map = {};
      (earned || []).forEach((e) => { map[e.badge_id] = true; });
      setEarnedIds(map);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak);
  const upcoming = badges.filter((b) => !earnedIds[b.id]).slice(0, UPCOMING_COUNT);
  const earnedCount = badges.filter((b) => earnedIds[b.id]).length;

  if (loading) {
    return <View style={styles.center}><SportLoader /></View>;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      <Text style={styles.h1}>Retos</Text>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Reto activo</Text>
      </View>
      <View style={styles.streakCard}>
        <View style={styles.streakIconWrap}>
          <Ionicons name="flame" size={26} color={colors.amber} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.streakTitle}>Racha de {streak} {streak === 1 ? 'día' : 'días'}</Text>
          <Text style={styles.streakSubtitle}>
            {nextMilestone
              ? `${nextMilestone - streak} ${nextMilestone - streak === 1 ? 'día' : 'días'} más para "${nextMilestone === 3 ? 'Constancia x3' : nextMilestone === 7 ? 'Una semana' : 'Un mes entero'}"`
              : '¡Has desbloqueado todas las medallas de racha!'}
          </Text>
        </View>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Próximas medallas</Text>
        <Pressable onPress={() => navigation.navigate('Badges')}>
          <Text style={styles.sectionLink}>Ver todas ({earnedCount}/{badges.length})</Text>
        </Pressable>
      </View>

      {upcoming.length === 0 ? (
        <View style={styles.allDoneCard}>
          <Ionicons name="trophy" size={20} color={colors.amber} />
          <Text style={styles.allDoneText}>Has conseguido todas las medallas disponibles ahora mismo.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {upcoming.map((b) => (
            <View key={b.id} style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name={iconForBadge(b.id)} size={20} color={colors.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{b.name}</Text>
                <Text style={styles.cardDesc}>{b.description}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  h1: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  sectionTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLink: { color: colors.accentStrong, fontSize: 12, fontWeight: '700' },
  streakCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface,
    borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.line,
  },
  streakIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  streakTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  streakSubtitle: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  allDoneCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.line },
  allDoneText: { flex: 1, color: colors.textDim, fontSize: 12, lineHeight: 17 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface,
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.line,
  },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cardDesc: { color: colors.textDim, fontSize: 12, marginTop: 2 },
});
