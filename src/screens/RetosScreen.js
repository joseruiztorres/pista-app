import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SportLoader from '../components/SportLoader';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';
import { iconForBadge } from '../lib/badges';
import { activityMetric, dateKey, formatMetric, metricLabel, progressPercent, startOfWeek } from '../lib/engagement';
import { awardBadge, checkActivityBadges } from '../lib/awardBadges';
import LevelCard from '../components/LevelCard';

const GOAL_PRESETS = { sessions: [2, 3, 5, 7], distance_km: [5, 10, 20, 50], minutes: [60, 120, 180, 300] };

export default function RetosScreen() {
  const { user } = useAuth();
  const [badges, setBadges] = useState([]);
  const [earnedIds, setEarnedIds] = useState({});
  const [streak, setStreak] = useState(0);
  const [challenges, setChallenges] = useState([]);
  const [members, setMembers] = useState({});
  const [goals, setGoals] = useState([]);
  const [posts, setPosts] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [goalMetric, setGoalMetric] = useState('sessions');
  const [goalTarget, setGoalTarget] = useState(3);
  const [loading, setLoading] = useState(true);
  const [levelProgress, setLevelProgress] = useState(null);
  const [personalChallenges, setPersonalChallenges] = useState([]);
  const weekStart = useMemo(() => startOfWeek(), []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const gamification = await checkActivityBadges(user.id).catch(() => null);
    const historyStart = new Date();
    historyStart.setDate(historyStart.getDate() - 90);
    const [badgesRes, earnedRes, streakRes, challengesRes, membersRes, goalsRes, postsRes, checkinsRes] = await Promise.all([
      supabase.from('badges').select('*').order('sort_order'),
      supabase.from('profile_badges').select('badge_id').eq('profile_id', user.id),
      supabase.rpc('current_streak', { p_profile_id: user.id }),
      supabase.from('challenges').select('*').eq('active', true).eq('is_template', false).order('created_at'),
      supabase.from('challenge_members').select('*').eq('profile_id', user.id),
      supabase.from('weekly_goals').select('*').eq('profile_id', user.id).eq('week_start', dateKey(weekStart)).order('created_at'),
      supabase.from('posts').select('sport_id, details, created_at').eq('author_id', user.id).gte('created_at', historyStart.toISOString()),
      supabase.from('daily_checkins').select('sport_id, check_date').eq('profile_id', user.id).gte('check_date', dateKey(historyStart)),
    ]);
    const nextMembers = {};
    (membersRes.data || []).forEach((row) => { nextMembers[row.challenge_id] = row; });
    const earned = {};
    (earnedRes.data || []).forEach((row) => { earned[row.badge_id] = true; });
    setBadges(badgesRes.data || []);
    setEarnedIds(earned);
    setStreak(streakRes.data || 0);
    setChallenges(challengesRes.data || []);
    setMembers(nextMembers);
    setGoals(goalsRes.data || []);
    setPosts(postsRes.data || []);
    setCheckins(checkinsRes.data || []);
    setLevelProgress(gamification?.progress || null);
    setPersonalChallenges(gamification?.personal || []);
    setLoading(false);
  }, [user, weekStart]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (loading || !user) return;
    const completed = challenges.filter((challenge) => {
      const member = members[challenge.id];
      if (!member || member.completed_at) return false;
      return activityMetric(challenge.metric, posts, checkins, { since: member.joined_at, sportId: challenge.sport_id }) >= Number(challenge.target);
    });
    if (!completed.length) return;
    Promise.all(completed.map(async (challenge) => {
      await supabase.from('challenge_members').update({ completed_at: new Date().toISOString() }).eq('profile_id', user.id).eq('challenge_id', challenge.id);
      await awardBadge(user.id, challenge.badge_id);
    })).then(load);
  }, [challenges, checkins, loading, load, members, posts, user]);

  async function join(challenge) {
    const { error } = await supabase.from('challenge_members').insert({ profile_id: user.id, challenge_id: challenge.id });
    if (error) Alert.alert('No se pudo aceptar el reto', error.message); else load();
  }

  async function saveGoal() {
    const { error } = await supabase.from('weekly_goals').upsert({ profile_id: user.id, metric: goalMetric, target: goalTarget, week_start: dateKey(weekStart) }, { onConflict: 'profile_id,metric,week_start' });
    if (error) Alert.alert('No se pudo guardar', error.message); else load();
  }

  async function refreshBadges() { await checkActivityBadges(user.id); load(); }

  if (loading) return <View style={styles.center}><SportLoader label="Preparando tus retos" /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="flame" size={28} color={colors.amber} /></View>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>TU IMPULSO</Text><Text style={styles.heroTitle}>{streak} {streak === 1 ? 'día' : 'días'} de racha</Text><Text style={styles.muted}>Un entrenamiento hoy mantiene la cadena.</Text></View>
      </View>

      <LevelCard progress={levelProgress} compact />

      <Pressable style={styles.socialCard} onPress={() => navigation.navigate('SocialChallenges')}>
        <View style={styles.socialIcon}><Ionicons name="people" size={24} color={colors.amber} /></View>
        <View style={{ flex: 1 }}><Text style={styles.socialEyebrow}>NUEVO · RETOS SOCIALES</Text><Text style={styles.socialTitle}>Compite o forma equipo</Text><Text style={styles.muted}>Liga semanal, objetivos compartidos y XP con amigos.</Text></View>
        <Ionicons name="chevron-forward" size={19} color={colors.textDim} />
      </Pressable>

      <SectionTitle icon="sparkles-outline" title="Hechos para ti esta semana" />
      <Text style={styles.sectionIntro}>Se ajustan automáticamente a tu ritmo reciente. Cada lunes tendrás tres nuevos.</Text>
      {personalChallenges.map((challenge) => {
        const value = activityMetric(challenge.metric, posts, checkins, { since: challenge.starts_at, sportId: challenge.sport_id });
        return <AdaptiveCard key={challenge.id} challenge={challenge} value={value} />;
      })}

      <SectionTitle icon="flag-outline" title="Objetivos de esta semana" />
      {goals.map((goal) => {
        const value = activityMetric(goal.metric, posts, checkins, { since: weekStart, sportId: goal.sport_id });
        return <ProgressCard key={goal.id} title={metricLabel(goal.metric)} value={value} target={goal.target} metric={goal.metric} />;
      })}
      <View style={styles.builder}>
        <Text style={styles.builderTitle}>Añade un objetivo</Text>
        <View style={styles.chips}>{Object.keys(GOAL_PRESETS).map((metric) => <Chip key={metric} label={metricLabel(metric)} active={goalMetric === metric} onPress={() => { setGoalMetric(metric); setGoalTarget(GOAL_PRESETS[metric][1]); }} />)}</View>
        <View style={styles.chips}>{GOAL_PRESETS[goalMetric].map((target) => <Chip key={target} label={formatMetric(goalMetric, target)} active={goalTarget === target} onPress={() => setGoalTarget(target)} />)}</View>
        <Pressable style={styles.primary} onPress={saveGoal}><Text style={styles.primaryText}>Guardar objetivo semanal</Text></Pressable>
      </View>

      <SectionTitle icon="trophy-outline" title="Retos para ti" />
      {challenges.map((challenge) => {
        const member = members[challenge.id];
        const value = member ? activityMetric(challenge.metric, posts, checkins, { since: member.joined_at, sportId: challenge.sport_id }) : 0;
        const daysLeft = member ? Math.max(0, challenge.duration_days - Math.floor((Date.now() - new Date(member.joined_at).getTime()) / 86400000)) : challenge.duration_days;
        return (
          <View key={challenge.id} style={[styles.challenge, member?.completed_at && styles.completed]}>
            <View style={styles.challengeTop}><View style={styles.roundIcon}><Ionicons name={challenge.icon_key || 'trophy-outline'} size={22} color={colors.amber} /></View><View style={{ flex: 1 }}><View style={styles.titleLine}><Text style={styles.cardTitle}>{challenge.title}</Text><Text style={styles.points}>+{challenge.points || 100} XP</Text></View><Text style={styles.muted}>{challenge.description}</Text></View>{member?.completed_at && <Ionicons name="checkmark-circle" size={24} color={colors.accentStrong} />}</View>
            {member ? <><ProgressBar percent={progressPercent(value, challenge.target)} /><View style={styles.progressMeta}><Text style={styles.progressStrong}>{formatMetric(challenge.metric, value)} / {formatMetric(challenge.metric, challenge.target)}</Text><Text style={styles.muted}>{member.completed_at ? 'Completado' : `${daysLeft} días restantes`}</Text></View></> : <Pressable style={styles.join} onPress={() => join(challenge)}><Text style={styles.joinText}>Aceptar reto · {challenge.duration_days} días</Text></Pressable>}
          </View>
        );
      })}

      <View style={styles.sectionTitleRow}><SectionTitle icon="ribbon-outline" title="Medallas" /><Pressable onPress={refreshBadges}><Text style={styles.link}>Actualizar</Text></Pressable></View>
      <Text style={styles.sectionIntro}>{Object.keys(earnedIds).length} de {badges.length} conseguidas · las épicas necesitan meses de constancia.</Text>
      <View style={styles.badgeGrid}>{badges.map((badge) => { const earned = !!earnedIds[badge.id]; return <View key={badge.id} style={[styles.badge, !earned && styles.locked]}><View style={styles.badgeTop}><Ionicons name={earned ? iconForBadge(badge.id) : 'lock-closed-outline'} size={24} color={earned ? colors.amber : colors.textDim} /><Text style={[styles.difficulty, styles[`difficulty_${badge.difficulty}`]]}>{badge.difficulty || 'normal'}</Text></View><Text style={styles.badgeTitle}>{badge.name}</Text><Text style={styles.badgeDesc}>{badge.description}</Text><Text style={styles.badgeXp}>+{badge.xp_reward || 50} XP</Text></View>; })}</View>
    </ScrollView>
  );
}

