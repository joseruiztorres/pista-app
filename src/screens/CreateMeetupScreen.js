import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconFor } from '../lib/sports';
import { colors } from '../lib/theme';

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function CreateMeetupScreen({ navigation }) {
  const { user, sportIds } = useAuth();
  const [sports, setSports] = useState([]);
  const [sportId, setSportId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [date, setDate] = useState(todayPlus(1));
  const [time, setTime] = useState('18:00');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('sports').select('*').order('name').then(({ data }) => {
      const list = data || [];
      setSports(list);
      const preferred = list.find((s) => sportIds.includes(s.id));
      setSportId((preferred || list[0])?.id || null);
    });
  }, [sportIds]);

  function useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      Alert.alert('No disponible', 'Este dispositivo no permite compartir ubicación desde aquí. Escribe las coordenadas a mano si las tienes.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude.toFixed(5)));
        setLng(String(pos.coords.longitude.toFixed(5)));
        setLocating(false);
      },
      () => {
        setLocating(false);
        Alert.alert('No se pudo obtener la ubicación', 'Comprueba los permisos de ubicación del navegador e inténtalo de nuevo.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSave() {
    if (!user || !sportId || !title.trim() || !locationName.trim()) {
      Alert.alert('Faltan datos', 'Elige deporte, título y lugar antes de crear la quedada.');
      return;
    }
    const scheduledAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
      Alert.alert('Fecha no válida', 'Revisa la fecha y la hora.');
      return;
    }
    setSaving(true);
    try {
      const { data: meetup, error } = await supabase
        .from('meetups')
        .insert({
          organizer_id: user.id,
          sport_id: sportId,
          title: title.trim(),
          description: description.trim() || null,
          location_name: locationName.trim(),
          lat: lat ? Number(lat) : null,
          lng: lng ? Number(lng) : null,
          scheduled_at: scheduledAt.toISOString(),
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('meetup_attendees').insert({ meetup_id: meetup.id, profile_id: user.id });
      navigation.replace('MeetupDetail', { meetupId: meetup.id });
    } catch (err) {
      Alert.alert('No se pudo crear la quedada', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Field label="Deporte">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {sports.map((s) => (
              <Chip key={s.id} active={sportId === s.id} onPress={() => setSportId(s.id)} icon={iconFor(s.id)} label={s.name} />
            ))}
          </View>
        </ScrollView>
      </Field>

      <Field label="Título">
        <TextInput style={styles.input} placeholder="Rodada suave por la Collserola" placeholderTextColor={colors.textDim}
          value={title} onChangeText={setTitle} />
      </Field>

      <Field label="Fecha y hora">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="AAAA-MM-DD" placeholderTextColor={colors.textDim}
            value={date} onChangeText={setDate} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="HH:MM" placeholderTextColor={colors.textDim}
            value={time} onChangeText={setTime} />
        </View>
      </Field>

      <Field label="Lugar">
        <TextInput style={styles.input} placeholder="Ej. Parc de la Ciutadella, entrada Wellington" placeholderTextColor={colors.textDim}
          value={locationName} onChangeText={setLocationName} />

        {lat && lng ? (
          <View style={styles.locatedRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
            <Text style={styles.locatedText}>Ubicación en el mapa guardada</Text>
            <Pressable onPress={() => { setLat(''); setLng(''); }}>
              <Text style={styles.locatedRemove}>Quitar</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.secondaryBtn} onPress={useMyLocation} disabled={locating}>
            <Ionicons name="navigate-outline" size={16} color={colors.accentStrong} />
            <Text style={styles.secondaryBtnText}>{locating ? 'Localizando…' : 'Usar mi ubicación actual (si estás ahí ahora)'}</Text>
          </Pressable>
        )}
        <Text style={styles.hint}>Esto añade la quedada al mapa. Con el nombre del lugar ya basta para que la gente sepa dónde es.</Text>
      </Field>

      <Field label="Descripción (opcional)">
        <TextInput style={[styles.input, styles.textarea]} placeholder="Ritmo, nivel, qué llevar…" placeholderTextColor={colors.textDim}
          value={description} onChangeText={setDescription} multiline />
      </Field>

      <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
        <Text style={styles.btnPrimaryText}>{saving ? 'Creando…' : 'Crear quedada'}</Text>
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
  locatedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  locatedText: { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  locatedRemove: { color: colors.clay, fontSize: 12, fontWeight: '700' },
  hint: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  btnPrimaryText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
