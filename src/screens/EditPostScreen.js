import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

// Edición ligera: la descripción (todo tipo de post), la nota (reseñas) y los
// datos de ruta (distancia/duración/desnivel). No permite cambiar el deporte,
// el tipo, el sitio ni la foto — para eso lo más simple es borrar y publicar de nuevo.
export default function EditPostScreen({ route, navigation }) {
  const { post } = route.params;
  const details = post.details || {};
  const [caption, setCaption] = useState(post.caption || '');
  const [rating, setRating] = useState(details.rating || 0);
  const [distanceKm, setDistanceKm] = useState(details.distance_km ? String(details.distance_km) : '');
  const [durationMin, setDurationMin] = useState(details.duration_min ? String(details.duration_min) : '');
  const [elevationM, setElevationM] = useState(details.elevation_m ? String(details.elevation_m) : '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const nextDetails = { ...details };
      if (post.type === 'ruta') {
        nextDetails.distance_km = distanceKm ? Number(distanceKm) : undefined;
        nextDetails.duration_min = durationMin ? Number(durationMin) : undefined;
        nextDetails.elevation_m = elevationM ? Number(elevationM) : undefined;
        Object.keys(nextDetails).forEach((k) => nextDetails[k] === undefined && delete nextDetails[k]);
      }
      if (post.type === 'resena') {
        if (rating) nextDetails.rating = rating; else delete nextDetails.rating;
      }
      const { error } = await supabase.from('posts')
        .update({ caption: caption.trim(), details: nextDetails, edited_at: new Date().toISOString() })
        .eq('id', post.id);
      if (error) throw error;
      navigation.goBack();
    } catch (err) {
      Alert.alert('No se pudo guardar', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={styles.h1}>Editar publicación</Text>

      <Field label="Descripción">
        <TextInput style={[styles.input, styles.textarea]} placeholder="Cuenta cómo te ha ido…" placeholderTextColor={colors.textDim}
          value={caption} onChangeText={setCaption} multiline />
      </Field>

      {post.type === 'ruta' && (
        <Field label="Datos de la ruta">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="km" placeholderTextColor={colors.textDim}
              keyboardType="numeric" value={distanceKm} onChangeText={setDistanceKm} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="min" placeholderTextColor={colors.textDim}
              keyboardType="numeric" value={durationMin} onChangeText={setDurationMin} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="desnivel m" placeholderTextColor={colors.textDim}
              keyboardType="numeric" value={elevationM} onChangeText={setElevationM} />
          </View>
        </Field>
      )}

      {post.type === 'resena' && (
        <Field label="Tu nota">
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)}>
                <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={26} color={colors.amber} />
              </Pressable>
            ))}
          </View>
        </Field>
      )}

      <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
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
  h1: { color: colors.text, fontSize: 20, fontWeight: '800' },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.text,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  btnPrimaryText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
