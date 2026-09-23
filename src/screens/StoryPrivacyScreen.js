import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import Avatar from '../components/Avatar';
import SportLoader from '../components/SportLoader';
import { colors } from '../lib/theme';

export default function StoryPrivacyScreen() {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [closeIds, setCloseIds] = useState(new Set());
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const [followers, following, close, hidden] = await Promise.all([
      supabase.from('follows').select('profiles:follower_id(id, username, display_name, avatar_url)').eq('following_id', user.id).eq('pending', false),
      supabase.from('follows').select('profiles:following_id(id, username, display_name, avatar_url)').eq('follower_id', user.id).eq('pending', false),
      supabase.from('close_friends').select('friend_id').eq('owner_id', user.id),
      supabase.from('story_hidden_users').select('hidden_id').eq('owner_id', user.id),
    ]);
    const map = new Map();
    [...(followers.data || []), ...(following.data || [])].forEach((row) => { if (row.profiles) map.set(row.profiles.id, row.profiles); });
    setPeople([...map.values()]); setCloseIds(new Set((close.data || []).map((row) => row.friend_id))); setHiddenIds(new Set((hidden.data || []).map((row) => row.hidden_id))); setLoading(false);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  async function toggle(table, column, id, setter, current) {
    const next = new Set(current);
    if (next.has(id)) { next.delete(id); await supabase.from(table).delete().eq('owner_id', user.id).eq(column, id); }
    else { next.add(id); await supabase.from(table).insert({ owner_id: user.id, [column]: id }); }
    setter(next);
  }

  if (loading) return <View style={styles.center}><SportLoader /></View>;
  return <FlatList style={styles.screen} data={people} keyExtractor={(item) => item.id} contentContainerStyle={styles.content} ListHeaderComponent={<View style={styles.intro}><Ionicons name="shield-checkmark-outline" size={28} color={colors.accentStrong} /><Text style={styles.title}>Privacidad de historias</Text><Text style={styles.help}>“Mejores amigos” podrá ver las historias verdes. “Ocultar” impide que esa persona vea cualquier historia tuya.</Text></View>} ListEmptyComponent={<Text style={styles.empty}>Cuando sigas a personas o tengas seguidores podrás configurar esta lista.</Text>} renderItem={({ item }) => <View style={styles.row}><Avatar url={item.avatar_url} name={item.display_name || item.username} size={40} /><View style={{ flex: 1 }}><Text style={styles.name}>{item.display_name || item.username}</Text><Text style={styles.handle}>@{item.username}</Text></View><Pressable accessibilityLabel="Mejores amigos" onPress={() => toggle('close_friends','friend_id',item.id,setCloseIds,closeIds)} style={[styles.iconButton, closeIds.has(item.id) && styles.closeActive]}><Ionicons name={closeIds.has(item.id) ? 'star' : 'star-outline'} size={18} color={closeIds.has(item.id) ? colors.bg : colors.textDim} /></Pressable><Pressable accessibilityLabel="Ocultar historias" onPress={() => toggle('story_hidden_users','hidden_id',item.id,setHiddenIds,hiddenIds)} style={[styles.iconButton, hiddenIds.has(item.id) && styles.hiddenActive]}><Ionicons name={hiddenIds.has(item.id) ? 'eye-off' : 'eye-off-outline'} size={18} color={hiddenIds.has(item.id) ? colors.text : colors.textDim} /></Pressable></View>} />;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 16, gap: 10 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }, intro: { alignItems: 'center', gap: 7, marginBottom: 12 }, title: { color: colors.text, fontSize: 19, fontWeight: '900' }, help: { color: colors.textDim, textAlign: 'center', fontSize: 12, lineHeight: 17 }, empty: { color: colors.textDim, textAlign: 'center', marginTop: 30 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 11, borderRadius: 15 }, name: { color: colors.text, fontSize: 13, fontWeight: '800' }, handle: { color: colors.textDim, fontSize: 11 }, iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }, closeActive: { backgroundColor: colors.accent }, hiddenActive: { backgroundColor: colors.clay } });
