import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SportLoader from '../components/SportLoader';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';

const SELECT = 'follower_id, created_at, follower:follower_id(username, display_name)';

export default function FollowRequestsScreen({ navigation }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('follows')
      .select(SELECT)
      .eq('following_id', user.id)
      .eq('pending', true)
      .order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function accept(followerId) {
    setBusyId(followerId);
    await supabase.from('follows').update({ pending: false })
      .eq('follower_id', followerId).eq('following_id', user.id);
    setItems((prev) => prev.filter((r) => r.follower_id !== followerId));
    setBusyId(null);
  }

  async function reject(followerId) {
    setBusyId(followerId);
    await supabase.from('follows').delete()
      .eq('follower_id', followerId).eq('following_id', user.id);
    setItems((prev) => prev.filter((r) => r.follower_id !== followerId));
    setBusyId(null);
  }

  return (
    <View style={styles.screen}>
      {loading ? (
        <View style={styles.center}><SportLoader /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.follower_id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={<Text style={styles.empty}>No tienes solicitudes de seguimiento pendientes.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable style={styles.rowPress} onPress={() => navigation.navigate('UserProfile', { profileId: item.follower_id })}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.follower?.display_name || item.follower?.username || '?').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.follower?.display_name || item.follower?.username}</Text>
                  <Text style={styles.handle}>@{item.follower?.username}</Text>
                </View>
              </Pressable>
              <View style={styles.actions}>
                <Pressable style={styles.reject} onPress={() => reject(item.follower_id)} disabled={busyId === item.follower_id}>
                  <Ionicons name="close" size={18} color={colors.textDim} />
                </Pressable>
                <Pressable style={styles.accept} onPress={() => accept(item.follower_id)} disabled={busyId === item.follower_id}>
                  <Ionicons name="checkmark" size={18} color={colors.bg} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line },
  rowPress: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.bg, fontWeight: '700', fontSize: 13 },
  name: { color: colors.text, fontSize: 14, fontWeight: '700' },
  handle: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  reject: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  accept: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
