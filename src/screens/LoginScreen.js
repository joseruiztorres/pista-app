import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

export default function LoginScreen() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit() {
    if (!email || !password) {
      setMessage('Escribe email y contraseña.');
      return;
    }
    setMessage('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const handle = (username || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '');
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username: handle, display_name: username || email.split('@')[0] } },
        });
        if (error) throw error;
        if (!data.session) setMessage('Revisa tu correo para confirmar la cuenta y después entra aquí.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMessage(err.message || 'No se pudo continuar. Inténtalo otra vez.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>PISTA</Text>
        <Text style={styles.tagline}>Entrena. Comparte. Compite.</Text>
      </View>

      <View style={styles.form}>
        {mode === 'signup' && (
          <View style={styles.field}>
            <Text style={styles.label}>Usuario</Text>
            <TextInput style={styles.input} value={username} onChangeText={setUsername}
              placeholder="tu_usuario" placeholderTextColor={colors.textDim} autoCapitalize="none" />
          </View>
        )}
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail}
            placeholder="tu@email.com" placeholderTextColor={colors.textDim}
            autoCapitalize="none" keyboardType="email-address" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword}
            placeholder="••••••••" placeholderTextColor={colors.textDim} secureTextEntry />
        </View>

        <Pressable style={styles.btnPrimary} onPress={handleSubmit} disabled={busy}>
          <Text style={styles.btnPrimaryText}>
            {busy ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
          </Text>
        </Pressable>

        {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}

        <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
          <Text style={styles.switch}>
            {mode === 'signup' ? '¿Ya tienes cuenta? Entra' : '¿Nuevo en Pista? Crea una cuenta'}
          </Text>
        </Pressable>
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
  switch: { color: colors.textDim, textAlign: 'center', marginTop: 4, fontSize: 13 },
  message: { color: colors.text, textAlign: 'center', fontSize: 13, lineHeight: 19 },
});
