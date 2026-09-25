import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { colors, shape } from '../lib/theme';
import { iconFor } from '../lib/sports';
import { checkActivityBadges } from '../lib/awardBadges';

const WHEN = [{ label: 'Hoy', days: 0 }, { label: 'Mañana', days: 1 }, { label: 'En 3 días', days: 3 }, { label: 'Próxima semana', days: 7 }];
const DURATIONS = [30, 45, 60, 90];

export default function TrainingCalendarScreen() {
  const { user, sportIds } = useAuth();
  const [sports, setSports] = useState([]);
  const [events, setEvents] = useState([]);
  const [sportId, setSportId] = useState(sportIds?.[0] || 'running');
  const [title, setTitle] = useState('');
  const [dayOffset, setDayOffset] = useState(1);
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: sportRows }, { data: eventRows }] = await Promise.all([
      supabase.from('sports').select('*').order('name'),
      supabase.from('training_events').select('*').eq('profile_id', user.id).order('scheduled_for').limit(40),
    ]);
    const preferred = (sportRows || []).filter((sport) => !sportIds?.length || sportIds.includes(sport.id));
    setSports(preferred.length ? preferred : (sportRows || []));
    setEvents(eventRows || []);
  }, [sportIds, user]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => ({
    upcoming: events.filter((event) => event.status === 'planned' && new Date(event.scheduled_for).getTime() >= Date.now() - 86400000),
    history: events.filter((event) => event.status !== 'planned' || new Date(event.scheduled_for).getTime() < Date.now() - 86400000).reverse().slice(0, 8),
  }), [events]);

  async function addEvent() {
    if (!user || saving) return;
    setSaving(true);
    const sport = sports.find((item) => item.id === sportId);
    const scheduled = new Date();
    scheduled.setDate(scheduled.getDate() + dayOffset);
    scheduled.setHours(18, 0, 0, 0);
    const { error } = await supabase.from('training_events').insert({
      profile_id: user.id,
      sport_id: sportId,
      title: title.trim() || `Entrenamiento de ${sport?.name || 'deporte'}`,
      scheduled_for: scheduled.toISOString(),
      duration_min: duration,
    });
    setSaving(false);
    if (error) Alert.alert('No se pudo planificar', error.message);
    else { setTitle(''); load(); }
  }

  async function setStatus(event, status) {
    await supabase.from('training_events').update({ status }).eq('id', event.id).eq('profile_id', user.id);
    if (status === 'completed') {
      await supabase.from('daily_checkins').upsert({ profile_id: user.id, sport_id: event.sport_id, check_date: new Date().toISOString().slice(0, 10) }, { onConflict: 'profile_id,check_date' });
      await checkActivityBadges(user.id);
    }
    load();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.intro}><Text style={styles.eyebrow}>TU PLAN</Text><Text style={styles.title}>Pon fecha al próximo entrenamiento</Text><Text style={styles.muted}>Planear algo concreto hace más fácil cumplirlo.</Text></View>
      <View style={styles.form}>
        <Text style={styles.label}>Deporte</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.chips}>{sports.map((sport) => <Chip key={sport.id} active={sport.id === sportId} onPress={() => setSportId(sport.id)} label={sport.name} icon={iconFor(sport.id)} />)}</View></ScrollView>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Nombre opcional: rodaje suave, pierna…" placeholderTextColor={colors.textDim} />
        <Text style={styles.label}>Cuándo</Text><View style={styles.chips}>{WHEN.map((option) => <Chip key={option.days} active={dayOffset === option.days} onPress={() => setDayOffset(option.days)} label={option.label} />)}</View>
        <Text style={styles.label}>Duración estimada</Text><View style={styles.chips}>{DURATIONS.map((value) => <Chip key={value} active={duration === value} onPress={() => setDuration(value)} label={`${value} min`} />)}</View>
        <Pressable style={styles.primary} onPress={addEvent} disabled={saving}><Text style={styles.primaryText}>{saving ? 'Guardando…' : 'Añadir al calendario'}</Text></Pressable>
      </View>

      <Heading title="Próximos entrenamientos" count={grouped.upcoming.length} />
      {!grouped.upcoming.length && <View style={styles.empty}><Ionicons name="calendar-outline" size={28} color={colors.textDim} /><Text style={styles.muted}>Todavía no tienes ningún entrenamiento previsto.</Text></View>}
      {grouped.upcoming.map((event) => <EventCard key={event.id} event={event} onStatus={setStatus} />)}

      {!!grouped.history.length && <><Heading title="Actividad reciente" count={grouped.history.length} />{grouped.history.map((event) => <EventCard key={event.id} event={event} />)}</>}
    </ScrollView>
  );
}

