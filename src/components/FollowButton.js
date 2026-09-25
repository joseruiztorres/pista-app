import React, { useEffect, useState } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { colors, shape } from '../lib/theme';

// state: null (cargando/no aplica) | 'none' | 'pending' | 'following'
export default function FollowButton({ profileId, isPrivate, compact = false }) {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user || !profileId || user.id === profileId) {
      setState(null);
      return;
    }
    supabase.from('follows').select('pending')
      .eq('follower_id', user.id).eq('following_id', profileId).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (!data) setState('none');
        else setState(data.pending ? 'pending' : 'following');
      });
    return () => { active = false; };
  }, [user, profileId]);

  if (!user || !profileId || user.id === profileId || state === null) return null;

  async function toggle() {
    setBusy(true);
    if (state === 'following' || state === 'pending') {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profileId);
      setState('none');
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: profileId, pending: !!isPrivate });
      setState(isPrivate ? 'pending' : 'following');
    }
    setBusy(false);
  }

  const label = state === 'following' ? 'Siguiendo' : state === 'pending' ? 'Solicitado' : 'Seguir';
  const active = state === 'following' || state === 'pending';

  return (
    <Pressable style={[styles.btn, compact && styles.btnCompact, active && styles.btnActive]} onPress={toggle} disabled={busy}>
      {busy ? (
        <ActivityIndicator size="small" color={active ? colors.text : colors.bg} />
      ) : (
        <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: colors.accent, ...shape.button, paddingVertical: 10, paddingHorizontal: 22, alignItems: 'center', minWidth: 110 },
  btnCompact: { minWidth: 82, paddingVertical: 8, paddingHorizontal: 13 },
  btnActive: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  text: { color: colors.bg, fontWeight: '700', fontSize: 13 },
  textActive: { color: colors.text },
});
