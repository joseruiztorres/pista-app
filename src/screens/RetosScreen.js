import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SportLoader from '../components/SportLoader';
import { useAuth } from '../context/AuthProvider';
import { colors, shape } from '../lib/theme';
import { iconForBadge } from '../lib/badges';
import { activityMetric, dateKey, formatMetric, metricLabel, progressPercent, startOfWeek } from '../lib/engagement';
import { awardBadge, checkActivityBadges } from '../lib/awardBadges';
import LevelCard from '../components/LevelCard';

const GOAL_PRESETS = { sessions: [2, 3, 5, 7], distance_km: [5, 10, 20, 50], minutes: [60, 120, 180, 300] };
const DIFFICULTY_ORDER = { facil: 0, normal: 1, dificil: 2, epico: 3 };
const DIFFICULTY_LABEL = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil', epico: 'Épica' };

// Retos simplificado: primero lo que tienes en marcha, luego tu objetivo
// semanal y solo las 3 próximas medallas. El catálogo completo vive en
// la pantalla "Medallas" (BadgesScreen).
export default function RetosScreen({ navigation }) {
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
  const [showBuilder, setShowBuilder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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
    if (error) Alert.alert('No se pudo guardar', error.message); else { setShowBuilder(false); load(); }
  }

  const joined = challenges.filter((c) => members[c.id] && !members[c.id].completed_at);
  const available = challenges.filter((c) => !members[c.id]);
  const completedCount = challenges.filter((c) => members[c.id]?.completed_at).length;
  const earnedCount = Object.keys(earnedIds).length;
  const nextBadges = badges
    .filter((b) => !earnedIds[b.id])
    .sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 1) - (DIFFICULTY_ORDER[b.difficulty] ?? 1) || (a.sort_order || 0) - (b.sort_order || 0))
    .slice(0, 3);

  if (loading) return <View style={styles.center}><SportLoader label="Preparando tus retos" /></View>;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="flame" size={26} color={colors.bg} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>TU RACHA</Text>
          <Text style={styles.heroTitle}>{streak} {streak === 1 ? 'día' : 'días'}</Text>
          <Text style={styles.muted}>Un entrenamiento hoy mantiene la cadena.</Text>
        </View>
      </View>

      <LevelCard progress={levelProgress} compact onPress={() => navigation.navigate('AthleteLevel')} />

      <SectionTitle title="En marcha" />
      {personalChallenges.map((challenge) => {
        const value = activityMetric(challenge.metric, posts, checkins, { since: challenge.starts_at, sportId: challenge.sport_id });
        return <AdaptiveCard key={challenge.id} challenge={challenge} value={value} />;
      })}
      {joined.map((challenge) => {
        const member = members[challenge.id];
        const value = activityMetric(challenge.metric, posts, checkins, { since: member.joined_at, sportId: challenge.sport_id });
        const daysLeft = Math.max(0, challenge.duration_days - Math.floor((Date.now() - new Date(member.joined_at).getTime()) / 86400000));
        return (
          <ActiveCard
            key={challenge.id}
            icon={challenge.icon_key || 'trophy-outline'}
            title={challenge.title}
            points={challenge.points || 100}
            value={value}
            target={challenge.target}
            metric={challenge.metric}
            footnote={`${daysLeft} días restantes`}
          />
        );
      })}
      {!personalChallenges.length && !joined.length && (
        <Text style={styles.empty}>Todavía no tienes retos en marcha. Acepta uno de abajo para empezar.</Text>
      )}

      <SectionTitle title="Objetivo semanal" />
      {goals.map((goal) => {
        const value = activityMetric(goal.metric, posts, checkins, { since: weekStart, sportId: goal.sport_id });
        return <GoalRow key={goal.id} title={metricLabel(goal.metric)} value={value} target={goal.target} metric={goal.metric} />;
      })}
      {showBuilder ? (
        <View style={styles.builder}>
          <Text style={styles.builderTitle}>¿Qué quieres medir esta semana?</Text>
          <View style={styles.chips}>{Object.keys(GOAL_PRESETS).map((metric) => <Chip key={metric} label={metricLabel(metric)} active={goalMetric === metric} onPress={() => { setGoalMetric(metric); setGoalTarget(GOAL_PRESETS[metric][1]); }} />)}</View>
          <View style={styles.chips}>{GOAL_PRESETS[goalMetric].map((target) => <Chip key={target} label={formatMetric(goalMetric, target)} active={goalTarget === target} onPress={() => setGoalTarget(target)} />)}</View>
          <View style={styles.builderActions}>
            <Pressable style={styles.ghost} onPress={() => setShowBuilder(false)}><Text style={styles.ghostText}>Cancelar</Text></Pressable>
            <Pressable style={styles.primary} onPress={saveGoal}><Text style={styles.primaryText}>Guardar objetivo</Text></Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addGoal} onPress={() => setShowBuilder(true)}>
          <Ionicons name="add" size={18} color={colors.accent} />
          <Text style={styles.addGoalText}>{goals.length ? 'Añadir otro objetivo' : 'Ponte un objetivo para esta semana'}</Text>
        </Pressable>
      )}

      <View style={styles.sectionRow}>
        <SectionTitle title="Próximas medallas" />
        <Pressable onPress={() => navigation.navigate('Badges')} hitSlop={8}>
          <Text style={styles.link}>Ver todas · {earnedCount}/{badges.length}</Text>
        </Pressable>
      </View>
      {nextBadges.length ? nextBadges.map((badge) => (
        <View key={badge.id} style={styles.badgeRow}>
          <View style={styles.badgeIcon}><Ionicons name={iconForBadge(badge.id)} size={20} color={colors.textDim} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.badgeTitle}>{badge.name}</Text>
            <Text style={styles.muted}>{badge.description}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[styles.difficulty, styles[`difficulty_${badge.difficulty}`]]}>{DIFFICULTY_LABEL[badge.difficulty] || 'Normal'}</Text>
            <Text style={styles.points}>+{badge.xp_reward || 50} XP</Text>
          </View>
        </View>
      )) : (
        <Text style={styles.empty}>¡Tienes todas las medallas! Nadie corre tanto como tú.</Text>
      )}

      <Pressable style={styles.socialCard} onPress={() => navigation.navigate('SocialChallenges')}>
        <View style={styles.socialIcon}><Ionicons name="people" size={22} color={colors.lane} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.socialTitle}>Retos con amigos</Text>
          <Text style={styles.muted}>Liga semanal y objetivos compartidos.</Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={colors.textDim} />
      </Pressable>

      {available.length > 0 && (
        <>
          <SectionTitle title="Más retos para aceptar" />
          {available.map((challenge) => (
            <View key={challenge.id} style={styles.offer}>
              <View style={styles.offerTop}>
                <Ionicons name={challenge.icon_key || 'trophy-outline'} size={20} color={colors.amber} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{challenge.title}</Text>
                  <Text style={styles.muted}>{challenge.description}</Text>
                </View>
                <Text style={styles.points}>+{challenge.points || 100} XP</Text>
              </View>
              <Pressable style={styles.join} onPress={() => join(challenge)}>
                <Text style={styles.joinText}>Aceptar · {challenge.duration_days} días</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}
      {completedCount > 0 && <Text style={styles.footnote}>Has completado {completedCount} {completedCount === 1 ? 'reto' : 'retos'}. ¡Sigue así!</Text>}
    </ScrollView>
  );
}

function SectionTitle({ title }) { return <Text style={styles.sectionTitle}>{title}</Text>; }
function Chip({ label, active, onPress }) { return <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
function ProgressBar({ percent }) { return <View style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View>; }

function ActiveCard({ icon, title, points, value, target, metric, footnote, done }) {
  return (
    <View style={[styles.challenge, done && styles.completed]}>
      <View style={styles.challengeTop}>
        <View style={styles.roundIcon}><Ionicons name={icon} size={20} color={colors.accent} /></View>
        <Text style={styles.cardTitle}>{title}</Text>
        {done ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : <Text style={styles.points}>+{points} XP</Text>}
      </View>
      <ProgressBar percent={progressPercent(value, target)} />
      <View style={styles.progressMeta}>
        <Text style={styles.progressStrong}>{formatMetric(metric, value)} / {formatMetric(metric, target)}</Text>
        <Text style={styles.muted}>{done ? 'Completado' : footnote}</Text>
      </View>
    </View>
  );
}

function AdaptiveCard({ challenge, value }) {
  return (
    <ActiveCard
      icon={challenge.icon_key || 'sparkles-outline'}
      title={challenge.title}
      points={challenge.points}
      value={value}
      target={challenge.target}
      metric={challenge.metric}
      footnote="Hasta el domingo"
      done={!!challenge.completed_at}
    />
  );
}

function GoalRow({ title, value, target, metric }) {
  const percent = progressPercent(value, target);
  return (
    <View style={styles.goal}>
      <View style={styles.challengeTop}>
        <Ionicons name={percent >= 100 ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={percent >= 100 ? colors.accent : colors.textDim} />
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.progressStrong}>{formatMetric(metric, value)} / {formatMetric(metric, target)}</Text>
      </View>
      <ProgressBar percent={percent} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, gap: 12 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 16 },
  heroIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.amber, ...shape.button },
  eyebrow: { color: colors.amber, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginVertical: 1, letterSpacing: -0.5 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 12, letterSpacing: -0.2 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  link: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  empty: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  footnote: { color: colors.textDim, fontSize: 11, textAlign: 'center', marginTop: 8 },
  builder: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, gap: 11 },
  builderTitle: { color: colors.text, fontWeight: '800' },
  builderActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { backgroundColor: colors.surface2, paddingHorizontal: 11, paddingVertical: 8, ...shape.tag },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: colors.bg },
  primary: { flex: 1, backgroundColor: colors.accent, paddingVertical: 12, alignItems: 'center', ...shape.button },
  primaryText: { color: colors.bg, fontWeight: '900', fontSize: 13 },
  ghost: { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.line, ...shape.button },
  ghostText: { color: colors.textDim, fontWeight: '800', fontSize: 13 },
  addGoal: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, padding: 14, ...shape.button },
  addGoalText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  challenge: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, gap: 11 },
  completed: { borderColor: colors.accent },
  challengeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roundIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '800', flex: 1 },
  muted: { color: colors.textDim, fontSize: 11, lineHeight: 16 },
  goal: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 13, gap: 11 },
  track: { height: 7, backgroundColor: colors.surface2, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: 999 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressStrong: { color: colors.text, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  points: { color: colors.amber, fontSize: 10, fontWeight: '900' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 12 },
  badgeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.textDim },
  badgeTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  difficulty: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textDim },
  difficulty_facil: { color: colors.accent },
  difficulty_normal: { color: colors.amber },
  difficulty_dificil: { color: colors.clay },
  difficulty_epico: { color: colors.lane },
  socialCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, marginTop: 6 },
  socialIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  socialTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: 2 },
  offer: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, gap: 12 },
  offerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  join: { backgroundColor: colors.surface2, alignItems: 'center', paddingVertical: 10, ...shape.button },
  joinText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
});
