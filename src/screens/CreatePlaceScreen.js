import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconFor } from '../lib/sports';
import { geocodeLocation, getCurrentCoordinates } from '../lib/location';
import GoogleMapCard from '../components/GoogleMapCard';
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
  const [searchingMap, setSearchingMap] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('sports').select('*').order('name').then(({ data }) => {
      const list = data || [];
      setSports(list);
      const preferred = list.find((s) => sportIds.includes(s.id));
      setSportId((preferred || list[0])?.id || null);
    });
  }, [sportIds]);

  async function useMyLocation() {
    setLocating(true);
    try {
      const coords = await getCurrentCoordinates();
      setLat(String(coords.lat));
      setLng(String(coords.lng));
    } catch (_error) {
      Alert.alert('No se pudo usar tu ubicación', 'Puedes escribir la dirección del sitio manualmente.');
    } finally {
      setLocating(false);
    }
  }

  async function findOnMap() {
    if (!address.trim() || searchingMap) return;
    setSearchingMap(true);
    try {
      const coords = await geocodeLocation(address);
      setLat(String(coords.lat));
      setLng(String(coords.lng));
    } catch (_error) {
      Alert.alert('No encontramos la dirección', 'Prueba a añadir la ciudad o una dirección más completa.');
    } finally {
      setSearchingMap(false);
    }
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
          value={address} onChangeText={(value) => { setAddress(value); setLat(''); setLng(''); }}
          onSubmitEditing={findOnMap} />

        {!!address.trim() && !lat && !lng && (
          <Pressable style={styles.previewBtn} onPress={findOnMap} disabled={searchingMap}>
            <Ionicons name="map-outline" size={17} color={colors.accentStrong} />
            <Text style={styles.previewBtnText}>{searchingMap ? 'Buscando dirección…' : 'Ver esta dirección en el mapa'}</Text>
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
        <Text style={styles.hint}>Escribe una dirección y comprueba el punto en el mapa, o usa tu ubicación si ya estás allí.</Text>

        {lat && lng ? (
          <GoogleMapCard
            query={address}
            latitude={lat}
            longitude={lng}
            label={address.trim() || name.trim() || 'este sitio'}
          />
        ) : null}
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
  previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 2 },
  previewBtnText: { color: colors.accentStrong, fontSize: 13, fontWeight: '700' },
  locatedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  locatedText: { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  locatedRemove: { color: colors.clay, fontSize: 12, fontWeight: '700' },
  hint: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  btnPrimaryText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
