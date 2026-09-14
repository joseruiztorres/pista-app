import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

// Avatar reutilizable: foto real si el perfil tiene avatar_url, si no, iniciales.
export default function Avatar({ url, name, size = 72 }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (url) {
    return <Image source={{ uri: url }} style={[styles.image, dim]} />;
  }
  return (
    <View style={[styles.fallback, dim]}>
      <Text style={[styles.text, { fontSize: size * 0.32 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surface2 },
  fallback: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.bg, fontWeight: '800' },
});
