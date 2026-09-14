import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

// Placeholder para Retos, Quedadas y Chat: la navegación ya está montada,
// solo falta construir cada pantalla en su fase correspondiente del roadmap.
export default function ComingSoonScreen({ route }) {
  const { icon, title, phase } = route.params;
  return (
    <View style={styles.screen}>
      <Ionicons name={icon} size={32} color={colors.textDim} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>Llega en la {phase} del roadmap.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  body: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
});
