import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconFor } from '../lib/sports';
import { geocodeLocation, getCurrentCoordinates } from '../lib/location';
import GoogleMapCard from '../components/GoogleMapCard';
import { colors } from '../lib/theme';

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function CreateMeetupScreen({ navigation, route }) {
  const { user, sportIds } = useAuth();
  const editingMeetup = route.params?.meetup || null;
  const initialDate = editingMeetup ? new Date(editingMeetup.scheduled_at) : null;
  const [sports, setSports] = useState([]);
  const [sportId, setSportId] = useState(editingMeetup?.sport_id || null);
  const [title, setTitle] = useState(editingMeetup?.title || '');
  const [description, setDescription] = useState(editingMeetup?.description || '');
  const [locationName, setLocationName] = useState(editingMeetup?.location_name || '');
  const [lat, setLat] = useState(editingMeetup?.lat != null ? String(editingMeetup.lat) : '');
  const [lng, setLng] = useState(editingMeetup?.lng != null ? String(editingMeetup.lng) : '');
  const [date, setDate] = useState(initialDate ? initialDate.toISOString().slice(0, 10) : todayPlus(1));
  const [time, setTime] = useState(initialDate ? initialDate.toTimeString().slice(0, 5) : '18:00');
  const [level, setLevel] = useState(editingMeetup?.level || 'todos');
  const [capacity, setCapacity] = useState(editingMeetup?.capacity ? String(editingMeetup.capacity) : '');
  const [locating, setLocating] = useState(false);
  const [searchingMap, setSearchingMap] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('sports').select('*').order('name').then(({ data }) => {
      const list = data || [];
      setSports(list);
      const preferred = list.find((s) => s.id === editingMeetup?.sport_id)
        || list.find((s) => sportIds.includes(s.id));
      setSportId((current) => current || (preferred || list[0])?.id || null);
    });
  }, [sportIds, editingMeetup?.sport_id]);

  useEffect(() => {
    if (editingMeetup) navigation.setOptions({ title: 'Editar quedada' });
  }, [navigation, editingMeetup]);

  async function useMyLocation() {
    setLocating(true);
    try {
      const coords = await getCurrentCoordinates();
      setLat(String(coords.lat));
      setLng(String(coords.lng));
    } catch (_error) {
      Alert.alert('No se pudo usar tu ubicación', 'Puedes escribir el nombre del lugar sin añadir un punto al mapa.');
    } finally {
      setLocating(false);
    }
  }

  async function findOnMap() {
    if (!locationName.trim() || searchingMap) return;
    setSearchingMap(true);
    try {
      const coords = await geocodeLocation(locationName);
      setLat(String(coords.lat));
      setLng(String(coords.lng));
    } catch (_error) {
      Alert.alert('No encontramos el lugar', 'Prueba a añadir la ciudad o una dirección más completa.');
    } finally {
      setSearchingMap(false);
    }
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
    if (capacity && Number(capacity) < 1) {
      Alert.alert('Plazas no válidas', 'La capacidad debe ser al menos de una persona.');
      return;
    }
    setSaving(true);
    try {
      const values = {
        sport_id: sportId,
        title: title.trim(),
        description: description.trim() || null,
        location_name: locationName.trim(),
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        scheduled_at: scheduledAt.toISOString(),
        level,
        capacity: capacity ? Number(capacity) : null,
      };
      const request = editingMeetup
        ? supabase.from('meetups').update(values).eq('id', editingMeetup.id).eq('organizer_id', user.id)
        : supabase.from('meetups').insert({ ...values, organizer_id: user.id });
      const { data: meetup, error } = await request.select().single();
      if (error) throw error;

      if (!editingMeetup) {
        await supabase.from('meetup_attendees').insert({ meetup_id: meetup.id, profile_id: user.id });
      }
      navigation.replace('MeetupDetail', { meetupId: meetup.id });
    } catch (err) {
      Alert.alert(editingMeetup ? 'No se pudieron guardar los cambios' : 'No se pudo crear la quedada', err.message);
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

      <Field label="Nivel">
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['todos', 'Todos'],
            ['principiante', 'Principiante'],
            ['intermedio', 'Intermedio'],
            ['avanzado', 'Avanzado'],
          ].map(([id, name]) => <Chip key={id} active={level === id} onPress={() => setLevel(id)} label={name} />)}
        </View>
      </Field>

      <Field label="Plazas (opcional)">
        <TextInput style={styles.input} placeholder="Sin límite" placeholderTextColor={colors.textDim}
          keyboardType="number-pad" value={capacity} onChangeText={(value) => setCapacity(value.replace(/[^0-9]/g, ''))} />
      </Field>

      <Field label="Lugar">
        <TextInput style={styles.input} placeholder="Ej. Parc de la Ciutadella, entrada Wellington" placeholderTextColor={colors.textDim}
          value={locationName} onChangeText={(value) => { setLocationName(value); setLat(''); setLng(''); }}
          onSubmitEditing={findOnMap} />

        {!!locationName.trim() && !lat && !lng && (
          <Pressable style={styles.previewBtn} onPress={findOnMap} disabled={searchingMap}>
            <Ionicons name="map-outline" size={17} color={colors.accentStrong} />
            <Text style={styles.previewBtnText}>{searchingMap ? 'Buscando lugar…' : 'Ver este lugar en el mapa'}</Text>
          </Pressable>
        )}

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
        <Text style={styles.hint}>Escribe el lugar y comprueba el punto en el mapa, o usa tu ubicación si ya estás allí.</Text>

        {lat && lng ? (
          <GoogleMapCard
            query={locationName}
            latitude={lat}
            longitude={lng}
            label={locationName.trim() || 'esta quedada'}
            onLocationChange={(coords) => {
              setLat(String(coords.lat));
              setLng(String(coords.lng));
            }}
          />
        ) : null}
      </Field>

      <Field label="Descripción (opcional)">
        <TextInput style={[styles.input, styles.textarea]} placeholder="Ritmo, nivel, qué llevar…" placeholderTextColor={colors.textDim}
          value={description} onChangeText={setDescription} multiline />
      </Field>

      <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
        <Text style={styles.btnPrimaryText}>{saving ? 'Guardando…' : editingMeetup ? 'Guardar cambios' : 'Crear quedada'}</Text>
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
  previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 2 },
  previewBtnText: { color: colors.accentStrong, fontSize: 13, fontWeight: '700' },
  locatedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  locatedText: { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  locatedRemove: { color: colors.clay, fontSize: 12, fontWeight: '700' },
  hint: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  btnPrimaryText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
