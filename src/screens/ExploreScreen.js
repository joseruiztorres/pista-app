import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SearchScreen from './SearchScreen';
import VideoPlayer from '../components/VideoPlayer';
import Avatar from '../components/Avatar';
import SportLoader from '../components/SportLoader';
import { colors } from '../lib/theme';

const VIDEO_SELECT = 'id, author_id, caption, created_at, sport_id, profiles:author_id(username, display_name, avatar_url), post_media!inner(url, position, media_type)';

export default function ExploreScreen({ navigation }) {
  const [section, setSection] = useState('personas');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('posts').select(VIDEO_SELECT)
      .eq('post_media.media_type', 'video').order('created_at', { ascending: false }).limit(30);
    setVideos(data || []);
    setLoading(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadVideos();
    setRefreshing(false);
  }, [loadVideos]);

  useEffect(() => { if (section === 'videos') loadVideos(); }, [section, loadVideos]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Explorar</Text>
        <Pressable style={styles.placeButton} onPress={() => navigation.navigate('Places')}><Ionicons name="location-outline" size={19} color={colors.text} /></Pressable>
      </View>
      <View style={styles.switcher}>
        <Tab active={section === 'personas'} label="Personas" icon="people-outline" onPress={() => setSection('personas')} />
        <Tab active={section === 'videos'} label="Vídeos" icon="play-circle-outline" onPress={() => setSection('videos')} />
      </View>
      {section === 'personas' ? <SearchScreen navigation={navigation} embedded /> : loading ? (
        <View style={styles.center}><SportLoader label="Buscando vídeos" /></View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="videocam-outline" size={34} color={colors.textDim} /><Text style={styles.emptyTitle}>Todavía no hay vídeos</Text><Text style={styles.emptyText}>Los primeros vídeos deportivos aparecerán aquí.</Text></View>}
          renderItem={({ item }) => {
            const video = item.post_media?.find((media) => media.media_type === 'video');
            const author = item.profiles || {};
            return (
              <View style={styles.reel}>
                <VideoPlayer uri={video?.url} style={styles.video} controls loop={false} />
                <Pressable style={styles.authorRow} onPress={() => navigation.navigate('UserProfile', { profileId: item.author_id })}>
                  <Avatar url={author.avatar_url} name={author.display_name || author.username} size={34} />
                  <View style={{ flex: 1 }}><Text style={styles.name}>{author.display_name || author.username}</Text><Text style={styles.handle}>@{author.username}</Text></View>
                </Pressable>
                {!!item.caption && <Text style={styles.caption}>{item.caption}</Text>}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function Tab({ active, label, icon, onPress }) { return <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}><Ionicons name={icon} size={15} color={active ? colors.bg : colors.textDim} /><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: colors.text, fontSize: 22, fontWeight: '900' }, placeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  switcher: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 4 }, tab: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }, tabActive: { backgroundColor: colors.accent }, tabText: { color: colors.textDim, fontSize: 12, fontWeight: '800' }, tabTextActive: { color: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, list: { padding: 16, gap: 18, paddingBottom: 36 }, reel: { backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }, video: { borderWidth: 0, borderRadius: 0, maxHeight: 640 }, authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, paddingBottom: 6 }, name: { color: colors.text, fontSize: 13, fontWeight: '800' }, handle: { color: colors.textDim, fontSize: 10 }, caption: { color: colors.text, fontSize: 13, lineHeight: 19, paddingHorizontal: 12, paddingBottom: 13 },
  empty: { alignItems: 'center', padding: 40, gap: 7 }, emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, emptyText: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
});
