import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { activityMetric, dateKey, startOfWeek } from '../lib/engagement';
import { colors } from '../lib/theme';
import SportLoader from '../components/SportLoader';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function ProgressScreen({ navigation }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [badges, setBadges] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const [postsRes, checkinsRes, badgeRes] = await Promise.all([
      supabase.from('posts').select('sport_id, details, created_at').eq('author_id', user.id).gte('created_at', since.toISOString()),
      supabase.from('daily_checkins').select('sport_id, check_date').eq('profile_id', user.id).gte('check_date', dateKey(since)),
      supabase.from('profile_badges').select('badge_id', { count: 'exact', head: true }).eq('profile_id', user.id),
    ]);
    setPosts(postsRes.data || []);
    setCheckins(checkinsRes.data || []);
    setBadges(badgeRes.count || 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const thisWeek = startOfWeek();
    const previousWeek = new Date(thisWeek);
    previousWeek.setDate(previousWeek.getDate() - 7);
    const month = new Date();
    month.setDate(month.getDate() - 30);
    const weeklySessions = activityMetric('sessions', posts, checkins, { since: thisWeek });
    const previousSessions = checkins.filter((row) => new Date(`${row.check_date}T12:00:00`) >= previousWeek && new Date(`${row.check_date}T12:00:00`) < thisWeek).length;
    const activeDays = new Set(checkins.filter((row) => new Date(`${row.check_date}T12:00:00`) >= thisWeek).map((row) => row.check_date));
    return {
      thisWeek,
      weeklySessions,
      previousSessions,
      distance: activityMetric('distance_km', posts, checkins, { since: month }),
      minutes: activityMetric('minutes', posts, checkins, { since: month }),
      sports: activityMetric('sports', posts, checkins, { since: month }),
      activeDays,
    };
  }, [checkins, posts]);

  if (loading) return <View style={styles.center}><SportLoader label="Calculando tu progreso" /></View>;
  const difference = stats.weeklySessions - stats.previousSessions;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>ÚLTIMOS 30 DÍAS</Text>
        <Text style={styles.title}>Tu deporte, en números</Text>
        <Text style={styles.subtitle}>{difference === 0 ? 'Mantienes el ritmo de la semana anterior.' : difference > 0 ? `Llevas ${difference} entrenamientos más que la semana anterior.` : `Te faltan ${Math.abs(difference)} entrenamientos para igualar la semana anterior.`}</Text>
      </View>

      <View style={styles.metricGrid}>
        <Metric icon="calendar-outline" value={stats.weeklySessions} label="esta semana" />
        <Metric icon="map-outline" value={`${stats.distance.toFixed(1)} km`} label="en 30 días" />
        <Metric icon="time-outline" value={`${Math.round(stats.minutes)} min`} label="en movimiento" />
        <Metric icon="ribbon-outline" value={badges} label="medallas" />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}><Text style={styles.cardTitle}>Tu semana</Text><Text style={styles.small}>{stats.weeklySessions}/7 días activos</Text></View>
        <View style={styles.weekRow}>{DAYS.map((label, index) => { const date = new Date(stats.thisWeek); date.setDate(date.getDate() + index); const active = stats.activeDays.has(dateKey(date)); return <View key={`${label}-${index}`} style={styles.day}><View style={[styles.dayDot, active && styles.dayActive]}>{active && <Ionicons name="checkmark" size={15} color={colors.bg} />}</View><Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{label}</Text></View>; })}</View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumen del mes</Text>
        <SummaryRow icon="repeat-outline" label="Entrenamientos" value={activityMetric('sessions', posts, checkins, { since: new Date(Date.now() - 30 * 86400000) })} />
        <SummaryRow icon="apps-outline" label="Deportes diferentes" value={stats.sports} />
        <SummaryRow icon="trending-up-outline" label="Media por semana" value={(activityMetric('sessions', posts, checkins, { since: new Date(Date.now() - 30 * 86400000) }) / 4.3).toFixed(1)} />
      </View>

      <Pressable style={styles.action} onPress={() => navigation.navigate('TrainingCalendar')}><Ionicons name="calendar" size={20} color={colors.bg} /><View style={{ flex: 1 }}><Text style={styles.actionTitle}>Planificar entrenamientos</Text><Text style={styles.actionText}>Pon fecha a tu próxima sesión.</Text></View><Ionicons name="chevron-forward" size={18} color={colors.bg} /></Pressable>
      <Pressable style={styles.secondary} onPress={() => navigation.navigate('Challenges')}><Ionicons name="trophy-outline" size={19} color={colors.accentStrong} /><Text style={styles.secondaryText}>Ver objetivos, retos y medallas</Text></Pressable>
    </ScrollView>
  );
}

function Metric({ icon, value, label }) { return <View style={styles.metric}><Ionicons name={icon} size={18} color={colors.accentStrong} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.small}>{label}</Text></View>; }
function SummaryRow({ icon, label, value }) { return <View style={styles.summaryRow}><Ionicons name={icon} size={17} color={colors.textDim} /><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 16, paddingBottom: 44, gap: 14 }, center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }, hero: { paddingVertical: 8 }, eyebrow: { color: colors.accentStrong, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, title: { color: colors.text, fontSize: 25, fontWeight: '900', marginTop: 4 }, subtitle: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 5 }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { width: '48%', minHeight: 110, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 14, justifyContent: 'space-between' }, metricValue: { color: colors.text, fontSize: 22, fontWeight: '900' }, small: { color: colors.textDim, fontSize: 11 }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 15, gap: 14 }, cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, cardTitle: { color: colors.text, fontSize: 15, fontWeight: '900' }, weekRow: { flexDirection: 'row', justifyContent: 'space-between' }, day: { alignItems: 'center', gap: 7 }, dayDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }, dayActive: { backgroundColor: colors.accent }, dayLabel: { color: colors.textDim, fontSize: 10, fontWeight: '700' }, dayLabelActive: { color: colors.text }, summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }, summaryLabel: { color: colors.textDim, fontSize: 12, flex: 1 }, summaryValue: { color: colors.text, fontSize: 14, fontWeight: '900' }, action: { backgroundColor: colors.accent, borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 }, actionTitle: { color: colors.bg, fontWeight: '900', fontSize: 14 }, actionText: { color: colors.bg, opacity: 0.75, fontSize: 10, marginTop: 2 }, secondary: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, secondaryText: { color: colors.accentStrong, fontSize: 12, fontWeight: '800' },
});
