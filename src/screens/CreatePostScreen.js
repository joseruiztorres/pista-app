import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconFor } from '../lib/sports';
import { colors } from '../lib/theme';

const TYPES = [
  { id: 'ruta', label: 'Ruta' },
  { id: 'progreso', label: 'Progreso' },
  { id: 'comida', label: 'Comida' },
  { id: 'tip', label: 'Tip' },
  { id: 'resena', label: 'Reseña' },
];

// Deportes en los que tiene sentido pedir datos de ruta (distancia, ritmo, mapa).
// Añadir un deporte nuevo a esta lista es lo único que hace falta para que
// también pida estos campos - el resto (BD, feed, tarjeta) ya lo soporta.
const ROUTE_SPORTS = ['running', 'ciclismo'];

export default function CreatePostScreen({ navigation }) {
  const { user, sportIds } = useAuth();
  const [sports, setSports] = useState([]);
  const [sportId, setSportId] = useState(null);
  const [type, setType] = useState('ruta');
  const [caption, setCaption] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [elevationM, setElevationM] = useState('');
  const [route, setRoute] = useState(null);
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('sports').select('*').order('name').then(({ data }) => {
      const list = data || [];
      setSports(list);
      const preferred = list.find((s) => sportIds.includes(s.id));
      setSportId((preferred || list[0])?.id || null);
    });
  }, [sportIds]);

  const isRouteSport = ROUTE_SPORTS.includes(sportId);

  function generateSampleRoute() {
    // Placeholder mientras no hay grabación GPS real (Fase 2/3): genera una
    // ruta con forma plausible alrededor de un punto de Barcelona a modo de
    // demo, para poder ver ya la vista previa en el feed.
    const baseLat = 41.4 + Math.random() * 0.02;
    const baseLng = 2.17 + Math.random() * 0.02;
    const points = Array.from({ length: 8 }, (_, i) => [
      baseLat + Math.sin(i * 1.3) * 0.01 + i * 0.002,
      baseLng + Math.cos(i * 0.9) * 0.01 + i * 0.003,
    ]);
    setRoute(points);
    Alert.alert('Ruta de ejemplo generada', 'Cuando esté la grabación GPS real, esto se sustituye por el trazado de verdad.');
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled) setImage(result.assets[0]);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const details = {};
      if (type === 'ruta') {
        if (distanceKm) details.distance_km = Number(distanceKm);
        if (durationMin) details.duration_min = Number(durationMin);
        if (elevationM) details.elevation_m = Number(elevationM);
        if (route) details.route = route;
      }

      const { data: post, error } = await supabase
        .from('posts')
        .insert({ author_id: user.id, sport_id: sportId, type, caption, details })
        .select()
        .single();
      if (error) throw error;

      if (image) {
        const ext = image.uri.split('.').pop();
                const path = `${user.id}/${post.id}.${ext}`;
        const response = await fetch(image.uri);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage.from('media').upload(path, blob, { contentType: image.mimeType || 'image/jpeg' });
        if (!uploadError) {
          const { data: pub } = supabase.storage.from('media').getPublicUrl(path);
          await supabase.from('post_media').insert({ post_id: post.id, url: pub.publicUrl });
        }
      }

      navigation.goBack();
    } catch (err) {
      Alert.alert('No se pudo publicar', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={styles.h1}>Nueva publicación</Text>

      <Field label="Deporte">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {sports.map((s) => (
              <Chip key={s.id} active={sportId === s.id} onPress={() => setSportId(s.id)} icon={iconFor(s.id)} label={s.name} />
            ))}
          </View>
        </ScrollView>
      </Field>

      <Field label="Tipo">
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {TYPES.map((t) => (
            <Chip key={t.id} active={type === t.id} onPress={() => setType(t.id)} label={t.label} />
          ))}
        </View>
      </Field>

      {type === 'ruta' && isRouteSport && (
        <Field label="Datos de la ruta">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="km" placeholderTextColor={colors.textDim}
              keyboardType="numeric" value={distanceKm} onChangeText={setDistanceKm} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="min" placeholderTextColor={colors.textDim}
              keyboardType="numeric" value={durationMin} onChangeText={setDurationMin} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="desnivel m" placeholderTextColor={colors.textDim}
              keyboardType="numeric" value={elevationM} onChangeText={setElevationM} />
          </View>
          <Pressable style={styles.secondaryBtn} onPress={generateSampleRoute}>
            <Ionicons name="map-outline" size={16} color={colors.accentStrong} />
            <Text style={styles.secondaryBtnText}>{route ? 'Ruta añadida ✓' : 'Añadir trazado de ejemplo'}</Text>
          </Pressable>
        </Field>
      )}

      <Field label="Foto (opcional)">
        <Pressable style={styles.imagePicker} onPress={pickImage}>
          {image ? <Image source={{ uri: image.uri }} style={styles.imagePreview} /> : (
            <>
              <Ionicons name="camera-outline" size={22} color={colors.textDim} />
              <Text style={styles.imagePickerText}>Toca para elegir una foto</Text>
            </>
          )}
        </Pressable>
      </Field>

      <Field label="Descripción">
        <TextInput style={[styles.input, styles.textarea]} placeholder="Cuenta cómo te ha ido…" placeholderTextColor={colors.textDim}
          value={caption} onChangeText={setCaption} multiline />
      </Field>

      <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving || !sportId}>
        <Text style={styles.btnPrimaryText}>{saving ? 'Publicando…' : 'Publicar'}</Text>
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

function Chip({ active, onPress, icon, label }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      {icon && <Ionicons name={icon} size={14} color={active ? colors.bg : colors.textDim} />}
      <Text style={[styles.chipText, active && { color: colors.bg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 20, fontWeight: '800' },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.text,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4 },
  secondaryBtnText: { color: colors.accentStrong, fontSize: 13, fontWeight: '600' },
  imagePicker: { height: 140, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden' },
  imagePickerText: { color: colors.textDim, fontSize: 13 },
  imagePreview: { width: '100%', height: '100%' },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  btnPrimaryText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
