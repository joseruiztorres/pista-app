import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';
import VideoPlayer from '../components/VideoPlayer';

export default function CreateStoryScreen({ navigation }) {
  const { user } = useAuth();
  const [asset, setAsset] = useState(null);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState('followers');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Nueva historia' });
  }, [navigation]);

  async function pickMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Permite acceder a tus fotos y vídeos para publicar una historia.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.82,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      const selected = result.assets[0];
      if (selected.type === 'video' && selected.duration && selected.duration > 60000) {
        Alert.alert('Vídeo demasiado largo', 'Las historias pueden durar hasta 60 segundos.');
        return;
      }
      setAsset(selected);
    }
  }

  async function publish() {
    if (!user || !asset || saving) return;
    setSaving(true);
    try {
      const isVideo = asset.type === 'video';
      const ext = asset.uri.split('.').pop().split('?')[0] || (isVideo ? 'mp4' : 'jpg');
      const path = `${user.id}/stories/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage.from('media').upload(path, blob, {
        contentType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
      });
      if (uploadError) throw uploadError;

      const { data: publicFile } = supabase.storage.from('media').getPublicUrl(path);
      const { error } = await supabase.from('stories').insert({
        author_id: user.id,
        media_url: publicFile.publicUrl,
        media_type: isVideo ? 'video' : 'image',
        audience,
        caption: caption.trim() || null,
      });
      if (error) throw error;
      navigation.goBack();
    } catch (error) {
      Alert.alert('No se pudo publicar', error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Pressable style={styles.preview} onPress={pickMedia}>
        {asset ? (
          asset.type === 'video'
            ? <VideoPlayer uri={asset.uri} style={styles.video} controls loop={false} />
            : <Image source={{ uri: asset.uri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="images-outline" size={42} color={colors.accentStrong} />
            <Text style={styles.placeholderTitle}>Elige una foto o un vídeo</Text>
            <Text style={styles.placeholderText}>Los vídeos pueden durar hasta 60 segundos. La historia desaparecerá en 24 horas.</Text>
          </View>
        )}
        {asset && (
          <View style={styles.changeBadge}>
            <Ionicons name="camera-outline" size={15} color={colors.text} />
            <Text style={styles.changeText}>Cambiar</Text>
          </View>
        )}
      </Pressable>

      <TextInput
        style={styles.caption}
        placeholder="Añade un mensaje…"
        placeholderTextColor={colors.textDim}
        value={caption}
        onChangeText={setCaption}
        maxLength={180}
      />

      <View style={styles.audienceRow}>
        {[['public','Todos'],['followers','Seguidores'],['close_friends','Mejores amigos']].map(([id, label]) => (
          <Pressable key={id} style={[styles.audience, audience === id && styles.audienceActive]} onPress={() => setAudience(id)}><Text style={[styles.audienceText, audience === id && styles.audienceTextActive]}>{label}</Text></Pressable>
        ))}
      </View>

      <Pressable style={[styles.publish, !asset && styles.disabled]} onPress={publish} disabled={!asset || saving}>
        <Ionicons name="paper-plane-outline" size={18} color={colors.bg} />
        <Text style={styles.publishText}>{saving ? 'Publicando…' : 'Compartir historia'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 14 },
  preview: { flex: 1, maxWidth: 460, width: '100%', alignSelf: 'center', borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  image: { width: '100%', height: '100%' },
  video: { width: '100%', height: '100%', aspectRatio: undefined, borderWidth: 0, borderRadius: 0 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  placeholderTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  placeholderText: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
  changeBadge: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15,23,18,0.86)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  changeText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  caption: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, color: colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  audienceRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  audience: { backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  audienceActive: { backgroundColor: colors.accent }, audienceText: { color: colors.textDim, fontSize: 11, fontWeight: '800' }, audienceTextActive: { color: colors.bg },
  publish: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, marginBottom: 8 },
  disabled: { opacity: 0.4 },
  publishText: { color: colors.bg, fontSize: 15, fontWeight: '800' },
});
