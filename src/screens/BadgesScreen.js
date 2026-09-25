import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SportLoader from '../components/SportLoader';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';
import { iconForBadge } from '../lib/badges';

// Catálogo completo de medallas (conseguidas y por conseguir). Se llega aquí
// desde "Ver todas" en la pantalla de Retos, que solo enseña un resumen.
export default function BadgesScreen() {
  const { user } = useAuth();
  const [badges, setBadges] = useState([]);
  const [earnedIds, setEarnedIds] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: allBadges } = await supabase.from('badges').select('*').order('id');
    setBadges(allBadges || []);
    if (user) {
      const { data: earned } = await supabase.from('profile_badges').select('badge_id').eq('profile_id', user.id);
      const map = {};
      (earned || []).forEach((e) => { map[e.badge_id] = true; });
      setEarnedIds(map);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={styles.center}><SportLoader /></View>;
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={badges}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
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
