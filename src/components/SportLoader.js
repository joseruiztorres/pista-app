import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

// Pantalla de carga con un "monigote" que va cambiando de deporte
// (running, ciclismo, gym, calistenia, natación) mientras da botes,
// en vez de la rueda genérica de siempre.
const FRAMES = ['walk-outline', 'bicycle-outline', 'barbell-outline', 'body-outline', 'water-outline'];

export default function SportLoader({ size = 30, label = 'Cargando…', style }) {
  const [frame, setFrame] = useState(0);
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 600);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -7, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  return (
    <View style={[styles.wrap, style]}>
      <Animated.View style={{ transform: [{ translateY: bounce }] }}>
        <Ionicons name={FRAMES[frame]} size={size} color={colors.accent} />
      </Animated.View>
      {!!label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
});
