import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconFor } from '../lib/sports';
import { colors, shape } from '../lib/theme';
import GoogleMapCard from '../components/GoogleMapCard';
import { checkActivityBadges } from '../lib/awardBadges';
import { alert } from '../lib/alert';

function formatWhen(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${day} a las ${time}`;
}

export default function MeetupDetailScreen({ route, navigation }) {
  const { meetupId } = route.params;
  const { user } = useAuth();
  const [meetup, setMeetup] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: meetupRow } = await supabase
      .from('meetups')
      .select('*, profiles:organizer_id(username, display_name)')
      .eq('id', meetupId)
      .maybeSingle();
    setMeetup(meetupRow || null);

    const { data: attendeeRows } = await supabase
      .from('meetup_attendees')
      .select('profile_id, profiles:profile_id(username, display_name)')
      .eq('meetup_id', meetupId);
    setAttendees(attendeeRows || []);
    setJoined((attendeeRows || []).some((a) => a.profile_id === user?.id));
  }, [meetupId, user]);

  useEffect(() => { load(); }, [load]);

  async function toggleJoin() {
    if (!user || busy) return;
    setBusy(true);
    if (joined) {
      await supabase.from('meetup_attendees').delete().eq('meetup_id', meetupId).eq('profile_id', user.id);
    } else {
      await supabase.from('meetup_attendees').insert({ meetup_id: meetupId, profile_id: user.id });
    }
    await checkActivityBadges(user.id);
    await load();
    setBusy(false);
  }

  async function handleDelete() {
    alert('Cancelar quedada', '¿Seguro que quieres cancelarla? No se puede deshacer.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar', style: 'destructive', onPress: async () => {
          await supabase.from('meetups').delete().eq('id', meetupId);
          navigation.goBack();
        },
      },
    ]);
  }

  if (!meetup) return <View style={styles.screen} />;

  const isOrganizer = meetup.organizer_id === user?.id;
  const isFull = meetup.capacity && attendees.length >= meetup.capacity;
  const levelLabel = {
    todos: 'Todos los niveles', principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado',
  }[meetup.level || 'todos'];

  return (
    <FlatList
      style={styles.screen}
      data={attendees}
      keyExtractor={(a) => a.profile_id}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ gap: 14, marginBottom: 18 }}>
          <View style={styles.sportRow}>
            <Ionicons name={iconFor(meetup.sport_id)} size={16} color={colors.accentStrong} />
            <Text style={styles.when}>{formatWhen(meetup.scheduled_at)}</Text>
          </View>
          <Text style={styles.title}>{meetup.title}</Text>
          {!!meetup.description && <Text style={styles.description}>{meetup.description}</Text>}

          <View style={styles.infoRow}>
            <View style={styles.infoChip}>
              <Ionicons name="speedometer-outline" size={14} color={colors.accentStrong} />
              <Text style={styles.infoText}>{levelLabel}</Text>
            </View>
            <View style={styles.infoChip}>
              <Ionicons name="people-outline" size={14} color={colors.accentStrong} />
              <Text style={styles.infoText}>{meetup.capacity ? `${attendees.length}/${meetup.capacity} plazas` : 'Sin límite de plazas'}</Text>
            </View>
          </View>

          <View style={styles.locationCard}>
            <Ionicons name="location-outline" size={18} color={colors.textDim} />
            <Text style={styles.locationText}>{meetup.location_name}</Text>
          </View>

          <GoogleMapCard
            query={meetup.location_name}
            latitude={meetup.lat}
            longitude={meetup.lng}
            label={meetup.location_name}
          />

          <Text style={styles.organizer}>Organiza {meetup.profiles?.display_name || meetup.profiles?.username}</Text>

          {!isOrganizer ? (
            <Pressable style={[styles.btnPrimary, joined && styles.btnJoined, isFull && !joined && styles.btnDisabled]} onPress={toggleJoin} disabled={busy || (isFull && !joined)}>
              <Text style={[styles.btnPrimaryText, joined && styles.btnJoinedText]}>
                {joined ? 'Apuntado ✓ · dejar quedada' : isFull ? 'Quedada completa' : 'Apuntarme'}
              </Text>
            </Pressable>
          ) : (
            <View style={{ gap: 10 }}>
              <Pressable style={styles.btnSecondary} onPress={() => navigation.navigate('CreateMeetup', { meetup })}>
                <Ionicons name="create-outline" size={16} color={colors.accentStrong} />
                <Text style={styles.btnSecondaryText}>Editar quedada</Text>
              </Pressable>
              <Pressable style={styles.btnDanger} onPress={handleDelete}>
                <Text style={styles.btnDangerText}>Cancelar quedada</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.label}>Apuntados ({attendees.length})</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>Nadie apuntado todavía.</Text>}
      renderItem={({ item }) => (
        <View style={styles.attendee}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.profiles?.display_name || item.profiles?.username || '?').slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={styles.attendeeName}>{item.profiles?.display_name || item.profiles?.username}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  sportRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  when: { color: colors.amber, fontSize: 13, fontWeight: '700' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  description: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  infoText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.line },
  locationText: { color: colors.text, fontSize: 13, flex: 1 },
  organizer: { color: colors.textDim, fontSize: 12 },
  btnPrimary: { backgroundColor: colors.accent, ...shape.button, paddingVertical: 14, alignItems: 'center' },
  btnPrimaryText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  btnJoined: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  btnJoinedText: { color: colors.text },
  btnDisabled: { opacity: 0.45 },
  btnSecondary: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.accent, ...shape.button, paddingVertical: 13 },
  btnSecondaryText: { color: colors.accentStrong, fontSize: 14, fontWeight: '800' },
  btnDanger: { borderWidth: 1, borderColor: colors.clay, ...shape.button, paddingVertical: 14, alignItems: 'center' },
  btnDangerText: { color: colors.clay, fontSize: 15, fontWeight: '700' },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  empty: { color: colors.textDim, fontSize: 13 },
  attendee: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.bg, fontSize: 12, fontWeight: '800' },
  attendeeName: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
