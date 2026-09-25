import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import SportLoader from '../components/SportLoader';
import { colors } from '../lib/theme';

function formatWhen(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function ChatListScreen({ navigation }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: myRows } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('profile_id', user.id);
    const ids = (myRows || []).map((r) => r.conversation_id);
    if (!ids.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const [{ data: convoRows }, { data: participantRows }, { data: messageRows }] = await Promise.all([
      supabase.from('conversations').select('*').in('id', ids).order('updated_at', { ascending: false }),
      supabase.from('conversation_participants').select('conversation_id, profile_id, profiles:profile_id(username, display_name)').in('conversation_id', ids),
      supabase.from('messages').select('conversation_id, body, created_at, sender_id').in('conversation_id', ids).order('created_at', { ascending: false }),
    ]);

    const otherByConvo = {};
    (participantRows || []).forEach((p) => {
      if (p.profile_id !== user.id) otherByConvo[p.conversation_id] = p.profiles;
    });
    const lastByConvo = {};
    (messageRows || []).forEach((m) => {
      if (!lastByConvo[m.conversation_id]) lastByConvo[m.conversation_id] = m;
    });

    setConversations((convoRows || []).map((c) => ({
      ...c,
      other: otherByConvo[c.id],
      lastMessage: lastByConvo[c.id],
    })));
    setLoading(false);
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>Chat</Text>
      {loading ? (
        <View style={styles.center}><SportLoader /></View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Todavía no tienes conversaciones. Escribe a alguien desde su perfil.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('Conversation', {
                conversationId: item.id,
                otherName: item.other?.display_name || item.other?.username,
              })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.other?.display_name || item.other?.username || '?').slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.other?.display_name || item.other?.username || 'Usuario'}</Text>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.lastMessage
                    ? (item.lastMessage.sender_id === user.id ? 'Tú: ' : '') + item.lastMessage.body
                    : 'Sin mensajes todavía'}
                </Text>
              </View>
              {!!item.lastMessage && <Text style={styles.when}>{formatWhen(item.lastMessage.created_at)}</Text>}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h1: { color: colors.text, fontSize: 20, fontWeight: '800', paddingTop: 56, paddingHorizontal: 16 },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  emptyText: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  name: { color: colors.text, fontSize: 14, fontWeight: '700' },
  preview: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  when: { color: colors.textDim, fontSize: 11 },
});
