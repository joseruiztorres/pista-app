import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sportIds, setSportIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      setSportIds([]);
      return;
    }
    const userId = authUser.id;
    let { data: profileRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    // Con la confirmación de email activa, el perfil solo se puede crear
    // después de iniciar sesión: antes de eso RLS rechaza el insert.
    if (!profileRow) {
      const preferred = authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'deportista';
      const username = preferred.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'deportista';
      const displayName = authUser.user_metadata?.display_name || preferred;
      const row = { id: userId, username, display_name: displayName };
      let result = await supabase.from('profiles').upsert(row, { onConflict: 'id' }).select('*').single();
      if (result.error?.code === '23505') {
        result = await supabase.from('profiles')
          .upsert({ ...row, username: `${username}_${userId.slice(0, 8)}` }, { onConflict: 'id' })
          .select('*').single();
      }
      profileRow = result.data;
      if (result.error) console.warn('No se pudo crear el perfil:', result.error.message);
    }
    setProfile(profileRow || null);

    const { data: sportsRows } = await supabase
      .from('profile_sports')
      .select('sport_id')
      .eq('profile_id', userId);
    setSportIds((sportsRows || []).map((r) => r.sport_id));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfile(data.session?.user).finally(() => setLoading(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      loadProfile(newSession?.user);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(session?.user), [loadProfile, session]);

  const value = {
    session,
    user: session?.user || null,
    profile,
    sportIds,
    loading,
    refreshProfile,
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
