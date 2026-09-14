import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconFor } from '../lib/sports';
import { colors } from '../lib/theme';

export default function CreatePlaceScreen({ navigation, route }) {
  const { user, sportIds } = useAuth();
  const returnTo = route.params?.returnTo; // pantalla a la que volver con el sitio ya creado (p.ej. CrearPost)
  const [sports, setSports] = useState([]);
  const [sportId, setSportId] = useState(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
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
      Alert.alert('No disponible', 'Este dispositivo no permite compartir ubicación desde aquí.');
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
        Alert.alert('No se pudo obtener la ubicación', 'Comprueba los permisos de ubicación del navegador.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSave() {
    if (!user || !name.trim()) {
      Alert.alert('Falta el nombre', 'Escribe el nombre del sitio.');
      return;
    }
    setSaving(true);
    try {
      const { data: place, error } = await supabase
        .from('places')
        .insert({
          name: name.trim(),
          sport_id: sportId,
          address: address.trim() || null,
          lat: lat ? Number(lat) : null,
          lng: lng ? Number(lng) : null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      if (returnTo) {
        navigation.navigate(returnTo, { selectedPlace: place });
      } else {
        navigation.replace('PlaceDetail', { placeId: place.id });
      }
    } catch (err) {
      Alert.alert('No se pudo crear el sitio', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Field label="Nombre">
        <TextInput style={styles.input} placeholder="Ej. Box Crossfit Poblenou" placeholderTextColor={colors.textDim}
          value={name} onChangeText={setName} />
      </Field>

      <Field label="Deporte (opcional)">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip active={sportId === null} onPress={() => setSportId(null)} label="General" />
            {sports.map((s) => (
              <Chip key={s.id} active={sportId === s.id} onPress={() => setSportId(s.id)} icon={iconFor(s.id)} label={s.name} />
            ))}
          </View>
        </ScrollView>
      </Field>

      <Field label="Dirección (opcional)">
        <TextInput style={styles.input} placeholder="Calle, ciudad…" placeholderTextColor={colors.textDim}
          value={address} onChangeText={setAddress} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="lat" placeholderTextColor={colors.textDim}
            keyboardType="numeric" value={lat} onChangeText={setLat} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="lng" placeholderTextColor={colors.textDim}
            keyboardType="numeric" value={lng} onChangeText={setLng} />
        </View>
        <Pressable style={styles.secondaryBtn} onPress={useMyLocation} disabled={locating}>
          <Ionicons name="navigate-outline" size={16} color={colors.accentStrong} />
          <Text style={styles.secondaryBtnText}>{locating ? 'Localizando…' : 'Usar mi ubicación actual'}</Text>
        </Pressable>
      </Field>

      <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
        <Text style={styles.btnPrimaryText}>{saving ? 'Creando…' : 'Crear sitio'}</Text>
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
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4 },
  secondaryBtnText: { color: colors.accentStrong, fontSize: 13, fontWeight: '600' },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  btnPrimaryText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
