import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconFor } from '../lib/sports';
import { colors, shape } from '../lib/theme';

export default function DailyChallengeCard({ navigation }) {
  const { user, sportIds } = useAuth();
  const [sports, setSports] = useState([]);
  const [streak, setStreak] = useState(0);
  const [doneToday, setDoneToday] = useState(null); // null = cargando, '' = no hecho, 'running' = deporte marcado

  const load = useCallback(async () => {
    if (!user) return;
    const { data: sportsRows } = await supabase.from('sports').select('*');
    setSports((sportsRows || []).filter((s) => sportIds.length === 0 || sportIds.includes(s.id)));

    const { data: streakVal } = await supabase.rpc('current_streak', { p_profile_id: user.id });
    setStreak(streakVal || 0);

    const today = new Date().toISOString().slice(0, 10);
    const { data: todayRow } = await supabase
      .from('daily_checkins').select('sport_id').eq('profile_id', user.id).eq('check_date', today).maybeSingle();
    setDoneToday(todayRow ? todayRow.sport_id : '');
  }, [user, sportIds]);

  useEffect(() => { load(); }, [load]);

  if (doneToday === null) return null;

  if (doneToday) {
    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.eyebrow}>Reto de hoy · hecho</Text>
          <View style={styles.streakChip}>
            <Ionicons name="flame" size={14} color={colors.bg} />
            <Text style={styles.streakChipText}>{streak}</Text>
          </View>
        </View>
        <Text style={styles.title}>Racha de {streak} días</Text>
        <Text style={styles.body}>Has registrado tu actividad de hoy. Vuelve mañana para no cortarla.</Text>
        <Pressable style={styles.more} onPress={() => navigation?.navigate('Challenges')}><Text style={styles.moreText}>Ver objetivos y medallas</Text><Ionicons name="arrow-forward" size={14} color={colors.bg} /></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>Reto de hoy</Text>
        <View style={styles.streakChip}>
          <Ionicons name="flame" size={14} color={colors.bg} />
          <Text style={styles.streakChipText}>{streak}</Text>
        </View>
      </View>
      <Text style={styles.title}>¿Qué has hecho hoy?</Text>
      {/* La racha ya no se marca con un toque: cada chip te lleva a Registrar
          para que dejes constancia real de la sesión (ruta GPS o, en gimnasio
          y calistenia, duración y sensación). Solo eso cuenta para la racha. */}
      <Text style={styles.body}>Elige tu deporte y registra la sesión para no cortar la racha.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
        <View style={styles.row}>
          {(sports.length ? sports : []).map((s) => (
            <Pressable key={s.id} style={styles.qbtn} onPress={() => navigation?.navigate('Registrar', { targetSportId: s.id })}>
              <Ionicons name={iconFor(s.id)} size={18} color={colors.bg} />
              <Text style={styles.qbtnText}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <Pressable style={styles.more} onPress={() => navigation?.navigate('Challenges')}><Text style={styles.moreText}>Ver todos los retos</Text><Ionicons name="arrow-forward" size={14} color={colors.bg} /></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.accent, borderTopLeftRadius: 28, borderBottomRightRadius: 28, borderTopRightRadius: 8, borderBottomLeftRadius: 8, padding: 16, gap: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: 'rgba(11,14,26,0.72)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  streakChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(11,14,26,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  streakChipText: { color: colors.bg, fontWeight: '700', fontSize: 12 },
  title: { color: colors.bg, fontSize: 20, fontWeight: '800' },
  body: { color: 'rgba(11,14,26,0.78)', fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8 },
  qbtn: { alignItems: 'center', gap: 4, backgroundColor: 'rgba(11,14,26,0.1)', ...shape.tag, paddingVertical: 10, paddingHorizontal: 14 },
  qbtnText: { color: colors.bg, fontSize: 10, fontWeight: '700' },
  more: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 2 },
  moreText: { color: colors.bg, fontSize: 11, fontWeight: '800' },
});
