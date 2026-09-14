import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';

export default function ChatScreen({ route, navigation }) {
  const { conversationId, otherName } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ title: otherName || 'Chat' });
  }, [navigation, otherName]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

  // Suscripción en tiempo real: cualquier mensaje nuevo de esta conversación
  // (mío desde otro dispositivo, o del otro usuario) llega al instante.
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  async function sendMessage() {
    if (!user || !text.trim() || sending) return;
    const body = text.trim();
    setText('');
    setSending(true);
    const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: user.id, body });
    if (error) setText(body);
    setSending(false);
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.empty}>Escribe el primer mensaje.</Text>}
        renderItem={({ item }) => {
          const mine = item.sender_id === user.id;
          return (
            <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, mine && styles.bubbleMine]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje…"
          placeholderTextColor={colors.textDim}
          value={text}
          onChangeText={setText}
          onSubmitEditing={sendMessage}
        />
        <Pressable style={styles.sendBtn} onPress={sendMessage} disabled={sending || !text.trim()}>
          <Text style={styles.sendBtnText}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 20 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', backgroundColor: colors.surface2, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: colors.accent },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 19 },
  bubbleTextMine: { color: colors.bg },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  input: { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.text, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  sendBtn: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 16, justifyContent: 'center' },
  sendBtnText: { color: colors.bg, fontWeight: '700', fontSize: 13 },
});
