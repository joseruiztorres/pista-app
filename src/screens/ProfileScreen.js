import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconForBadge } from '../lib/badges';
import { colors } from '../lib/theme';

export default function ProfileScreen() {
  const { profile, user, signOut } = useAuth();
  const [badges, setBadges] = useState([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0, posts: 0 });

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: badgeRows }, followersRes, followingRes, postsRes] = await Promise.all([
      supabase.from('profile_badges').select('badge_id, badges(*)').eq('profile_id', user.id),
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', user.id),
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
    ]);
    setBadges((badgeRows || []).map((b) => b.badges).filter(Boolean));
    setCounts({ followers: followersRes.count || 0, following: followingRes.count || 0, posts: postsRes.count || 0 });
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(profile?.display_name || profile?.username || '?').slice(0, 2).toUpperCase()}</Text>
      </View>
      <Text style={styles.name}>{profile?.display_name || profile?.username}</Text>
      <Text style={styles.handle}>@{profile?.username}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statValue}>{counts.followers}</Text><Text style={styles.statLabel}>Seguidores</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{counts.following}</Text><Text style={styles.statLabel}>Siguiendo</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{counts.posts}</Text><Text style={styles.statLabel}>Publicaciones</Text></View>
      </View>

      {badges.length > 0 && (
        <View style={styles.badgesRow}>
          {badges.map((b) => (
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', paddingTop: 64, gap: 6 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { color: colors.bg, fontSize: 22, fontWeight: '800' },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  handle: { color: colors.textDim, fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 24, marginTop: 16 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontWeight: '800', fontSize: 16 },
  statLabel: { color: colors.textDim, fontSize: 11 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 18, paddingHorizontal: 24 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24, marginTop: 32 },
  logoutText: { color: colors.clay, fontWeight: '700' },
});
