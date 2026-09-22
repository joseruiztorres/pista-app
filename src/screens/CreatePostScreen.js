import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconFor } from '../lib/sports';
import { checkFirstPostBadge } from '../lib/awardBadges';
import RouteRecorder from '../components/RouteRecorder';
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

export default function CreatePostScreen({ navigation, route: navRoute }) {
  const { user, sportIds } = useAuth();
  const [sports, setSports] = useState([]);
  const [sportId, setSportId] = useState(null);
  const [type, setType] = useState(navRoute?.params?.presetType || 'ruta');
  const [caption, setCaption] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [elevationM, setElevationM] = useState('');
  const [route, setRoute] = useState(null);
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);

  const [place, setPlace] = useState(navRoute?.params?.presetPlace || null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    Promise.all([
      supabase.from('sports').select('*').order('name'),
      AsyncStorage.getItem('@pista:last_sport'),
    ]).then(([{ data }, lastSport]) => {
      const list = data || [];
      setSports(list);
      const preferred = list.find((s) => s.id === lastSport) || list.find((s) => sportIds.includes(s.id));
      setSportId((preferred || list[0])?.id || null);
    });
  }, [sportIds]);

  // Vuelta desde CreatePlaceScreen con el sitio recién creado.
  useEffect(() => {
    if (navRoute?.params?.selectedPlace) {
      setPlace(navRoute.params.selectedPlace);
      setType('resena');
    }
  }, [navRoute?.params?.selectedPlace]);

  useEffect(() => {
    if (!placeQuery.trim()) { setPlaceResults([]); return; }
    let active = true;
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('places').select('*').ilike('name', `%${placeQuery.trim()}%`).limit(6);
      if (active) setPlaceResults(data || []);
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [placeQuery]);

  const isRouteSport = ROUTE_SPORTS.includes(sportId);

  function handleRouteFinish({ route: recordedRoute, distanceKm: d, durationMin: m }) {
    setRoute(recordedRoute);
    setDistanceKm(d.toFixed(2));
    setDurationMin(String(m));
  }

  const MAX_PHOTOS = 4;

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets].slice(0, MAX_PHOTOS));
    }
  }

  function removeImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
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
      if (type === 'resena' && rating) details.rating = rating;

      const { data: post, error } = await supabase
        .from('posts')
        .insert({ author_id: user.id, sport_id: sportId, type, caption, details, place_id: type === 'resena' ? place?.id || null : null })
        .select()
        .single();
      if (error) throw error;

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const ext = img.uri.split('.').pop().split('?')[0] || 'jpg';
        const path = `${user.id}/${post.id}_${i}.${ext}`;
        const response = await fetch(img.uri);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage.from('media').upload(path, blob, { contentType: img.mimeType || 'image/jpeg' });
        if (!uploadError) {
          const { data: pub } = supabase.storage.from('media').getPublicUrl(path);
          await supabase.from('post_media').insert({ post_id: post.id, url: pub.publicUrl, position: i });
        }
      }

      await checkFirstPostBadge(user.id);
      await AsyncStorage.setItem('@pista:last_sport', sportId);
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
          <RouteRecorder onFinish={handleRouteFinish} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="km" placeholderTextColor={colors.textDim}
              keyboardType="numeric" value={distanceKm} onChangeText={setDistanceKm} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="min" placeholderTextColor={colors.textDim}
              keyboardType="numeric" value={durationMin} onChangeText={setDurationMin} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="desnivel m" placeholderTextColor={colors.textDim}
              keyboardType="numeric" value={elevationM} onChangeText={setElevationM} />
          </View>
          <Text style={styles.hint}>La distancia y el tiempo se rellenan solos al grabar con GPS; también puedes editarlos a mano.</Text>
        </Field>
      )}

      {type === 'resena' && (
        <Field label="Sitio">
          {place ? (
            <View style={styles.selectedPlace}>
              <Ionicons name="location" size={16} color={colors.accent} />
              <Text style={styles.selectedPlaceText}>{place.name}</Text>
              <Pressable onPress={() => setPlace(null)}>
                <Ionicons name="close-circle" size={18} color={colors.textDim} />
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput style={styles.input} placeholder="Busca un gimnasio, parque, ruta…" placeholderTextColor={colors.textDim}
                value={placeQuery} onChangeText={setPlaceQuery} />
              {placeResults.map((p) => (
                <Pressable key={p.id} style={styles.placeResultRow} onPress={() => { setPlace(p); setPlaceQuery(''); setPlaceResults([]); }}>
                  <Ionicons name="location-outline" size={14} color={colors.textDim} />
                  <Text style={styles.placeResultText}>{p.name}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('CreatePlace', { returnTo: 'CrearPost' })}>
                <Ionicons name="add-circle-outline" size={16} color={colors.accentStrong} />
                <Text style={styles.secondaryBtnText}>Añadir un sitio nuevo</Text>
              </Pressable>
            </>
          )}

          <Text style={[styles.label, { marginTop: 6 }]}>Tu nota</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)}>
                <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={26} color={colors.amber} />
              </Pressable>
            ))}
          </View>
        </Field>
      )}

      <Field label={`Fotos (opcional, hasta ${MAX_PHOTOS})`}>
        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {images.map((img, i) => (
                <View key={i} style={styles.thumbWrap}>
                  <Image source={{ uri: img.uri }} style={styles.thumb} />
                  <Pressable style={styles.thumbRemove} onPress={() => removeImage(i)}>
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
        {images.length < MAX_PHOTOS && (
          <Pressable style={styles.imagePicker} onPress={pickImage}>
            <Ionicons name="camera-outline" size={22} color={colors.textDim} />
            <Text style={styles.imagePickerText}>Toca para elegir {images.length > 0 ? 'más fotos' : 'una foto'}</Text>
          </Pressable>
        )}
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
  hint: { color: colors.textDim, fontSize: 11 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4 },
  secondaryBtnText: { color: colors.accentStrong, fontSize: 13, fontWeight: '600' },
  selectedPlace: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  selectedPlaceText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  placeResultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  placeResultText: { color: colors.text, fontSize: 13 },
  imagePicker: { height: 140, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden' },
  imagePickerText: { color: colors.textDim, fontSize: 13 },
  thumbWrap: { width: 84, height: 84, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface2 },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  btnPrimaryText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
