import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';
import { formatMetric, metricLabel } from '../lib/engagement';
import Avatar from '../components/Avatar';
import SportLoader from '../components/SportLoader';

const TARGETS = { sessions: [3, 5, 7, 10], distance_km: [5, 10, 20, 50], minutes: [60, 120, 180, 300] };

export default function CreateSocialChallengeScreen({ navigation }) {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [title, setTitle] = useState('Reto de la semana');
  const [mode, setMode] = useState('team');
  const [metric, setMetric] = useState('sessions');
  const [target, setTarget] = useState(5);
  const [duration, setDuration] = useState(7);

  const load = useCallback(async () => {
    if (!user) return;
    const [following, followers] = await Promise.all([
      supabase.from('follows').select('profile:following_id(id, username, display_name, avatar_url)').eq('follower_id', user.id).eq('pending', false),
      supabase.from('follows').select('profile:follower_id(id, username, display_name, avatar_url)').eq('following_id', user.id).eq('pending', false),
    ]);
    const map = new Map();
    [...(following.data || []), ...(followers.data || [])].forEach((row) => { if (row.profile) map.set(row.profile.id, row.profile); });
    setPeople([...map.values()]);
    setLoading(false);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const selectedCount = selected.size;
  const helper = useMemo(() => mode === 'team' ? `Entre todos debéis sumar ${formatMetric(metric, target)}.` : `Cada persona intenta llegar primero a ${formatMetric(metric, target)}.`, [metric, mode, target]);

  function chooseMetric(value) {
    setMetric(value);
    setTarget(TARGETS[value][1]);
  }

  function toggle(id) {
    setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else if (next.size < 10) next.add(id); return next; });
  }

  async function create() {
    if (!title.trim()) return Alert.alert('Falta el nombre', 'Pon un nombre al reto.');
    if (!selectedCount) return Alert.alert('Elige compañía', 'Selecciona al menos una persona.');
    setSaving(true);
    const { error } = await supabase.rpc('create_social_challenge', {
      p_title: title.trim(), p_mode: mode, p_metric: metric, p_target: target,
      p_duration_days: duration, p_invitee_ids: [...selected],
    });
    setSaving(false);
    if (error) return Alert.alert('No se pudo crear', error.message);
    navigation.goBack();
  }

  if (loading) return <View style={styles.center}><SportLoader label="Buscando a tu gente" /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>NUEVO RETO SOCIAL</Text>
      <Text style={styles.title}>¿Competís o sumáis juntos?</Text>
      <View style={styles.modeRow}>
        <ModeCard icon="people" title="En equipo" text="Todo el progreso se suma." active={mode === 'team'} onPress={() => setMode('team')} />
        <ModeCard icon="flash" title="Competición" text="Gana quien llegue primero." active={mode === 'race'} onPress={() => setMode('race')} />
      </View>

      <Label text="Nombre del reto" />
      <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={60} placeholder="Ej. Semana sin excusas" placeholderTextColor={colors.textDim} />

      <Label text="Qué vais a conseguir" />
      <View style={styles.chips}>{Object.keys(TARGETS).map((value) => <Chip key={value} label={metricLabel(value)} active={metric === value} onPress={() => chooseMetric(value)} />)}</View>
      <View style={styles.chips}>{TARGETS[metric].map((value) => <Chip key={value} label={formatMetric(metric, value)} active={target === value} onPress={() => setTarget(value)} />)}</View>
      <View style={styles.helper}><Ionicons name="information-circle-outline" size={17} color={colors.accentStrong} /><Text style={styles.helperText}>{helper}</Text></View>

      <Label text="Duración" />
      <View style={styles.chips}>{[7, 14, 30].map((value) => <Chip key={value} label={`${value} días`} active={duration === value} onPress={() => setDuration(value)} />)}</View>

      <Label text={`Invita a tus amigos · ${selectedCount} seleccionados`} />
      {!people.length ? (
        <View style={styles.empty}><Ionicons name="person-add-outline" size={28} color={colors.textDim} /><Text style={styles.emptyTitle}>Necesitas conectar con alguien</Text><Text style={styles.muted}>Sigue a deportistas o acepta seguidores para poder retarles.</Text><Pressable style={styles.discover} onPress={() => navigation.navigate('Tabs', { screen: 'Explorar' })}><Text style={styles.discoverText}>Descubrir personas</Text></Pressable></View>
      ) : people.map((person) => {
        const active = selected.has(person.id);
        return <Pressable key={person.id} style={[styles.person, active && styles.personActive]} onPress={() => toggle(person.id)}><Avatar url={person.avatar_url} name={person.display_name || person.username} size={40} /><View style={{ flex: 1 }}><Text style={styles.personName}>{person.display_name || person.username}</Text><Text style={styles.muted}>@{person.username}</Text></View><Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={active ? colors.accentStrong : colors.textDim} /></Pressable>;
      })}

      <Pressable style={[styles.create, (!selectedCount || saving) && styles.disabled]} onPress={create} disabled={!selectedCount || saving}>
        <Text style={styles.createText}>{saving ? 'Creando…' : `Crear reto e invitar a ${selectedCount || 0}`}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Label({ text }) { return <Text style={styles.label}>{text}</Text>; }
function Chip({ label, active, onPress }) { return <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
function ModeCard({ icon, title, text, active, onPress }) { return <Pressable style={[styles.mode, active && styles.modeActive]} onPress={onPress}><Ionicons name={icon} size={23} color={active ? colors.amber : colors.textDim} /><Text style={styles.modeTitle}>{title}</Text><Text style={styles.modeText}>{text}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 16, paddingBottom: 46, gap: 11 }, center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }, eyebrow: { color: colors.accentStrong, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, title: { color: colors.text, fontSize: 23, fontWeight: '900', marginBottom: 5 }, modeRow: { flexDirection: 'row', gap: 9 }, mode: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 13, gap: 4 }, modeActive: { borderColor: colors.amber, backgroundColor: colors.surface2 }, modeTitle: { color: colors.text, fontSize: 13, fontWeight: '900' }, modeText: { color: colors.textDim, fontSize: 10, lineHeight: 14 }, label: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 7 }, input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 13, color: colors.text, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, chipActive: { backgroundColor: colors.accent }, chipText: { color: colors.textDim, fontSize: 11, fontWeight: '800' }, chipTextActive: { color: colors.bg }, helper: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surface, borderRadius: 12, padding: 10 }, helperText: { flex: 1, color: colors.textDim, fontSize: 10, lineHeight: 14 }, person: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 11 }, personActive: { borderColor: colors.accent }, personName: { color: colors.text, fontSize: 13, fontWeight: '800' }, muted: { color: colors.textDim, fontSize: 11, lineHeight: 16 }, empty: { alignItems: 'center', gap: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 22 }, emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '800' }, discover: { marginTop: 5, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }, discoverText: { color: colors.accentStrong, fontSize: 11, fontWeight: '900' }, create: { backgroundColor: colors.accent, borderRadius: 999, alignItems: 'center', paddingVertical: 14, marginTop: 8 }, disabled: { opacity: 0.45 }, createText: { color: colors.bg, fontSize: 13, fontWeight: '900' },
});
