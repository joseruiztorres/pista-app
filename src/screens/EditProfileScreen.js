import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import Avatar from '../components/Avatar';
import { colors } from '../lib/theme';

export default function EditProfileScreen({ navigation }) {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);
  const [isPrivate, setIsPrivate] = useState(!!profile?.is_private);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const ext = asset.uri.split('.').pop().split('?')[0] || 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: asset.mimeType || 'image/jpeg', upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('media').getPublicUrl(path);
      // Evita que quede cacheada la imagen antigua con la misma URL.
      setAvatarUrl(`${pub.publicUrl}?t=${Date.now()}`);
    } catch (err) {
      Alert.alert('No se pudo subir la foto', err.message);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave() {
    if (!username.trim()) {
      Alert.alert('Falta el usuario', 'El nombre de usuario no puede estar vacío.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: displayName.trim() || null,
        username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
        bio: bio.trim() || null,
        avatar_url: avatarUrl ? avatarUrl.split('?')[0] : null,
        is_private: isPrivate,
      }).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      navigation.goBack();
    } catch (err) {
      Alert.alert('No se pudo guardar', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Pressable style={styles.avatarWrap} onPress={pickAvatar} disabled={uploadingAvatar}>
        <Avatar url={avatarUrl} name={displayName || username} size={88} />
        <View style={styles.avatarEditBadge}>
          <Ionicons name={uploadingAvatar ? 'hourglass-outline' : 'camera'} size={14} color={colors.bg} />
        </View>
      </Pressable>

      <Field label="Nombre">
        <TextInput style={styles.input} placeholder="Tu nombre" placeholderTextColor={colors.textDim}
          value={displayName} onChangeText={setDisplayName} />
      </Field>

      <Field label="Usuario">
        <View style={styles.usernameRow}>
          <Text style={styles.at}>@</Text>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="usuario" placeholderTextColor={colors.textDim}
            value={username} onChangeText={setUsername} autoCapitalize="none" />
        </View>
      </Field>

      <Field label="Bio">
        <TextInput style={[styles.input, styles.textarea]} placeholder="Cuenta algo sobre ti…" placeholderTextColor={colors.textDim}
          value={bio} onChangeText={setBio} multiline />
      </Field>

      <View style={styles.privacyRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Cuenta privada</Text>
          <Text style={styles.privacyHint}>Solo quien apruebes podrá ver tus publicaciones.</Text>
        </View>
        <Switch
          value={isPrivate}
          onValueChange={setIsPrivate}
          trackColor={{ true: colors.accent, false: colors.surface2 }}
          thumbColor={colors.bg}
        />
      </View>

      <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving || uploadingAvatar}>
        <Text style={styles.btnPrimaryText}>{saving ? 'Guardando…' : 'Guardar cambios'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, children }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  avatarWrap: { alignSelf: 'center', marginTop: 4 },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg,
  },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.text,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 12, padding: 12 },
  privacyHint: { color: colors.textDim, fontSize: 11, marginTop: 3 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  at: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  btnPrimaryText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
