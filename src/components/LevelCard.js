import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { athleteIdentity, levelProgress } from '../lib/gamification';

export default function LevelCard({ progress, onPress, compact = false }) {
  const xp = Number(progress?.xp || 0);
  const level = levelProgress(xp);
  const identity = athleteIdentity(progress?.stats || {});
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={[styles.card, compact && styles.compact]} onPress={onPress}>
      <View style={styles.top}>
        <View style={styles.levelBubble}><Text style={styles.levelNumber}>{level.current.level}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>NIVEL PISTA</Text>
          <Text style={styles.title}>{level.current.name}</Text>
          <View style={styles.identity}><Ionicons name={identity.icon} size={13} color={colors.amber} /><Text style={styles.identityText}>{progress?.athlete_label || identity.label}</Text></View>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={18} color={colors.textDim} />}
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${level.percent}%` }]} /></View>
      <View style={styles.meta}><Text style={styles.xp}>{xp.toLocaleString('es-ES')} XP</Text><Text style={styles.next}>{level.next ? `${level.remaining} XP para ${level.next.name}` : 'Nivel máximo'}</Text></View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 16, gap: 13 },
  compact: { padding: 14, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelBubble: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.accentStrong },
  levelNumber: { color: colors.bg, fontSize: 20, fontWeight: '900' },
  eyebrow: { color: colors.accentStrong, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  identityText: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  track: { height: 7, borderRadius: 999, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: colors.amber },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  xp: { color: colors.text, fontSize: 10, fontWeight: '900' },
  next: { color: colors.textDim, fontSize: 10 },
});
