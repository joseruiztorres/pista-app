import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import PostCard from '../components/PostCard';
import DailyChallengeCard from '../components/DailyChallengeCard';
import { colors } from '../lib/theme';

export default function FeedScreen({ navigation }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [likedIds, setLikedIds] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:author_id(username, display_name), post_media(url, position)')
      .order('created_at', { ascending: false })
      .limit(30);
    if (!error) setPosts(data || []);

    if (user) {
      const { data: likes } = await supabase.from('likes').select('post_id').eq('profile_id', user.id);
      const map = {};
      (likes || []).forEach((l) => { map[l.post_id] = true; });
      setLikedIds(map);
    }
  }, [user]);

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
        <Pressable style={styles.fab} onPress={() => navigation.navigate('CrearPost')}>
          <Ionicons name="add" size={22} color={colors.bg} />
        </Pressable>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.accent} />}
        ListHeaderComponent={<DailyChallengeCard />}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListEmptyComponent={<Text style={styles.empty}>Todavía no hay publicaciones. ¡Sé el primero!</Text>}
        renderItem={({ item }) => (
          <PostCard post={item} liked={!!likedIds[item.id]} onToggleLike={() => toggleLike(item)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  wordmark: { color: colors.accent, fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  fab: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingTop: 6, gap: 14 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40 },
});
