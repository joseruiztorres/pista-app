import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SportLoader from '../components/SportLoader';
import { useAuth } from '../context/AuthProvider';
import { iconFor } from '../lib/sports';
import { colors } from '../lib/theme';

export default function OnboardingSportsScreen() {
  const { user, refreshProfile } = useAuth();
  const [sports, setSports] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('sports').select('*').order('name').then(({ data }) => {
      setSports(data || []);
      setLoading(false);
    });
  }, []);

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function finish() {
    setSaving(true);
    if (selected.length > 0) {
      const rows = selected.map((sport_id) => ({ profile_id: user.id, sport_id }));
      await supabase.from('profile_sports').upsert(rows);
    }
    await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id);
    await refreshProfile();
    setSaving(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <SportLoader />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>Un último paso</Text>
      <Text style={styles.title}>¿Qué deportes practicas?</Text>
      <Text style={styles.subtitle}>Elige uno o varios para personalizar tu feed y tus retos.</Text>

      <FlatList
        data={sports}
        numColumns={3}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ gap: 12, marginTop: 24 }}
        renderItem={({ item }) => {
          const on = selected.includes(item.id);
          return (
            <Pressable style={[styles.option, on && styles.optionActive]} onPress={() => toggle(item.id)}>
              <View style={[styles.ring, on && styles.ringActive]}>
                <Ionicons name={iconFor(item.id)} size={22} color={on ? colors.bg : colors.textDim} />
              </View>
              <Text style={styles.optionLabel}>{item.name}</Text>
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.btnPrimary} onPress={finish} disabled={saving}>
        <Text style={styles.btnPrimaryText}>
          {saving ? 'Guardando…' : selected.length ? 'Continuar' : 'Elegir más tarde'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 64 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.accent, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 8 },
  subtitle: { color: colors.textDim, fontSize: 14, marginTop: 8, lineHeight: 20 },
  option: {
    flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.line,
  },
  optionActive: { borderColor: colors.accent },
  ring: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  ringActive: { backgroundColor: colors.accent },
  optionLabel: { color: colors.text, fontSize: 11, fontWeight: '600' },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  btnPrimaryText: { color: '#06110B', fontSize: 16, fontWeight: '700' },
});