function SectionTitle({ icon, title }) { return <View style={styles.section}><Ionicons name={icon} size={18} color={colors.accentStrong} /><Text style={styles.sectionTitle}>{title}</Text></View>; }
function Chip({ label, active, onPress }) { return <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
function ProgressBar({ percent }) { return <View style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View>; }
function ProgressCard({ title, value, target, metric }) { const percent = progressPercent(value, target); return <View style={styles.goal}><View style={styles.challengeTop}><Ionicons name={percent >= 100 ? 'checkmark-circle' : 'checkmark-circle-outline'} size={22} color={percent >= 100 ? colors.accentStrong : colors.textDim} /><Text style={styles.cardTitle}>{title}</Text><Text style={styles.progressStrong}>{formatMetric(metric, value)} / {formatMetric(metric, target)}</Text></View><ProgressBar percent={percent} /></View>; }
function AdaptiveCard({ challenge, value }) { const complete = !!challenge.completed_at; return <View style={[styles.challenge, complete && styles.completed]}><View style={styles.challengeTop}><View style={styles.roundIcon}><Ionicons name={challenge.icon_key || 'sparkles-outline'} size={22} color={colors.accentStrong} /></View><View style={{ flex: 1 }}><View style={styles.titleLine}><Text style={styles.cardTitle}>{challenge.title}</Text><Text style={styles.points}>+{challenge.points} XP</Text></View><Text style={styles.muted}>{challenge.description}</Text></View>{complete && <Ionicons name="checkmark-circle" size={24} color={colors.accentStrong} />}</View><ProgressBar percent={progressPercent(value, challenge.target)} /><View style={styles.progressMeta}><Text style={styles.progressStrong}>{formatMetric(challenge.metric, value)} / {formatMetric(challenge.metric, challenge.target)}</Text><Text style={styles.muted}>{complete ? 'Completado' : 'Hasta el domingo'}</Text></View></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 16, paddingBottom: 48, gap: 12 }, center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }, hero: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 16 }, heroIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 }, eyebrow: { color: colors.accentStrong, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, heroTitle: { color: colors.text, fontSize: 21, fontWeight: '900', marginVertical: 2 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }, sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' }, sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, link: { color: colors.accentStrong, fontSize: 12, fontWeight: '800' }, builder: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, gap: 11 }, builderTitle: { color: colors.text, fontWeight: '800' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 }, chipActive: { backgroundColor: colors.accent }, chipText: { color: colors.textDim, fontSize: 11, fontWeight: '700' }, chipTextActive: { color: colors.bg }, primary: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 12, alignItems: 'center' }, primaryText: { color: colors.bg, fontWeight: '900', fontSize: 13 },
  challenge: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, gap: 12 }, completed: { borderColor: colors.accent }, challengeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, roundIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }, cardTitle: { color: colors.text, fontSize: 14, fontWeight: '800', flex: 1 }, muted: { color: colors.textDim, fontSize: 11, lineHeight: 16 }, join: { backgroundColor: colors.surface2, borderRadius: 999, alignItems: 'center', paddingVertical: 10 }, joinText: { color: colors.accentStrong, fontSize: 12, fontWeight: '800' }, goal: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 13, gap: 11 }, track: { height: 7, backgroundColor: colors.surface2, borderRadius: 999, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.accent, borderRadius: 999 }, progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, progressStrong: { color: colors.text, fontSize: 11, fontWeight: '800' }, badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, badge: { width: '48%', minHeight: 142, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 13, gap: 6 }, locked: { opacity: 0.48 }, badgeTitle: { color: colors.text, fontSize: 13, fontWeight: '800' }, badgeDesc: { color: colors.textDim, fontSize: 10, lineHeight: 14 },
  sectionIntro: { color: colors.textDim, fontSize: 11, lineHeight: 16, marginTop: -5 }, titleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 }, points: { color: colors.amber, fontSize: 9, fontWeight: '900' }, badgeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, difficulty: { fontSize: 8, fontWeight: '900', textTransform: 'uppercase', color: colors.textDim }, difficulty_facil: { color: colors.accentStrong }, difficulty_normal: { color: colors.amber }, difficulty_dificil: { color: colors.clay }, difficulty_epico: { color: '#C9A7FF' }, badgeXp: { color: colors.amber, fontSize: 9, fontWeight: '900', marginTop: 'auto' },
  socialCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.amber, borderRadius: 18, padding: 14 }, socialIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 }, socialEyebrow: { color: colors.amber, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, socialTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginVertical: 2 },
});
