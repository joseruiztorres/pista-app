import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { activityMetric, dateKey, startOfWeek } from '../lib/engagement';
import { iconFor } from '../lib/sports';
import { levelFromXp } from '../lib/gamification';
import { colors } from '../lib/theme';
import SportLoader from '../components/SportLoader';

export default function WeeklyRecapScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const week = startOfWeek();
    const previous = new Date(week);
    previous.setDate(previous.getDate() - 7);
    const [postsRes, checkinsRes, progressRes, badgesRes, personalRes, sportsRes] = await Promise.all([
      supabase.from('posts').select('sport_id, details, created_at').eq('author_id', user.id).gte('created_at', previous.toISOString()),
      supabase.from('daily_checkins').select('sport_id, check_date').eq('profile_id', user.id).gte('check_date', dateKey(previous)),
      supabase.from('profile_progress').select('*').eq('profile_id', user.id).maybeSingle(),
      supabase.from('profile_badges').select('earned_at, badges(name, icon_key)').eq('profile_id', user.id).gte('earned_at', week.toISOString()),
      supabase.from('personal_challenges').select('*').eq('profile_id', user.id).eq('week_start', dateKey(week)),
      supabase.from('sports').select('id, name'),
    ]);
    const posts = postsRes.data || [];
    const checkins = checkinsRes.data || [];
    const currentPosts = posts.filter((row) => new Date(row.created_at) >= week);
    const currentCheckins = checkins.filter((row) => new Date(`${row.check_date}T23:59:59`) >= week);
    const previousPosts = posts.filter((row) => new Date(row.created_at) < week);
    const previousCheckins = checkins.filter((row) => new Date(`${row.check_date}T23:59:59`) < week);
    const sportCounts = {};
    [...currentPosts, ...currentCheckins].forEach((row) => { if (row.sport_id) sportCounts[row.sport_id] = (sportCounts[row.sport_id] || 0) + 1; });
    const topSportId = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const sportMap = Object.fromEntries((sportsRes.data || []).map((sport) => [sport.id, sport.name]));
    setData({
      week,
      sessions: activityMetric('sessions', currentPosts, currentCheckins),
      previousSessions: activityMetric('sessions', previousPosts, previousCheckins),
      distance: activityMetric('distance_km', currentPosts, currentCheckins),
      minutes: activityMetric('minutes', currentPosts, currentCheckins),
      sports: activityMetric('sports', currentPosts, currentCheckins),
      topSportId,
      topSportName: sportMap[topSportId] || 'Aún por descubrir',
      progress: progressRes.data || null,
      badges: badgesRes.data || [],
      challenges: personalRes.data || [],
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const shareText = useMemo(() => {
    if (!data) return '';
    const level = levelFromXp(Number(data.progress?.xp || 0));
    return `Mi semana en Pista 🏁\n${data.sessions} entrenamientos · ${data.distance.toFixed(1)} km · ${Math.round(data.minutes)} min\nNivel ${level.level} · ${level.name} · ${Number(data.progress?.xp || 0)} XP\n${data.challenges.filter((item) => item.completed_at).length} retos completados · ${data.badges.length} nuevas medallas\n#Pista`;
  }, [data]);

  async function share() {
    await Share.share({ title: 'Mi semana en Pista', message: shareText });
  }

  if (loading || !data) return <View style={styles.center}><SportLoader label="Preparando tu semana" /></View>;
  const difference = data.sessions - data.previousSessions;
  const level = levelFromXp(Number(data.progress?.xp || 0));
  const completedChallenges = data.challenges.filter((item) => item.completed_at).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>SEMANA DEL {data.week.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase()}</Text>
        <Text style={styles.title}>{profile?.display_name?.split(' ')[0] || 'Tu semana'}, esto es lo que has construido</Text>
        <Text style={styles.subtitle}>{difference > 0 ? `Has hecho ${difference} actividades más que la semana anterior.` : difference < 0 ? `Estás a ${Math.abs(difference)} actividades de igualar la semana anterior.` : 'Has mantenido el mismo ritmo que la semana anterior.'}</Text>
      </View>

      <View style={styles.scoreCard}>
        <View><Text style={styles.scoreLabel}>NIVEL {level.level}</Text><Text style={styles.scoreTitle}>{level.name}</Text></View>
        <Text style={styles.scoreXp}>{Number(data.progress?.xp || 0).toLocaleString('es-ES')} XP</Text>
      </View>

      <View style={styles.grid}>
        <Metric icon="checkmark-circle-outline" value={data.sessions} label="entrenamientos" />
        <Metric icon="map-outline" value={`${data.distance.toFixed(1)} km`} label="recorridos" />
        <Metric icon="time-outline" value={Math.round(data.minutes)} label="minutos" />
        <Metric icon="trophy-outline" value={`${completedChallenges}/${data.challenges.length || 3}`} label="retos personales" />
      </View>

      <View style={styles.card}>
        <View style={styles.sportIcon}><Ionicons name={iconFor(data.topSportId)} size={24} color={colors.accentStrong} /></View>
        <View style={{ flex: 1 }}><Text style={styles.cardLabel}>DEPORTE DE LA SEMANA</Text><Text style={styles.cardTitle}>{data.topSportName}</Text><Text style={styles.cardText}>{data.sports} {data.sports === 1 ? 'deporte distinto' : 'deportes distintos'} esta semana</Text></View>
      </View>

      {!!data.badges.length && <View style={styles.cardColumn}><Text style={styles.cardTitle}>Nuevas medallas</Text>{data.badges.map((row, index) => <View key={`${row.badges?.name}-${index}`} style={styles.badgeRow}><Ionicons name={row.badges?.icon_key || 'ribbon-outline'} size={18} color={colors.amber} /><Text style={styles.badgeName}>{row.badges?.name}</Text></View>)}</View>}

      <Pressable style={styles.share} onPress={share}><Ionicons name="share-social-outline" size={19} color={colors.bg} /><Text style={styles.shareText}>Compartir mi semana</Text></Pressable>
      <Pressable style={styles.secondary} onPress={() => navigation.navigate('Challenges')}><Text style={styles.secondaryText}>Ver próximos retos</Text><Ionicons name="arrow-forward" size={15} color={colors.accentStrong} /></Pressable>
    </ScrollView>
  );
}

