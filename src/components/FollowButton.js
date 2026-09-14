import React, { useEffect, useState } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';

export default function FollowButton({ profileId }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(null); // null = cargando o no aplica
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user || !profileId || user.id === profileId) {
      setFollowing(null);
      return;
    }
    supabase.from('follows').select('follower_id')
      .eq('follower_id', user.id).eq('following_id', profileId).maybeSingle()
      .then(({ data }) => { if (active) setFollowing(!!data); });
    return () => { active = false; };
  }, [user, profileId]);

  if (!user || !profileId || user.id === profileId || following === null) return null;

  async function toggle() {
    setBusy(true);
    if (following) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profileId);
      setFollowing(false);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: profileId });
      setFollowing(true);
    }
    setBusy(false);
  }

  return (
    <Pressable style={[styles.btn, following && styles.btnActive]} onPress={toggle} disabled={busy}>
      {busy ? (
        <ActivityIndicator size="small" color={following ? colors.text : colors.bg} />
      ) : (
        <Text style={[styles.text, following && styles.textActive]}>{following ? 'Siguiendo' : 'Seguir'}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 22, alignItems: 'center', minWidth: 110 },
  btnActive: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  text: { color: colors.bg, fontWeight: '700', fontSize: 13 },
  textActive: { color: colors.text },
});
