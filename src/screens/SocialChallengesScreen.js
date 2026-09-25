import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { colors, shape } from '../lib/theme';
import { formatMetric, progressPercent } from '../lib/engagement';
import { queueCelebrations } from '../lib/celebrations';
import Avatar from '../components/Avatar';
import SportLoader from '../components/SportLoader';

export default function SocialChallengesScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [challenges, setChallenges] = useState([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [leagueRes, membershipRes] = await Promise.all([
      supabase.rpc('weekly_leaderboard'),
      supabase.from('social_challenge_members')
        .select('status, challenge:social_challenges(*)')
        .eq('profile_id', user.id)
        .neq('status', 'declined')
        .order('created_at', { ascending: false }),
    ]);
    if (leagueRes.error) console.warn('weekly_leaderboard', leagueRes.error.message);
    if (membershipRes.error) console.warn('social_challenges', membershipRes.error.message);
    const rows = (membershipRes.data || []).filter((row) => row.challenge);
    const hydrated = await Promise.all(rows.map(async (row) => {
      let challenge = row.challenge;
      if (row.status === 'accepted' && row.challenge.status === 'active') {
        const { data: claimed } = await supabase.rpc('claim_social_challenge', { p_challenge_id: row.challenge.id });
        if (claimed?.completed) challenge = { ...challenge, status: 'completed' };
        if (claimed?.rewarded) {
          await queueCelebrations(user.id, [{ type: 'challenge', id: `social-${row.challenge.id}`, name: row.challenge.title, description: 'Habéis completado el reto social.', icon: row.challenge.mode === 'team' ? 'people' : 'podium', xp: claimed.points }]);
        }
      }
      const { data: progress } = await supabase.rpc('social_challenge_progress', { p_challenge_id: row.challenge.id });
      return { ...challenge, myStatus: row.status, participants: progress || [] };
    }));
    setLeaderboard(leagueRes.data || []);
    setChallenges(hydrated);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function respond(challengeId, accept) {
    const { error } = await supabase.rpc('respond_social_challenge', { p_challenge_id: challengeId, p_accept: accept });
    if (error) Alert.alert('No se pudo responder', error.message); else load();
  }

  if (loading) return <View style={styles.center}><SportLoader label="Preparando la liga" /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="people" size={28} color={colors.amber} /></View>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>ENTRE AMIGOS</Text><Text style={styles.heroTitle}>Juntos cuesta menos</Text><Text style={styles.muted}>Compite, forma equipo y sumad actividad real.</Text></View>
      </View>

      <Pressable style={styles.primary} onPress={() => navigation.navigate('CreateSocialChallenge')}>
        <Ionicons name="add-circle-outline" size={18} color={colors.bg} /><Text style={styles.primaryText}>Crear un reto con amigos</Text>
      </Pressable>

      <SectionTitle icon="podium-outline" title="Liga de esta semana" />
      <Text style={styles.intro}>Entrenamientos, kilómetros y minutos dan puntos. Se reinicia cada lunes.</Text>
      <View style={styles.league}>
        {leaderboard.map((item) => <LeagueRow key={item.profile_id} item={item} mine={item.profile_id === user.id} />)}
      </View>

      <SectionTitle icon="flag-outline" title="Tus retos sociales" />
      {!challenges.length && (
        <View style={styles.empty}><Ionicons name="people-outline" size={30} color={colors.textDim} /><Text style={styles.emptyTitle}>Todavía no hay retos compartidos</Text><Text style={styles.muted}>Invita a alguien y convierte el próximo entrenamiento en un objetivo común.</Text></View>
      )}
      {challenges.map((challenge) => (
        <ChallengeCard key={challenge.id} challenge={challenge} onRespond={respond} />
      ))}
    </ScrollView>
  );
}

function LeagueRow({ item, mine }) {
  const medal = Number(item.rank) <= 3 ? ['🥇', '🥈', '🥉'][Number(item.rank) - 1] : `${item.rank}.`;
  return <View style={[styles.leagueRow, mine && styles.mine]}><Text style={styles.rank}>{medal}</Text><Avatar url={item.avatar_url} name={item.display_name || item.username} size={36} /><View style={{ flex: 1 }}><Text style={styles.name}>{item.display_name || item.username}{mine ? ' · Tú' : ''}</Text><Text style={styles.leagueMeta}>{item.sessions} sesiones · {Number(item.distance_km).toFixed(1)} km · {Math.round(item.minutes)} min</Text></View><Text style={styles.score}>{Math.round(item.score)} pt</Text></View>;
}

