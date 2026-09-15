import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';

// Se muestra cuando el usuario llega desde el enlace de "olvidé mi contraseña"
// del correo (Supabase abre una sesión de recuperación y AuthProvider lo detecta).
export default function ResetPasswordScreen() {
  const { clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSave() {
    if (password.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setMessage('Las dos contraseñas no coinciden.');
      return;
    }
    setMessage('');
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      clearPasswordRecovery();
    } catch (err) {
      setMessage(err.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>PISTA</Text>
        <Text style={styles.tagline}>Elige tu nueva contraseña.</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Nueva contraseña</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword}
            placeholder="••••••••" placeholderTextColor={colors.textDim} secureTextEntry />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Repite la contraseña</Text>
          <TextInput style={styles.input} value={confirm} onChangeText={setConfirm}
            placeholder="••••••••" placeholderTextColor={colors.textDim} secureTextEntry />
        </View>

        <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={busy}>
          <Text style={styles.btnPrimaryText}>{busy ? 'Guardando…' : 'Guardar nueva contraseña'}</Text>
        </Pressable>

        {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24, gap: 40 },
  brand: { gap: 6 },
  wordmark: { color: colors.accent, fontSize: 40, fontWeight: '800', letterSpacing: 1 },
  tagline: { color: colors.textDim, fontSize: 15 },
  form: { gap: 14 },
  field: { gap: 6 },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.text,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
  },
  btnPrimary: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnPrimaryText: { color: '#06110B', fontSize: 16, fontWeight: '700' },
  message: { color: colors.text, textAlign: 'center', fontSize: 13, lineHeight: 19 },
});