function Metric({ icon, value, label }) { return <View style={styles.metric}><Ionicons name={icon} size={18} color={colors.accentStrong} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 16, paddingBottom: 48, gap: 14 }, center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingVertical: 7 }, eyebrow: { color: colors.accentStrong, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, title: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: '900', marginTop: 5 }, subtitle: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 7 },
  scoreCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.accent, borderRadius: 20, padding: 17 }, scoreLabel: { color: colors.bg, opacity: 0.72, fontSize: 9, fontWeight: '900' }, scoreTitle: { color: colors.bg, fontSize: 21, fontWeight: '900', marginTop: 2 }, scoreXp: { color: colors.bg, fontSize: 16, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { width: '48%', minHeight: 105, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 14, justifyContent: 'space-between' }, metricValue: { color: colors.text, fontSize: 21, fontWeight: '900' }, metricLabel: { color: colors.textDim, fontSize: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 15 }, sportIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }, cardLabel: { color: colors.accentStrong, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, cardTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 2 }, cardText: { color: colors.textDim, fontSize: 10, marginTop: 3 },
  cardColumn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 15, gap: 10 }, badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }, badgeName: { color: colors.text, fontSize: 12, fontWeight: '700' },
  share: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14 }, shareText: { color: colors.bg, fontSize: 14, fontWeight: '900' }, secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10 }, secondaryText: { color: colors.accentStrong, fontSize: 12, fontWeight: '800' },
});
