import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';

export default function CreateStoryScreen({ navigation }) {
  const { user } = useAuth();
  const [asset, setAsset] = useState(null);
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Nueva historia' });
  }, [navigation]);

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Permite acceder a tus fotos para publicar una historia.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
      allowsEditing: true,
      aspect: [9, 16],
    });
    if (!result.canceled) setAsset(result.assets[0]);
  }

  async function publish() {
    if (!user || !asset || saving) return;
    setSaving(true);
    try {
      const ext = asset.uri.split('.').pop().split('?')[0] || 'jpg';
      const path = `${user.id}/stories/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage.from('media').upload(path, blob, {
        contentType: asset.mimeType || 'image/jpeg',
      });
      if (uploadError) throw uploadError;

      const { data: publicFile } = supabase.storage.from('media').getPublicUrl(path);
      const { error } = await supabase.from('stories').insert({
        author_id: user.id,
        media_url: publicFile.publicUrl,
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
      <Pressable style={styles.preview} onPress={pickImage}>
        {asset ? (
          <Image source={{ uri: asset.uri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="images-outline" size={42} color={colors.accentStrong} />
            <Text style={styles.placeholderTitle}>Elige una foto vertical</Text>
            <Text style={styles.placeholderText}>La historia estará visible durante 24 horas.</Text>
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
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  placeholderTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  placeholderText: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
  changeBadge: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15,23,18,0.86)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  changeText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  caption: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, color: colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  publish: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, marginBottom: 8 },
  disabled: { opacity: 0.4 },
  publishText: { color: colors.bg, fontSize: 15, fontWeight: '800' },
});
