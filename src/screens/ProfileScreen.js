import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconForBadge } from '../lib/badges';
import Avatar from '../components/Avatar';
import { colors, shape } from '../lib/theme';
import HighlightsRow from '../components/HighlightsRow';
import LevelCard from '../components/LevelCard';
import { checkActivityBadges } from '../lib/awardBadges';

export default function ProfileScreen({ navigation }) {
  const { profile, user, signOut } = useAuth();
  const [badges, setBadges] = useState([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0, posts: 0 });
  const [pendingRequests, setPendingRequests] = useState(0);
  const [progress, setProgress] = useState({ streak: 0, week: 0, meetups: 0 });
  const [levelProgress, setLevelProgress] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    const gamification = await checkActivityBadges(user.id).catch(() => null);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const [{ data: badgeRows }, followersRes, followingRes, postsRes, requestsRes, streakRes, weekRes, meetupsRes] = await Promise.all([
      supabase.from('profile_badges').select('badge_id, badges(*)').eq('profile_id', user.id),
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', user.id).eq('pending', false),
      supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', user.id).eq('pending', false),
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', user.id).eq('pending', true),
      supabase.rpc('current_streak', { p_profile_id: user.id }),
      supabase.from('daily_checkins').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).gte('check_date', weekStart.toISOString().slice(0, 10)),
      supabase.from('meetup_attendees').select('meetup_id', { count: 'exact', head: true }).eq('profile_id', user.id),
    ]);
    setBadges((badgeRows || []).map((b) => b.badges).filter(Boolean));
    setCounts({ followers: followersRes.count || 0, following: followingRes.count || 0, posts: postsRes.count || 0 });
    setPendingRequests(requestsRes.count || 0);
    setProgress({ streak: streakRes.data || 0, week: weekRes.count || 0, meetups: meetupsRes.count || 0 });
    setLevelProgress(gamification?.progress || null);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Avatar url={profile?.avatar_url} name={profile?.display_name || profile?.username} size={72} />
      <Text style={styles.name}>{profile?.display_name || profile?.username}</Text>
      <Text style={styles.handle}>@{profile?.username}</Text>
      {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}

      <View style={styles.editRow}>
        <Pressable style={styles.editBtn} onPress={() => navigation.navigate('EditProfile')}>
          <Ionicons name="create-outline" size={14} color={colors.accentStrong} />
          <Text style={styles.editBtnText}>Editar perfil</Text>
        </Pressable>
        <Pressable style={styles.editBtn} onPress={() => navigation.navigate('StoryPrivacy')}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.accentStrong} />
          <Text style={styles.editBtnText}>Historias</Text>
        </Pressable>
        {profile?.is_private && (
          <Pressable style={styles.editBtn} onPress={() => navigation.navigate('FollowRequests')}>
            <Ionicons name="person-add-outline" size={14} color={colors.accentStrong} />
            <Text style={styles.editBtnText}>Solicitudes{pendingRequests > 0 ? ` (${pendingRequests})` : ''}</Text>
          </Pressable>
        )}
        {profile?.is_admin && (
          <Pressable style={styles.editBtn} onPress={() => navigation.navigate('AdminReports')}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.accentStrong} />
            <Text style={styles.editBtnText}>Reportes</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statValue}>{counts.followers}</Text><Text style={styles.statLabel}>Seguidores</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{counts.following}</Text><Text style={styles.statLabel}>Siguiendo</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{counts.posts}</Text><Text style={styles.statLabel}>Publicaciones</Text></View>
      </View>

      <View style={styles.levelWrap}><LevelCard progress={levelProgress} compact onPress={() => navigation.navigate('AthleteLevel')} /></View>

      <Pressable style={styles.progressCard} onPress={() => navigation.navigate('Progress')}>
        <View style={styles.progressTitleRow}>
          <Ionicons name="pulse-outline" size={17} color={colors.accentStrong} />
          <Text style={styles.progressTitle}>Tu progreso</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
        </View>
        <View style={styles.progressStats}>
          <View style={styles.progressStat}><Text style={styles.progressValue}>{progress.streak}</Text><Text style={styles.progressLabel}>días de racha</Text></View>
          <View style={styles.progressStat}><Text style={styles.progressValue}>{progress.week}/7</Text><Text style={styles.progressLabel}>esta semana</Text></View>
          <View style={styles.progressStat}><Text style={styles.progressValue}>{progress.meetups}</Text><Text style={styles.progressLabel}>quedadas</Text></View>
        </View>
      </Pressable>

      <View style={styles.quickRow}>
        <Pressable style={styles.quickAction} onPress={() => navigation.navigate('Challenges')}>
          <Ionicons name="trophy-outline" size={18} color={colors.amber} />
          <Text style={styles.quickText}>Retos y medallas</Text>
        </Pressable>
        <Pressable style={styles.quickAction} onPress={() => navigation.navigate('TrainingCalendar')}>
          <Ionicons name="calendar-outline" size={18} color={colors.accentStrong} />
          <Text style={styles.quickText}>Calendario</Text>
        </Pressable>
        <Pressable style={[styles.quickAction, styles.routeAction]} onPress={() => navigation.navigate('Routes')}>
          <Ionicons name="map-outline" size={18} color={colors.accentStrong} />
          <Text style={styles.quickText}>Mis rutas</Text>
        </Pressable>
        <Pressable style={[styles.quickAction, styles.routeAction]} onPress={() => navigation.navigate('WeeklyRecap')}>
          <Ionicons name="share-social-outline" size={18} color={colors.amber} />
          <Text style={styles.quickText}>Mi resumen semanal</Text>
        </Pressable>
      </View>

      <HighlightsRow profileId={user?.id} isMine navigation={navigation} />

      {badges.length > 0 && (
        <View style={styles.badgesRow}>
          {badges.slice(0, 6).map((b) => (
            <View key={b.id} style={styles.badge}>
              <Ionicons name={iconForBadge(b.id)} size={16} color={colors.amber} />
              <Text style={styles.badgeText}>{b.name}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable style={styles.logout} onPress={signOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.clay} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 16, paddingBottom: 42, gap: 6 },
  name: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  handle: { color: colors.textDim, fontSize: 13 },
  bio: { color: colors.text, fontSize: 13, textAlign: 'center', paddingHorizontal: 32, marginTop: 6 },
  editRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editBtnText: { color: colors.accentStrong, fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 24, marginTop: 16 },
  levelWrap: { width: '100%', marginTop: 18 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontWeight: '800', fontSize: 16 },
  statLabel: { color: colors.textDim, fontSize: 11 },
  progressCard: { width: '100%', marginTop: 8, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 12 },
  progressTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  progressTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  progressStats: { flexDirection: 'row', justifyContent: 'space-around' },
  progressStat: { alignItems: 'center', flex: 1 },
  progressValue: { color: colors.accentStrong, fontSize: 18, fontWeight: '900' },
  progressLabel: { color: colors.textDim, fontSize: 10, marginTop: 2 },
  quickRow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  quickAction: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingVertical: 11 },
  routeAction: {},
  quickText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 18, paddingHorizontal: 24 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.line, ...shape.button, paddingVertical: 12, paddingHorizontal: 24, marginTop: 32 },
  logoutText: { color: colors.clay, fontWeight: '700' },
});
