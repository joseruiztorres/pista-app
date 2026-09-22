import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';

export default function CreateHighlightScreen({ route, navigation }) {
  const { user } = useAuth();
  const initialStoryId = route.params?.storyId;
  const [title, setTitle] = useState('');
  const [stories, setStories] = useState([]);
  const [selected, setSelected] = useState(() => initialStoryId ? [initialStoryId] : []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.from('stories').select('id, media_url, caption, created_at')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (active) setStories(data || []);
        setLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  const selectedStories = useMemo(
    () => selected.map((id) => stories.find((story) => story.id === id)).filter(Boolean),
    [selected, stories],
  );

  function toggle(storyId) {
    setSelected((current) => current.includes(storyId)
      ? current.filter((id) => id !== storyId)
      : [...current, storyId]);
  }

  async function save() {
    if (!title.trim()) {
      Alert.alert('Falta el nombre', 'Pon un nombre al destacado.');
      return;
    }
    if (!selected.length) {
      Alert.alert('Elige historias', 'Selecciona al menos una historia para guardar.');
      return;
    }
    setSaving(true);
    try {
      const { data: highlight, error } = await supabase.from('highlights').insert({
        owner_id: user.id,
        title: title.trim(),
        cover_url: selectedStories[0]?.media_url || null,
      }).select().single();
      if (error) throw error;

      const rows = selected.map((storyId, position) => ({
        highlight_id: highlight.id,
        story_id: storyId,
        position,
      }));
      const { error: linksError } = await supabase.from('highlight_stories').insert(rows);
      if (linksError) throw linksError;
      navigation.popToTop();
    } catch (error) {
      Alert.alert('No se pudo crear', error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Carreras, Gym, 2026…"
        placeholderTextColor={colors.textDim}
        value={title}
        onChangeText={setTitle}
        maxLength={30}
      />

      <View style={styles.sectionHead}>
        <Text style={styles.label}>Elige historias</Text>
        <Text style={styles.count}>{selected.length} seleccionada{selected.length === 1 ? '' : 's'}</Text>
      </View>

      {stories.length ? (
        <View style={styles.grid}>
          {stories.map((story) => {
            const active = selected.includes(story.id);
            return (
              <Pressable key={story.id} style={[styles.story, active && styles.storyActive]} onPress={() => toggle(story.id)}>
                <Image source={{ uri: story.media_url }} style={styles.storyImage} />
                <View style={[styles.check, active && styles.checkActive]}>
                  {active && <Ionicons name="checkmark" size={14} color={colors.bg} />}
                </View>
                <Text style={styles.date}>{new Date(story.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="images-outline" size={30} color={colors.textDim} />
          <Text style={styles.emptyTitle}>Todavía no tienes historias</Text>
          <Text style={styles.emptyText}>Publica una historia y después podrás conservarla aquí.</Text>
          <Pressable style={styles.secondary} onPress={() => navigation.replace('CreateStory')}>
            <Text style={styles.secondaryText}>Crear historia</Text>
          </Pressable>
        </View>
      )}

      {stories.length > 0 && (
        <Pressable style={styles.save} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Guardando…' : 'Crear destacado'}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 10, paddingBottom: 36 },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.text, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, marginBottom: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { color: colors.accentStrong, fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  story: { width: '31.5%', aspectRatio: 0.72, borderRadius: 13, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface },
  storyActive: { borderColor: colors.accent },
  storyImage: { width: '100%', height: '100%' },
  check: { position: 'absolute', top: 7, right: 7, width: 23, height: 23, borderRadius: 12, borderWidth: 2, borderColor: colors.text, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  checkActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  date: { position: 'absolute', left: 6, bottom: 6, color: colors.text, fontSize: 9, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { color: colors.text, fontWeight: '800' },
  emptyText: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
  secondary: { borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, marginTop: 6 },
  secondaryText: { color: colors.accentStrong, fontWeight: '800', fontSize: 13 },
  save: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  saveText: { color: colors.bg, fontWeight: '800', fontSize: 15 },
});
