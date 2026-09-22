import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import Avatar from './Avatar';
import { colors } from '../lib/theme';

const STORY_SELECT = 'id, author_id, media_url, caption, created_at, expires_at, profiles:author_id(id, username, display_name, avatar_url), story_views(profile_id)';

export default function StoriesBar({ navigation }) {
  const { user, profile } = useAuth();
  const [stories, setStories] = useState([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('stories')
      .select(STORY_SELECT)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });
    setStories(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  const groups = useMemo(() => {
    const byAuthor = new Map();
    stories.forEach((story) => {
      if (!byAuthor.has(story.author_id)) byAuthor.set(story.author_id, []);
      byAuthor.get(story.author_id).push(story);
    });
    return [...byAuthor.entries()]
      .map(([authorId, rows]) => ({
        authorId,
        profile: rows[0]?.profiles,
        stories: rows,
        seen: rows.every((story) => (story.story_views || []).some((view) => view.profile_id === user?.id)),
      }))
      .sort((a, b) => Number(a.seen) - Number(b.seen));
  }, [stories, user]);

  const myGroup = groups.find((group) => group.authorId === user?.id);
  const otherGroups = groups.filter((group) => group.authorId !== user?.id);

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Historias</Text>
        <Pressable style={styles.createTextButton} onPress={() => navigation.navigate('CreateStory')}>
          <Ionicons name="add-circle-outline" size={16} color={colors.accentStrong} />
          <Text style={styles.createText}>Crear</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <StoryBubble
          profile={profile}
          label="Tu historia"
          seen={false}
          muted={!myGroup}
          onPress={() => myGroup
            ? navigation.navigate('StoryViewer', { authorId: user.id })
            : navigation.navigate('CreateStory')}
          onAdd={() => navigation.navigate('CreateStory')}
        />
        {otherGroups.map((group) => (
          <StoryBubble
            key={group.authorId}
            profile={group.profile}
            seen={group.seen}
            label={group.profile?.display_name || group.profile?.username}
            onPress={() => navigation.navigate('StoryViewer', { authorId: group.authorId })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function StoryBubble({ profile, label, seen, muted, onPress, onAdd }) {
  return (
    <View style={styles.item}>
      <Pressable onPress={onPress} style={[styles.ring, seen && styles.ringSeen, muted && styles.ringMuted]}>
        <View style={styles.avatarBorder}>
          <Avatar url={profile?.avatar_url} name={profile?.display_name || profile?.username} size={54} />
        </View>
      </Pressable>
      {!!onAdd && (
        <Pressable accessibilityLabel="Añadir historia" style={styles.plus} onPress={onAdd}>
          <Ionicons name="add" size={13} color={colors.bg} />
        </Pressable>
      )}
      <Text style={styles.label} numberOfLines={1}>{label || 'Deportista'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  title: { color: colors.text, fontSize: 14, fontWeight: '800' },
  createTextButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  createText: { color: colors.accentStrong, fontSize: 12, fontWeight: '700' },
  row: { gap: 12, paddingRight: 8 },
  item: { width: 68, alignItems: 'center' },
  ring: { width: 62, height: 62, borderRadius: 31, padding: 3, borderWidth: 2, borderColor: colors.amber },
  ringSeen: { borderColor: colors.textDim },
  ringMuted: { borderColor: colors.line },
  avatarBorder: { flex: 1, borderRadius: 28, overflow: 'hidden', borderWidth: 2, borderColor: colors.bg },
  plus: {
    position: 'absolute', top: 43, right: 3, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { color: colors.textDim, fontSize: 10, marginTop: 5, width: 68, textAlign: 'center' },
});
