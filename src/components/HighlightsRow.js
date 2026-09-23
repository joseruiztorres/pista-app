import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

export default function HighlightsRow({ profileId, isMine, navigation }) {
  const [highlights, setHighlights] = useState([]);

  const load = useCallback(async () => {
    if (!profileId) return;
    const { data } = await supabase
      .from('highlights')
      .select('id, title, cover_url, position, highlight_stories(position, stories(id, media_url, media_type))')
      .eq('owner_id', profileId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    setHighlights(data || []);
  }, [profileId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  if (!isMine && highlights.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Destacados</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {isMine && (
          <Pressable style={styles.item} onPress={() => navigation.navigate('CreateHighlight')}>
            <View style={[styles.cover, styles.addCover]}>
              <Ionicons name="add" size={24} color={colors.accentStrong} />
            </View>
            <Text style={styles.label}>Nuevo</Text>
          </Pressable>
        )}
        {highlights.map((highlight) => {
          const linked = (highlight.highlight_stories || []).slice().sort((a, b) => a.position - b.position);
          const firstStory = linked[0]?.stories;
          const cover = highlight.cover_url || (firstStory?.media_type === 'video' ? null : firstStory?.media_url);
          return (
            <Pressable
              key={highlight.id}
              style={styles.item}
              onPress={() => navigation.navigate('StoryViewer', { highlightId: highlight.id })}
            >
              <View style={styles.cover}>
                {cover ? (
                  <Image source={{ uri: cover }} style={styles.image} />
                ) : (
                  <Ionicons name={firstStory?.media_type === 'video' ? 'play' : 'images-outline'} size={22} color={colors.textDim} />
                )}
              </View>
              <Text style={styles.label} numberOfLines={1}>{highlight.title}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginTop: 14 },
  heading: { color: colors.textDim, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 9 },
  row: { gap: 12, paddingRight: 8 },
  item: { width: 68, alignItems: 'center' },
  cover: {
    width: 62, height: 62, borderRadius: 31, overflow: 'hidden',
    borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  addCover: { borderStyle: 'dashed', borderColor: colors.accentStrong },
  image: { width: '100%', height: '100%' },
  label: { color: colors.text, fontSize: 10, marginTop: 5, textAlign: 'center', width: 68 },
});
