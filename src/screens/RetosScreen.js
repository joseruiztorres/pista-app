import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SportLoader from '../components/SportLoader';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';
import { iconForBadge } from '../lib/badges';

// Hitos de racha que además tienen medalla asociada (ver supabase/002_social.sql).
const STREAK_MILESTONES = [3, 7, 30];

export default function RetosScreen() {
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

  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak);

  if (loading) {
    return <View style={styles.center}><SportLoader /></View>;
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={badges}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListHeaderComponent={
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
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => {
          const earned = !!earnedIds[item.id];
          return (
            <View style={[styles.card, !earned && styles.cardLocked]}>
              <View style={[styles.iconWrap, earned && styles.iconWrapEarned]}>
                <Ionicons name={iconForBadge(item.id)} size={22} color={earned ? colors.bg : colors.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, !earned && styles.cardTitleLocked]}>{item.name}</Text>
                <Text style={styles.cardDesc}>{item.description}</Text>
              </View>
              {earned && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  streakCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface,
    borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.line, marginBottom: 4,
  },
  streakIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  streakTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  streakSubtitle: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface,
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.line,
  },
  cardLocked: { opacity: 0.55 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  iconWrapEarned: { backgroundColor: colors.amber },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cardTitleLocked: { color: colors.textDim },
  cardDesc: { color: colors.textDim, fontSize: 12, marginTop: 2 },
});
