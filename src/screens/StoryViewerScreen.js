import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import Avatar from '../components/Avatar';
import { colors } from '../lib/theme';
import VideoPlayer from '../components/VideoPlayer';
import { alert } from '../lib/alert';

const STORY_FIELDS = 'id, author_id, media_url, media_type, audience, caption, created_at, expires_at, profiles:author_id(id, username, display_name, avatar_url)';

export default function StoryViewerScreen({ route, navigation }) {
  const { authorId, highlightId } = route.params || {};
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewCount, setViewCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    if (highlightId) {
      const { data } = await supabase
        .from('highlight_stories')
        .select(`position, stories(${STORY_FIELDS})`)
        .eq('highlight_id', highlightId)
        .order('position', { ascending: true });
      setStories((data || []).map((row) => row.stories).filter(Boolean));
    } else if (authorId) {
      const { data } = await supabase
        .from('stories')
        .select(STORY_FIELDS)
        .eq('author_id', authorId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
      setStories(data || []);
    }
    setIndex(0);
    setLoading(false);
  }, [authorId, highlightId]);

  useEffect(() => { load(); }, [load]);

  const story = stories[index];
  const isMine = !!story && story.author_id === user?.id;

  useEffect(() => {
    if (!story || !user) return;
    if (!isMine) {
      supabase.from('story_views').upsert(
        { story_id: story.id, profile_id: user.id, viewed_at: new Date().toISOString() },
        { onConflict: 'story_id,profile_id' },
      );
      setViewCount(0);
    } else {
      supabase.from('story_views').select('profile_id', { count: 'exact', head: true })
        .eq('story_id', story.id)
        .then(({ count }) => setViewCount(count || 0));
    }
  }, [story?.id, user, isMine]);

  function next() {
    if (index < stories.length - 1) setIndex((value) => value + 1);
    else navigation.goBack();
  }

  function previous() {
    if (index > 0) setIndex((value) => value - 1);
  }

  function confirmDelete() {
    alert('Eliminar historia', 'La historia dejará de verse también en los destacados.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('stories').delete().eq('id', story.id).eq('author_id', user.id);
          const remaining = stories.filter((item) => item.id !== story.id);
          if (!remaining.length) navigation.goBack();
          else {
            setStories(remaining);
            setIndex((value) => Math.min(value, remaining.length - 1));
          }
        },
      },
    ]);
  }

  async function muteStories() {
    const { data: current } = await supabase.from('mutes').select('mute_posts').eq('owner_id', user.id).eq('muted_id', story.author_id).maybeSingle();
    const { error } = await supabase.from('mutes').upsert({ owner_id: user.id, muted_id: story.author_id, mute_posts: !!current?.mute_posts, mute_stories: true }, { onConflict: 'owner_id,muted_id' });
    if (error) alert('No se pudo silenciar', error.message);
    else navigation.goBack();
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  }

  if (!story) {
    return (
      <View style={styles.center}>
        <Ionicons name="time-outline" size={28} color={colors.textDim} />
        <Text style={styles.empty}>Esta historia ya no está disponible.</Text>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.backText}>Volver</Text></Pressable>
      </View>
    );
  }

  const author = story.profiles || {};
  const age = formatAge(story.created_at);

  return (
    <View style={styles.screen}>
      {story.media_type === 'video'
        ? <VideoPlayer uri={story.media_url} style={styles.media} autoplay controls={false} loop={false} />
        : <Image source={{ uri: story.media_url }} style={styles.media} resizeMode="contain" />}
      <View style={styles.scrimTop} />
      <View style={styles.scrimBottom} />

      <View style={styles.progressRow}>
        {stories.map((item, itemIndex) => (
          <View key={item.id} style={[styles.progress, itemIndex <= index && styles.progressActive]} />
        ))}
      </View>

      <View style={styles.header}>
        <Avatar url={author.avatar_url} name={author.display_name || author.username} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{author.display_name || author.username}</Text>
          <Text style={styles.time}>{age}</Text>
        </View>
        {isMine && (
          <Pressable accessibilityLabel="Eliminar historia" hitSlop={10} onPress={confirmDelete}>
            <Ionicons name="trash-outline" size={20} color={colors.text} />
          </Pressable>
        )}
        {!isMine && (
          <Pressable accessibilityLabel="Silenciar historias" hitSlop={10} onPress={muteStories}>
            <Ionicons name="volume-mute-outline" size={21} color={colors.text} />
          </Pressable>
        )}
        <Pressable accessibilityLabel="Cerrar historia" hitSlop={10} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>

      <Pressable accessibilityLabel="Historia anterior" style={styles.leftTap} onPress={previous} />
      <Pressable accessibilityLabel="Historia siguiente" style={styles.rightTap} onPress={next} />

      <View style={styles.footer} pointerEvents="box-none">
        {!!story.caption && <Text style={styles.caption}>{story.caption}</Text>}
        {isMine && (
          <View style={styles.ownerActions}>
            <View style={styles.views}>
              <Ionicons name="eye-outline" size={16} color={colors.text} />
              <Text style={styles.viewsText}>{viewCount}</Text>
            </View>
            <Pressable style={styles.highlightButton} onPress={() => navigation.navigate('CreateHighlight', { storyId: story.id })}>
              <Ionicons name="heart-circle-outline" size={17} color={colors.text} />
              <Text style={styles.highlightText}>Destacar</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function formatAge(value) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(value).toLocaleDateString('es-ES');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#05060D' },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  empty: { color: colors.textDim, textAlign: 'center' },
  backButton: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 11 },
  backText: { color: colors.bg, fontWeight: '800' },
  media: { width: '100%', height: '100%', aspectRatio: undefined, borderWidth: 0, borderRadius: 0 },
  scrimTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 150, backgroundColor: 'rgba(0,0,0,0.28)' },
  scrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 190, backgroundColor: 'rgba(0,0,0,0.34)' },
  progressRow: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', gap: 4 },
  progress: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  progressActive: { backgroundColor: colors.text },
  header: { position: 'absolute', top: 25, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  author: { color: colors.text, fontSize: 13, fontWeight: '800' },
  time: { color: 'rgba(255,255,255,0.72)', fontSize: 10, marginTop: 1 },
  leftTap: { position: 'absolute', left: 0, top: 84, bottom: 155, width: '34%' },
  rightTap: { position: 'absolute', right: 0, top: 84, bottom: 155, width: '66%' },
  footer: { position: 'absolute', left: 18, right: 18, bottom: 24, gap: 14 },
  caption: { color: colors.text, fontSize: 15, lineHeight: 21, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 },
  ownerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  views: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  viewsText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  highlightButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  highlightText: { color: colors.text, fontSize: 12, fontWeight: '800' },
});
