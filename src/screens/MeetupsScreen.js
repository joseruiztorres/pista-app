import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconFor } from '../lib/sports';
import { colors } from '../lib/theme';

const MEETUP_SELECT = '*, profiles:organizer_id(username, display_name), meetup_attendees(count)';

function formatWhen(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

export default function MeetupsScreen({ navigation }) {
  const { sportIds } = useAuth();
  const [sports, setSports] = useState([]);
  const [filter, setFilter] = useState('todo');
  const [meetups, setMeetups] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: sportsRows } = await supabase.from('sports').select('*').order('name');
    setSports(sportsRows || []);

    let query = supabase
      .from('meetups')
      .select(MEETUP_SELECT)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });
    if (filter !== 'todo') query = query.eq('sport_id', filter);

    const { data } = await query;
    setMeetups(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.h1}>Quedadas</Text>
        <Pressable style={styles.newBtn} onPress={() => navigation.navigate('CreateMeetup')}>
          <Ionicons name="add" size={18} color={colors.bg} />
          <Text style={styles.newBtnText}>Nueva</Text>
        </Pressable>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: 'todo', name: 'Todo' }, ...sports]}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, filter === item.id && styles.chipActive]}
            onPress={() => setFilter(item.id)}
          >
            {item.id !== 'todo' && <Ionicons name={iconFor(item.id)} size={13} color={filter === item.id ? colors.bg : colors.textDim} />}
            <Text style={[styles.chipText, filter === item.id && { color: colors.bg }]}>{item.name}</Text>
          </Pressable>
        )}
      />

      <FlatList
        data={meetups}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListEmptyComponent={!loading && (
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={26} color={colors.textDim} />
            <Text style={styles.emptyText}>Todavía no hay quedadas{filter !== 'todo' ? ' de este deporte' : ''}. Crea la primera.</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const count = item.meetup_attendees?.[0]?.count ?? 0;
          return (
            <Pressable style={styles.card} onPress={() => navigation.navigate('MeetupDetail', { meetupId: item.id })}>
              <View style={styles.cardTop}>
                <View style={styles.sportBadge}>
                  <Ionicons name={iconFor(item.sport_id)} size={14} color={colors.accentStrong} />
                </View>
                <Text style={styles.when}>{formatWhen(item.scheduled_at)}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={13} color={colors.textDim} />
                <Text style={styles.meta} numberOfLines={1}>{item.location_name}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="people-outline" size={13} color={colors.textDim} />
                <Text style={styles.meta}>{count} apuntad{count === 1 ? 'o' : 'os'} · organiza {item.profiles?.display_name || item.profiles?.username}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16 },
  h1: { color: colors.text, fontSize: 20, fontWeight: '800' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  newBtnText: { color: colors.bg, fontWeight: '700', fontSize: 13 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 8, paddingTop: 48, paddingHorizontal: 24 },
  emptyText: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 6, borderWidth: 1, borderColor: colors.line },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sportBadge: { backgroundColor: colors.surface2, borderRadius: 999, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  when: { color: colors.amber, fontSize: 12, fontWeight: '700' },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { color: colors.textDim, fontSize: 12, flexShrink: 1 },
});
