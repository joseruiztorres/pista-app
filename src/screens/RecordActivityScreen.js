import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconFor } from '../lib/sports';
import { haversineKm } from '../lib/geo';
import RouteRecorder from '../components/RouteRecorder';
import { colors } from '../lib/theme';

const GPS_SPORTS = ['running', 'ciclismo', 'caminar', 'senderismo', 'trail', 'patinaje'];

function cropRoute(route, meters = 200) {
  if (!route || route.length < 3) return route;
  let start = 0;
  let accumulated = 0;
  while (start < route.length - 1 && accumulated < meters / 1000) {
    accumulated += haversineKm(route[start], route[start + 1]);
    start += 1;
  }
  let end = route.length - 1;
  accumulated = 0;
  while (end > start && accumulated < meters / 1000) {
    accumulated += haversineKm(route[end], route[end - 1]);
    end -= 1;
  }
  return route.slice(start, end + 1);
}

export default function RecordActivityScreen({ navigation }) {
  const { user } = useAuth();
  const [sports, setSports] = useState([]);
  const [sportId, setSportId] = useState('running');
  const [activity, setActivity] = useState(null);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState('public');
  const [hideEnds, setHideEnds] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('sports').select('*').in('id', GPS_SPORTS).order('name').then(({ data }) => setSports(data || []));
    AsyncStorage.getItem('@pista:last_gps_sport').then((value) => { if (value && GPS_SPORTS.includes(value)) setSportId(value); });
  }, []);

  const metrics = useMemo(() => {
    if (!activity) return null;
    const hours = activity.durationSec / 3600;
    const pace = activity.distanceKm > 0 ? activity.durationSec / 60 / activity.distanceKm : 0;
    return {
      pace: pace ? `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, '0')}/km` : '—',
      speed: hours > 0 ? `${(activity.distanceKm / hours).toFixed(1)} km/h` : '—',
    };
  }, [activity]);

  async function publish() {
    if (!activity || !user || saving) return;
    setSaving(true);
    try {
      const publicRoute = hideEnds ? cropRoute(activity.route) : activity.route;
      const details = {
        route: publicRoute,
        distance_km: Number(activity.distanceKm.toFixed(2)),
        duration_min: Math.max(1, Math.round(activity.durationSec / 60)),
        duration_sec: activity.durationSec,
        elevation_m: activity.elevationM || 0,
        pace_min_km: sportId === 'running' || sportId === 'caminar' || sportId === 'senderismo' || sportId === 'trail' ? metrics.pace : null,
        avg_speed_kmh: sportId === 'ciclismo' || sportId === 'patinaje' ? metrics.speed : null,
        hidden_ends: hideEnds,
      };
      const { error } = await supabase.from('posts').insert({
        author_id: user.id, sport_id: sportId, type: 'ruta', caption: caption.trim() || null, details, audience,
      });
      if (error) throw error;
      await Promise.all([
        AsyncStorage.setItem('@pista:last_gps_sport', sportId),
        supabase.from('daily_checkins').upsert({ profile_id: user.id, sport_id: sportId, check_date: new Date().toISOString().slice(0, 10) }, { onConflict: 'profile_id,check_date' }),
      ]);
      setActivity(null);
      setCaption('');
      Alert.alert('Actividad guardada', 'El recorrido ya aparece en tu perfil y en el feed.');
      navigation.navigate('Inicio');
    } catch (error) {
      Alert.alert('No se pudo guardar', error.message);
    } finally { setSaving(false); }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>ACTIVIDAD</Text><Text style={styles.title}>Registrar entrenamiento</Text></View>
        <Ionicons name="navigate-circle" size={34} color={colors.accent} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sports}>
        {sports.map((sport) => (
          <Pressable key={sport.id} style={[styles.sport, sportId === sport.id && styles.sportActive]} onPress={() => { setSportId(sport.id); setActivity(null); }}>
            <Ionicons name={iconFor(sport.id)} size={17} color={sportId === sport.id ? colors.bg : colors.textDim} />
            <Text style={[styles.sportText, sportId === sport.id && styles.sportTextActive]}>{sport.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.card}>
        <RouteRecorder onFinish={setActivity} />
        {!activity && <Text style={styles.hint}>Mantén Pista abierta durante esta primera versión del registro. La aplicación móvil permitirá grabar también con la pantalla bloqueada.</Text>}
      </View>

      {activity && (
        <>
          <View style={styles.metrics}>
            <Metric value={`${activity.distanceKm.toFixed(2)} km`} label="Distancia" />
            <Metric value={`${Math.round(activity.durationSec / 60)} min`} label="Tiempo" />
            <Metric value={sportId === 'ciclismo' || sportId === 'patinaje' ? metrics.speed : metrics.pace} label={sportId === 'ciclismo' || sportId === 'patinaje' ? 'Velocidad' : 'Ritmo'} />
            <Metric value={`${activity.elevationM || 0} m`} label="Desnivel" />
          </View>
          <TextInput style={styles.input} placeholder="¿Cómo ha ido el entrenamiento?" placeholderTextColor={colors.textDim} value={caption} onChangeText={setCaption} multiline />
          <Text style={styles.sectionLabel}>Quién puede verlo</Text>
          <View style={styles.row}>{[['public','Todo el mundo'],['followers','Seguidores'],['private','Solo yo']].map(([id,label]) => <Choice key={id} active={audience === id} label={label} onPress={() => setAudience(id)} />)}</View>
          <Pressable style={styles.privacyRow} onPress={() => setHideEnds((value) => !value)}>
            <Ionicons name={hideEnds ? 'shield-checkmark' : 'shield-outline'} size={20} color={hideEnds ? colors.accentStrong : colors.textDim} />
            <View style={{ flex: 1 }}><Text style={styles.privacyTitle}>Ocultar inicio y final</Text><Text style={styles.hint}>Recorta aproximadamente 200 m para no revelar casa o trabajo.</Text></View>
            <Ionicons name={hideEnds ? 'checkbox' : 'square-outline'} size={20} color={colors.accentStrong} />
          </Pressable>
          <Pressable style={styles.publish} onPress={publish} disabled={saving}><Text style={styles.publishText}>{saving ? 'Guardando…' : 'Guardar y compartir'}</Text></Pressable>
        </>
      )}
    </ScrollView>
  );
}

function Metric({ value, label }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Choice({ active, label, onPress }) { return <Pressable style={[styles.choice, active && styles.choiceActive]} onPress={onPress}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 16, paddingTop: 22, paddingBottom: 42, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { color: colors.accentStrong, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, title: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 2 },
  sports: { gap: 8, paddingVertical: 2 }, sport: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.surface2, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999 }, sportActive: { backgroundColor: colors.accent }, sportText: { color: colors.textDim, fontSize: 12, fontWeight: '700' }, sportTextActive: { color: colors.bg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, gap: 10 }, hint: { color: colors.textDim, fontSize: 11, lineHeight: 16 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, metric: { width: '48%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12 }, metricValue: { color: colors.text, fontSize: 17, fontWeight: '900' }, metricLabel: { color: colors.textDim, fontSize: 10, marginTop: 3 },
  input: { minHeight: 76, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, textAlignVertical: 'top' }, sectionLabel: { color: colors.textDim, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, choiceActive: { backgroundColor: colors.accent }, choiceText: { color: colors.textDim, fontSize: 11, fontWeight: '700' }, choiceTextActive: { color: colors.bg },
  privacyRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12 }, privacyTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  publish: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center' }, publishText: { color: colors.bg, fontSize: 15, fontWeight: '900' },
});
