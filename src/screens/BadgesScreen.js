import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, SectionList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SportLoader from '../components/SportLoader';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';
import { iconForBadge } from '../lib/badges';

const DIFFICULTY_ORDER = { facil: 0, normal: 1, dificil: 2, epico: 3 };
const DIFFICULTY_LABEL = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil', epico: 'Épica' };

// Catálogo completo de medallas. Se llega desde "Ver todas" en Retos,
// que solo enseña las tres próximas para no abrumar.
export default function BadgesScreen() {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: allBadges }, earnedRes] = await Promise.all([
      supabase.from('badges').select('*').order('sort_order'),
      user ? supabase.from('profile_badges').select('badge_id').eq('profile_id', user.id) : Promise.resolve({ data: [] }),
    ]);
    const earnedIds = new Set((earnedRes.data || []).map((e) => e.badge_id));
    const list = allBadges || [];
    const byDifficulty = (a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 1) - (DIFFICULTY_ORDER[b.difficulty] ?? 1) || (a.sort_order || 0) - (b.sort_order || 0);
    const earned = list.filter((b) => earnedIds.has(b.id)).map((b) => ({ ...b, earned: true }));
    const pending = list.filter((b) => !earnedIds.has(b.id)).sort(byDifficulty);
    const next = [];
    if (earned.length) next.push({ title: `Conseguidas · ${earned.length}`, data: earned });
    if (pending.length) next.push({ title: `Por conseguir · ${pending.length}`, data: pending });
    setSections(next);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={styles.center}><SportLoader /></View>;
  }

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(b) => b.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, !item.earned && styles.cardLocked]}>
            <View style={[styles.iconWrap, item.earned && styles.iconWrapEarned]}>
              <Ionicons name={iconForBadge(item.id)} size={22} color={item.earned ? colors.bg : colors.textDim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardDesc}>{item.description}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[styles.difficulty, styles[`difficulty_${item.difficulty}`]]}>{DIFFICULTY_LABEL[item.difficulty] || 'Normal'}</Text>
              <Text style={styles.xp}>+{item.xp_reward || 50} XP</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 8, marginBottom: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface,
    borderRadius: 16, padding: 13, borderWidth: 1, borderColor: colors.line,
  },
  cardLocked: { opacity: 0.7 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  iconWrapEarned: { backgroundColor: colors.accent },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  cardDesc: { color: colors.textDim, fontSize: 11, lineHeight: 16, marginTop: 2 },
  difficulty: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textDim },
  difficulty_facil: { color: colors.accent },
  difficulty_normal: { color: colors.amber },
  difficulty_dificil: { color: colors.clay },
  difficulty_epico: { color: colors.lane },
  xp: { color: colors.amber, fontSize: 10, fontWeight: '900' },
});
