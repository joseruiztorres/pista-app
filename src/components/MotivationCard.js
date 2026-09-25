import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthProvider';
import { syncGamification } from '../lib/gamification';
import { motivationFor } from '../lib/motivation';
import { scheduleSmartReminder } from '../lib/pushNotifications';
import { colors } from '../lib/theme';

export default function MotivationCard({ navigation }) {
  const { user } = useAuth();
  const [motivation, setMotivation] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    const result = await syncGamification(user.id).catch(() => null);
    if (!result) return;
    const next = motivationFor(result.progress, result.personal);
    setMotivation(next);
    scheduleSmartReminder(user.id, next).catch(() => {});
  }, [user]);

  useEffect(() => { load(); }, [load]);
  if (!motivation) return null;
  return (
    <Pressable style={[styles.card, motivation.tone === 'urgent' && styles.urgent]} onPress={() => navigation.navigate(motivation.target)}>
      <View style={styles.icon}><Ionicons name={motivation.icon} size={21} color={motivation.tone === 'urgent' ? colors.clay : colors.accentStrong} /></View>
      <View style={{ flex: 1 }}><Text style={styles.eyebrow}>TU PRÓXIMO IMPULSO</Text><Text style={styles.title}>{motivation.title}</Text><Text style={styles.text}>{motivation.text}</Text></View>
      <Ionicons name="chevron-forward" size={17} color={colors.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, marginTop: 12 },
  urgent: { borderColor: colors.clay },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.accentStrong, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 2 },
  text: { color: colors.textDim, fontSize: 10, lineHeight: 14, marginTop: 3 },
});