function Chip({ active, label, icon, onPress }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>{icon && <Ionicons name={icon} size={14} color={active ? colors.bg : colors.textDim} />}<Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
function Heading({ title, count }) { return <View style={styles.heading}><Text style={styles.headingText}>{title}</Text><Text style={styles.count}>{count}</Text></View>; }
function EventCard({ event, onStatus }) { const date = new Date(event.scheduled_for); const state = { completed: ['checkmark-circle', 'Completado'], skipped: ['remove-circle-outline', 'Saltado'], planned: ['time-outline', 'Planificado'] }[event.status]; return <View style={styles.event}><View style={styles.date}><Text style={styles.day}>{date.getDate()}</Text><Text style={styles.month}>{date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '').toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.muted}>{date.toLocaleDateString('es-ES', { weekday: 'long' })} · {event.duration_min || 0} min</Text><View style={styles.state}><Ionicons name={state[0]} size={14} color={event.status === 'completed' ? colors.accentStrong : colors.textDim} /><Text style={styles.stateText}>{state[1]}</Text></View></View>{onStatus && event.status === 'planned' && <View style={styles.eventActions}><Pressable onPress={() => onStatus(event, 'completed')} style={styles.done}><Ionicons name="checkmark" size={18} color={colors.bg} /></Pressable><Pressable onPress={() => onStatus(event, 'skipped')} style={styles.skip}><Ionicons name="close" size={17} color={colors.textDim} /></Pressable></View>}</View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 16, paddingBottom: 46, gap: 12 }, intro: { paddingVertical: 6 }, eyebrow: { color: colors.accentStrong, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, title: { color: colors.text, fontSize: 23, fontWeight: '900', marginVertical: 4 }, muted: { color: colors.textDim, fontSize: 11, lineHeight: 16 }, form: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 19, padding: 14, gap: 11 }, label: { color: colors.textDim, fontSize: 10, textTransform: 'uppercase', fontWeight: '800' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surface2, ...shape.tag, paddingHorizontal: 11, paddingVertical: 8 }, chipActive: { backgroundColor: colors.accent }, chipText: { color: colors.textDim, fontSize: 11, fontWeight: '700' }, chipTextActive: { color: colors.bg }, input: { color: colors.text, backgroundColor: colors.surface2, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 11, fontSize: 12 }, primary: { backgroundColor: colors.accent, ...shape.button, paddingVertical: 13, alignItems: 'center' }, primaryText: { color: colors.bg, fontWeight: '900', fontSize: 13 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }, headingText: { color: colors.text, fontSize: 16, fontWeight: '900' }, count: { color: colors.bg, backgroundColor: colors.accentStrong, minWidth: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20, fontSize: 10, fontWeight: '900' }, empty: { borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', borderRadius: 17, padding: 22, alignItems: 'center', gap: 9 }, event: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 12 }, date: { width: 46, height: 52, borderRadius: 13, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }, day: { color: colors.text, fontSize: 18, fontWeight: '900' }, month: { color: colors.accentStrong, fontSize: 9, fontWeight: '900' }, eventTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 2 }, state: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }, stateText: { color: colors.textDim, fontSize: 9, fontWeight: '700' }, eventActions: { gap: 7 }, done: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, skip: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
});
