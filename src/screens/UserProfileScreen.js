import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconForBadge } from '../lib/badges';
import { colors } from '../lib/theme';
import FollowButton from '../components/FollowButton';
import MessageButton from '../components/MessageButton';
import PostCard from '../components/PostCard';

const POST_SELECT = '*, profiles:author_id(username, display_name), post_media(url, position), comments(count)';

export default function UserProfileScreen({ route, navigation }) {
  const { profileId } = route.params;
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [likedIds, setLikedIds] = useState({});
  const [badges, setBadges] = useState([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profileRow }, { data: postsRows }, { data: badgeRows }, followersRes, followingRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', profileId).maybeSingle(),
      supabase.from('posts').select(POST_SELECT).eq('author_id', profileId).order('created_at', { ascending: false }),
      supabase.from('profile_badges').select('badge_id, badges(*)').eq('profile_id', profileId),
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', profileId),
      supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', profileId),
    ]);
    setProfile(profileRow || null);
    setPosts(postsRows || []);
    setBadges((badgeRows || []).map((b) => b.badges).filter(Boolean));
    setCounts({ followers: followersRes.count || 0, following: followingRes.count || 0 });

    if (user) {
      const { data: likes } = await supabase.from('likes').select('post_id').eq('profile_id', user.id);
      const map = {};
      (likes || []).forEach((l) => { map[l.post_id] = true; });
      setLikedIds(map);
    }
    setLoading(false);
  }, [profileId, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    navigation.setOptions({ title: profile?.display_name || profile?.username || 'Perfil' });
  }, [navigation, profile]);

  async function toggleLike(post) {
    if (!user) return;
    if (likedIds[post.id]) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('profile_id', user.id);
      setLikedIds((m) => ({ ...m, [post.id]: false }));
    } else {
      await supabase.from('likes').insert({ post_id: post.id, profile_id: user.id });
      setLikedIds((m) => ({ ...m, [post.id]: true }));
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  }

  if (!profile) {
    return <View style={styles.center}><Text style={{ color: colors.textDim }}>No se encontró este perfil.</Text></View>;
  }

  return (
    <FlatList
      style={styles.screen}
      data={posts}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      ListEmptyComponent={<Text style={styles.empty}>Todavía no ha publicado nada.</Text>}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          liked={!!likedIds[item.id]}
          onToggleLike={() => toggleLike(item)}
          onPressComments={(postId) => navigation.navigate('PostDetail', { postId })}
        />
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile.display_name || profile.username || '?').slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{profile.display_name || profile.username}</Text>
          <Text style={styles.handle}>@{profile.username}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statValue}>{counts.followers}</Text><Text style={styles.statLabel}>Seguidores</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{counts.following}</Text><Text style={styles.statLabel}>Siguiendo</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{posts.length}</Text><Text style={styles.statLabel}>Publicaciones</Text></View>
          </View>

          <View style={styles.actionsRow}>
            <FollowButton profileId={profile.id} />
            <MessageButton profileId={profile.id} profileName={profile.display_name || profile.username} />
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
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 20 },
  header: { alignItems: 'center', gap: 6, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 4 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { color: colors.bg, fontSize: 22, fontWeight: '800' },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  handle: { color: colors.textDim, fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 24, marginTop: 12, marginBottom: 4 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontWeight: '800', fontSize: 16 },
  statLabel: { color: colors.textDim, fontSize: 11 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
});