function ChallengeCard({ challenge, onRespond }) {
  const accepted = challenge.participants.filter((item) => item.member_status === 'accepted');
  const total = accepted.reduce((sum, item) => sum + Number(item.progress || 0), 0);
  const days = Math.max(0, Math.ceil((new Date(challenge.ends_at) - Date.now()) / 86400000));
  const statusLabel = challenge.status === 'completed' ? 'Completado' : challenge.status === 'expired' ? 'Finalizado' : `${days} días`;
  if (challenge.myStatus === 'invited') {
    return <View style={[styles.card, styles.invite]}><View style={styles.cardTop}><View style={styles.roundIcon}><Ionicons name={challenge.mode === 'team' ? 'people-outline' : 'flash-outline'} size={22} color={colors.amber} /></View><View style={{ flex: 1 }}><Text style={styles.inviteLabel}>TE HAN RETADO</Text><Text style={styles.cardTitle}>{challenge.title}</Text><Text style={styles.muted}>{challenge.mode === 'team' ? 'Todos sumáis para llegar al objetivo.' : 'Gana quien llegue primero.'}</Text></View></View><View style={styles.actions}><Pressable style={styles.decline} onPress={() => onRespond(challenge.id, false)}><Text style={styles.declineText}>Ahora no</Text></Pressable><Pressable style={styles.accept} onPress={() => onRespond(challenge.id, true)}><Text style={styles.acceptText}>Aceptar reto</Text></Pressable></View></View>;
  }
  return (
    <View style={[styles.card, challenge.status === 'completed' && styles.completed]}>
      <View style={styles.cardTop}><View style={styles.roundIcon}><Ionicons name={challenge.mode === 'team' ? 'people-outline' : 'flash-outline'} size={22} color={challenge.status === 'completed' ? colors.accentStrong : colors.amber} /></View><View style={{ flex: 1 }}><View style={styles.titleLine}><Text style={styles.cardTitle}>{challenge.title}</Text><Text style={styles.points}>+{challenge.reward_xp} XP</Text></View><Text style={styles.muted}>{challenge.mode === 'team' ? 'Objetivo común · todo suma' : 'Competición · gana quien llegue primero'}</Text></View></View>
      {challenge.mode === 'team' && <><Progress value={total} target={challenge.target} /><View style={styles.progressMeta}><Text style={styles.strong}>{formatMetric(challenge.metric, total)} / {formatMetric(challenge.metric, challenge.target)}</Text><Text style={styles.muted}>{statusLabel}</Text></View></>}
      <View style={styles.people}>{accepted.sort((a, b) => Number(b.progress) - Number(a.progress)).map((person, index) => <View key={person.profile_id} style={styles.person}><Text style={styles.personRank}>{challenge.mode === 'race' ? `${index + 1}` : '•'}</Text><Avatar url={person.avatar_url} name={person.display_name || person.username} size={28} /><Text style={styles.personName}>{person.display_name || person.username}</Text><Text style={styles.personProgress}>{formatMetric(challenge.metric, person.progress)}</Text></View>)}</View>
      {challenge.mode === 'race' && <View style={styles.progressMeta}><Text style={styles.strong}>Meta: {formatMetric(challenge.metric, challenge.target)}</Text><Text style={styles.muted}>{statusLabel}</Text></View>}
    </View>
  );
}

function Progress({ value, target }) { return <View style={styles.track}><View style={[styles.fill, { width: `${progressPercent(value, target)}%` }]} /></View>; }
function SectionTitle({ icon, title }) { return <View style={styles.section}><Ionicons name={icon} size={19} color={colors.accentStrong} /><Text style={styles.sectionTitle}>{title}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 16, paddingBottom: 50, gap: 12 }, center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 16 }, heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }, eyebrow: { color: colors.accentStrong, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, heroTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginVertical: 2 }, muted: { color: colors.textDim, fontSize: 11, lineHeight: 16 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, ...shape.button, paddingVertical: 13 }, primaryText: { color: colors.bg, fontSize: 13, fontWeight: '900' }, section: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }, sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' }, intro: { color: colors.textDim, fontSize: 11, lineHeight: 16, marginTop: -6 },
  league: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, overflow: 'hidden' }, leagueRow: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, mine: { backgroundColor: colors.surface2 }, rank: { width: 25, color: colors.text, fontWeight: '900', textAlign: 'center' }, name: { color: colors.text, fontSize: 12, fontWeight: '800' }, leagueMeta: { color: colors.textDim, fontSize: 9, marginTop: 2 }, score: { color: colors.amber, fontSize: 11, fontWeight: '900' },
  empty: { alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 24, gap: 7 }, emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '800' }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, gap: 12 }, invite: { borderColor: colors.amber }, completed: { borderColor: colors.accent }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, roundIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }, inviteLabel: { color: colors.amber, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, cardTitle: { color: colors.text, fontSize: 14, fontWeight: '900', flex: 1 }, titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 }, points: { color: colors.amber, fontSize: 9, fontWeight: '900' },
  track: { height: 8, borderRadius: 999, backgroundColor: colors.surface2, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.accent, borderRadius: 999 }, progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, strong: { color: colors.text, fontSize: 11, fontWeight: '800' }, people: { gap: 7 }, person: { flexDirection: 'row', alignItems: 'center', gap: 8 }, personRank: { color: colors.textDim, width: 14, fontSize: 10, fontWeight: '900' }, personName: { flex: 1, color: colors.text, fontSize: 11, fontWeight: '700' }, personProgress: { color: colors.accentStrong, fontSize: 10, fontWeight: '900' }, actions: { flexDirection: 'row', gap: 8 }, decline: { flex: 1, alignItems: 'center', backgroundColor: colors.surface2, ...shape.button, paddingVertical: 10 }, declineText: { color: colors.textDim, fontSize: 12, fontWeight: '800' }, accept: { flex: 1.4, alignItems: 'center', backgroundColor: colors.accent, ...shape.button, paddingVertical: 10 }, acceptText: { color: colors.bg, fontSize: 12, fontWeight: '900' },
});
