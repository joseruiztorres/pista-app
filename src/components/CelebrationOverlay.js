import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthProvider';
import { takeNextCelebration } from '../lib/celebrations';
import { colors } from '../lib/theme';

export default function CelebrationOverlay() {
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!user) { setItem(null); return undefined; }
    let active = true;
    async function check() {
      if (item || !active) return;
      const next = await takeNextCelebration(user.id);
      if (active && next) setItem(next);
    }
    check();
    const timer = setInterval(check, 1800);
    return () => { active = false; clearInterval(timer); };
  }, [item, user]);

  useEffect(() => {
    if (!item) return;
    scale.setValue(0.7);
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
  }, [item, scale]);

  if (!item) return null;
  const isLevel = item.type === 'level';
  const heading = isLevel ? '¡HAS SUBIDO DE NIVEL!' : item.type === 'challenge' ? '¡RETO COMPLETADO!' : '¡NUEVA MEDALLA!';
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => setItem(null)}>
      <View style={styles.backdrop}>
        <View style={styles.sparkles}><Dot style={{ left: '12%', top: '16%' }} /><Dot amber style={{ right: '13%', top: '23%' }} /><Dot style={{ right: '23%', bottom: '18%' }} /><Dot amber style={{ left: '19%', bottom: '26%' }} /></View>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <Text style={styles.eyebrow}>{heading}</Text>
          <View style={styles.icon}><Ionicons name={item.icon || (isLevel ? 'trophy' : 'ribbon')} size={48} color={colors.amber} /></View>
          {isLevel && <Text style={styles.level}>NIVEL {item.level}</Text>}
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.body}>{item.description}</Text>
          {!!item.xp && <Text style={styles.xp}>+{item.xp} XP</Text>}
          <Pressable style={styles.button} onPress={() => setItem(null)}><Text style={styles.buttonText}>Seguir avanzando</Text><Ionicons name="arrow-forward" size={16} color={colors.bg} /></Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Dot({ amber, style }) { return <View style={[styles.dot, amber && styles.dotAmber, style]} />; }

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(6,10,7,0.88)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sparkles: { ...StyleSheet.absoluteFillObject },
  dot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accentStrong },
  dotAmber: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  card: { width: '100%', maxWidth: 390, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent, borderRadius: 28, padding: 26 },
  eyebrow: { color: colors.accentStrong, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  icon: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2, borderWidth: 3, borderColor: colors.amber, marginVertical: 18 },
  level: { color: colors.amber, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 25, fontWeight: '900', textAlign: 'center', marginTop: 3 },
  body: { color: colors.textDim, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  xp: { color: colors.amber, fontSize: 15, fontWeight: '900', marginTop: 12 },
  button: { marginTop: 22, width: '100%', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14 },
  buttonText: { color: colors.bg, fontSize: 13, fontWeight: '900' },
});
