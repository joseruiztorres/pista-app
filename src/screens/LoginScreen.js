import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, shape } from '../lib/theme';
import Svg, { Circle } from 'react-native-svg';
import { PistaMark } from '../components/PistaLogo';
// (Platform ya se importa arriba; se usa en handleReset para el redirectTo en web)

export default function LoginScreen() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'reset'

  // URL base para los enlaces legales: en web usamos el propio origen; en apps nativas, el dominio de producción.
  const legalUrl = (path) => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://pista-app-five.vercel.app') + path;
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function handleReset() {
    if (!email) {
      setMessage('Escribe tu email.');
      return;
    }
    setMessage('');
    setBusy(true);
    try {
      const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setMessage('Te hemos enviado un enlace a tu correo para restablecer la contraseña.');
    } catch (err) {
      setMessage(err.message || 'No se pudo enviar el enlace.');
    } finally {
      setBusy(false);
    }
  }

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
      <View style={styles.lanes} pointerEvents="none">
        <Svg width={340} height={340} viewBox="0 0 340 340">
          {[120, 160, 200, 240].map((r) => (
            <Circle key={r} cx={340} cy={0} r={r} fill="none" stroke={colors.accent} strokeWidth={12} strokeOpacity={0.07} />
          ))}
          <Circle cx={340 - 180 * Math.SQRT1_2} cy={180 * Math.SQRT1_2} r={6} fill={colors.clay} />
        </Svg>
      </View>
      <View style={styles.brand}>
        <PistaMark size={60} framed />
        <Text style={styles.wordmark}>pista</Text>
        <Text style={styles.tagline}>Tu deporte, tu gente, tu pista.</Text>
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

        {mode !== 'reset' && (
          <View style={styles.field}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword}
              placeholder="••••••••" placeholderTextColor={colors.textDim} secureTextEntry />
          </View>
        )}

        {mode === 'signin' && (
          <Pressable onPress={() => { setMessage(''); setMode('reset'); }}>
            <Text style={styles.forgot}>¿Olvidaste tu contraseña?</Text>
          </Pressable>
        )}

        <Pressable style={styles.btnPrimary} onPress={mode === 'reset' ? handleReset : handleSubmit} disabled={busy}>
          <Text style={styles.btnPrimaryText}>
            {busy ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : mode === 'reset' ? 'Enviar enlace' : 'Entrar'}
          </Text>
        </Pressable>

        {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}

        {mode === 'reset' ? (
          <Pressable onPress={() => { setMessage(''); setMode('signin'); }}>
            <Text style={styles.switch}>Volver a entrar</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => { setMessage(''); setMode(mode === 'signup' ? 'signin' : 'signup'); }}>
            <Text style={styles.switch}>
              {mode === 'signup' ? '¿Ya tienes cuenta? Entra' : '¿Nuevo en Pista? Crea una cuenta'}
            </Text>
          </Pressable>
        )}

        <Text style={styles.legal}>
          Al continuar, aceptas los{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(legalUrl('/terms.html'))}>Términos de Uso</Text>
          {' '}y la{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(legalUrl('/privacy.html'))}>Política de Privacidad</Text>
          {' '}de Pista.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24, gap: 40, overflow: 'hidden' },
  brand: { gap: 6 },
  wordmark: { color: colors.text, fontSize: 48, fontWeight: '900', letterSpacing: -1.5, marginTop: 14 },
  lanes: { position: 'absolute', top: 0, right: 0 },
  tagline: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  form: { gap: 14 },
  field: { gap: 6 },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.text,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
  },
  btnPrimary: { backgroundColor: colors.accent, ...shape.button, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnPrimaryText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  forgot: { color: colors.accentStrong, fontSize: 12, fontWeight: '600', textAlign: 'right', marginTop: -6 },
  switch: { color: colors.textDim, textAlign: 'center', marginTop: 4, fontSize: 13 },
  message: { color: colors.text, textAlign: 'center', fontSize: 13, lineHeight: 19 },
  legal: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  legalLink: { color: colors.accentStrong, fontWeight: '700' },
});
