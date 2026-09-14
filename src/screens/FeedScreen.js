import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconFor } from '../lib/sports';
import PostCard from '../components/PostCard';
import DailyChallengeCard from '../components/DailyChallengeCard';
import { colors } from '../lib/theme';

const POST_SELECT = '*, profiles:author_id(username, display_name), post_media(url, position), comments(count)';

export default function FeedScreen({ navigation }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [likedIds, setLikedIds] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [sports, setSports] = useState([]);
  const [filter, setFilter] = useState('todo'); // 'todo' | 'siguiendo' | un sport_id
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    supabase.from('sports').select('*').order('name').then(({ data }) => setSports(data || []));
  }, []);

  const loadUnread = useCallback(async () => {
    if (!user) { setUnread(0); return; }
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('read', false);
    setUnread(count || 0);
  }, [user]);

  useEffect(() => { loadUnread(); }, [loadUnread]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadUnread);
    return unsub;
  }, [navigation, loadUnread]);
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => {
        setUnread((n) => n + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const load = useCallback(async () => {
    let query = supabase.from('posts').select(POST_SELECT).order('created_at', { ascending: false }).limit(30);

    if (filter === 'siguiendo') {
      if (!user) { setPosts([]); return; }
      const { data: followingRows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
      const ids = (followingRows || []).map((f) => f.following_id);
      if (ids.length === 0) { setPosts([]); return; }
      query = query.in('author_id', ids);
    } else if (filter !== 'todo') {
      query = query.eq('sport_id', filter);
    }

    const { data, error } = await query;
    if (!error) setPosts(data || []);

    if (user) {
      const { data: likes } = await supabase.from('likes').select('post_id').eq('profile_id', user.id);
      const map = {};
      (likes || []).forEach((l) => { map[l.post_id] = true; });
      setLikedIds(map);
    }
  }, [user, filter]);

  useEffect(() => { load(); }, [load]);

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

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Text style={styles.wordmark}>PISTA</Text>
        <View style={styles.topbarActions}>
          <Pressable style={styles.bellWrap} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.fab} onPress={() => navigation.navigate('CrearPost')}>
            <Ionicons name="add" size={22} color={colors.bg} />
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent}>
        <FilterChip label="Todo" active={filter === 'todo'} onPress={() => setFilter('todo')} />
        <FilterChip label="Siguiendo" active={filter === 'siguiendo'} onPress={() => setFilter('siguiendo')} />
        {sports.map((s) => (
          <FilterChip key={s.id} label={s.name} icon={iconFor(s.id)} active={filter === s.id} onPress={() => setFilter(s.id)} />
        ))}
      </ScrollView>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.accent} />}
        ListHeaderComponent={filter === 'todo' ? <DailyChallengeCard /> : null}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListEmptyComponent={<Text style={styles.empty}>
          {filter === 'siguiendo' ? 'Todavía no sigues a nadie con publicaciones.' : 'Todavía no hay publicaciones. ¡Sé el primero!'}
        </Text>}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            liked={!!likedIds[item.id]}
            onToggleLike={() => toggleLike(item)}
            onPressAuthor={(profileId) => navigation.navigate('UserProfile', { profileId })}
            onPressComments={(postId) => navigation.navigate('PostDetail', { postId })}
          />
        )}
      />
    </View>
  );
}

function FilterChip({ label, icon, active, onPress }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      {icon && <Ionicons name={icon} size={13} color={active ? colors.bg : colors.textDim} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  wordmark: { color: colors.accent, fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  topbarActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bellWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 1, right: 1, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.clay, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: colors.bg, fontSize: 9, fontWeight: '800' },
  fab: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  filters: { flexGrow: 0 },
  filtersContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.bg },
  list: { padding: 16, paddingTop: 6, gap: 14 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40 },
});
