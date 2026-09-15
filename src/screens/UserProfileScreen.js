import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SportLoader from '../components/SportLoader';
import { useAuth } from '../context/AuthProvider';
import { iconForBadge } from '../lib/badges';
import { colors } from '../lib/theme';
import FollowButton from '../components/FollowButton';
import MessageButton from '../components/MessageButton';
import PostCard from '../components/PostCard';
import Avatar from '../components/Avatar';

const POST_SELECT = '*, profiles:author_id(username, display_name), post_media(url, position), comments(count)';

export default function UserProfileScreen({ route, navigation }) {
  const { profileId } = route.params;
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [likedIds, setLikedIds] = useState({});
  const [badges, setBadges] = useState([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profileRow }, { data: badgeRows }, followersRes, followingRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', profileId).maybeSingle(),
      supabase.from('profile_badges').select('badge_id, badges(*)').eq('profile_id', profileId),
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', profileId).eq('pending', false),
      supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', profileId).eq('pending', false),
    ]);
    setProfile(profileRow || null);
    setBadges((badgeRows || []).map((b) => b.badges).filter(Boolean));
    setCounts({ followers: followersRes.count || 0, following: followingRes.count || 0 });

    let following = false;
    if (user) {
      const { data: followRow } = await supabase.from('follows').select('pending')
        .eq('follower_id', user.id).eq('following_id', profileId).eq('pending', false).maybeSingle();
      following = !!followRow;
      setIsFollowing(following);
    }

    // RLS ya oculta las publicaciones si el perfil es privado y no le sigues,
    // o si hay un bloqueo de por medio — no hace falta comprobarlo aquí también.
    const { data: postsRows } = await supabase.from('posts').select(POST_SELECT)
      .eq('author_id', profileId).order('created_at', { ascending: false });
    setPosts(postsRows || []);

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
    return <View style={styles.center}><SportLoader /></View>;
  }

  if (!profile) {
    return <View style={styles.center}><Text style={{ color: colors.textDim }}>No se encontró este perfil.</Text></View>;
  }

  const isMine = user?.id === profile.id;
  const showPrivateGate = profile.is_private && !isMine && !isFollowing;

  return (
    <FlatList
      style={styles.screen}
      data={showPrivateGate ? [] : posts}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      ListEmptyComponent={
        showPrivateGate ? (
          <View style={styles.privateGate}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.textDim} />
            <Text style={styles.empty}>Esta cuenta es privada. Síguela para ver sus publicaciones.</Text>
          </View>
        ) : <Text style={styles.empty}>Todavía no ha publicado nada.</Text>
      }
      renderItem={({ item }) => (
        <PostCard
          post={item}
          liked={!!likedIds[item.id]}
          onToggleLike={() => toggleLike(item)}
          onPressComments={(postId) => navigation.navigate('PostDetail', { postId })}
          onEdit={(post) => navigation.navigate('EditPost', { post })}
          onChanged={load}
        />
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <Avatar url={profile.avatar_url} name={profile.display_name || profile.username} size={72} />
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.display_name || profile.username}</Text>
            {profile.is_private && <Ionicons name="lock-closed" size={13} color={colors.textDim} />}
          </View>
          <Text style={styles.handle}>@{profile.username}</Text>
          {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statValue}>{counts.followers}</Text><Text style={styles.statLabel}>Seguidores</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{counts.following}</Text><Text style={styles.statLabel}>Siguiendo</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{posts.length}</Text><Text style={styles.statLabel}>Publicaciones</Text></View>
          </View>

          <View style={styles.actionsRow}>
            <FollowButton profileId={profile.id} isPrivate={profile.is_private} />
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
  privateGate: { alignItems: 'center', gap: 10, marginTop: 30, paddingHorizontal: 24 },
  header: { alignItems: 'center', gap: 6, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  handle: { color: colors.textDim, fontSize: 13 },
  bio: { color: colors.text, fontSize: 13, textAlign: 'center', paddingHorizontal: 24, marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 24, marginTop: 12, marginBottom: 4 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontWeight: '800', fontSize: 16 },
  statLabel: { color: colors.textDim, fontSize: 11 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
});
