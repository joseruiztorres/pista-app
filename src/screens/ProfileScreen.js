import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();

  return (
    <View style={styles.screen}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(profile?.display_name || profile?.username || '?').slice(0, 2).toUpperCase()}</Text>
      </View>
      <Text style={styles.name}>{profile?.display_name || profile?.username}</Text>
      <Text style={styles.handle}>@{profile?.username}</Text>

      <Pressable style={styles.logout} onPress={signOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.clay} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', paddingTop: 64, gap: 6 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { color: colors.bg, fontSize: 22, fontWeight: '800' },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  handle: { color: colors.textDim, fontSize: 13, marginBottom: 32 },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24 },
  logoutText: { color: colors.clay, fontWeight: '700' },
});
