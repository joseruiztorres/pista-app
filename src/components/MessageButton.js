import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getOrCreateConversation } from '../lib/chat';
import { useAuth } from '../context/AuthProvider';
import { colors, shape } from '../lib/theme';

export default function MessageButton({ profileId, profileName }) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);

  if (!user || !profileId || user.id === profileId) return null;

  async function handlePress() {
    setBusy(true);
    try {
      const conversationId = await getOrCreateConversation(user.id, profileId);
      navigation.navigate('Conversation', { conversationId, otherName: profileName });
    } catch (err) {
      Alert.alert('No se pudo abrir el chat', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable style={styles.btn} onPress={handlePress} disabled={busy}>
      {busy ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.text}>Mensaje</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, ...shape.button, paddingVertical: 10, paddingHorizontal: 22, alignItems: 'center', minWidth: 110 },
  text: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
