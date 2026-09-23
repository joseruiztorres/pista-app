import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SportLoader from '../components/SportLoader';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';
import Avatar from '../components/Avatar';
import FollowButton from '../components/FollowButton';

export default function SearchScreen({ navigation, embedded = false }) {
  const { user, sportIds } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      let active = true;
      setLoading(true);
      (async () => {
        let suggested = [];
        if (sportIds.length) {
          const { data } = await supabase
            .from('profile_sports')
            .select('sport_id, profiles:profile_id(id, username, display_name, avatar_url, is_private)')
            .in('sport_id', sportIds)
            .limit(40);
          const seen = new Set();
          suggested = (data || []).map((row) => row.profiles).filter((profile) => {
            if (!profile || profile.id === user?.id || seen.has(profile.id)) return false;
            seen.add(profile.id);
            return true;
          });
        }
        if (suggested.length < 8) {
          const { data } = await supabase.from('profiles')
            .select('id, username, display_name, avatar_url, is_private')
            .order('created_at', { ascending: false })
            .limit(20);
          const seen = new Set(suggested.map((profile) => profile.id));
          (data || []).forEach((profile) => {
            if (profile.id !== user?.id && !seen.has(profile.id)) {
              suggested.push(profile);
              seen.add(profile.id);
            }
          });
        }
        if (active) {
          setResults(suggested.slice(0, 20));
          setLoading(false);
        }
      })();
      return () => { active = false; };
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_private')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(20);
      setResults((data || []).filter((p) => p.id !== user?.id));
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, user, sportIds]);

  return (
    <View style={styles.screen}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textDim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar personas por nombre o @usuario…"
          placeholderTextColor={colors.textDim}
          value={query}
          onChangeText={setQuery}
          autoFocus={!embedded}
        />
      </View>

      {loading ? (
        <View style={styles.center}><SportLoader /></View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 10 }}
          ListHeaderComponent={!query.trim() && results.length ? <Text style={styles.suggestTitle}>Personas para ti</Text> : null}
          ListEmptyComponent={
            query.trim()
              ? <Text style={styles.empty}>No hay resultados para "{query.trim()}".</Text>
              : <Text style={styles.empty}>Cuando haya más deportistas, aparecerán aquí.</Text>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('UserProfile', { profileId: item.id })}>
              <Avatar url={item.avatar_url} name={item.display_name || item.username} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.display_name || item.username}</Text>
                <Text style={styles.handle}>@{item.username}</Text>
              </View>
              <FollowButton profileId={item.id} isPrivate={item.is_private} compact />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 10, marginBottom: 8,
    backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line,
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 10, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 30 },
  suggestTitle: { color: colors.textDim, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line },
  name: { color: colors.text, fontSize: 14, fontWeight: '700' },
  handle: { color: colors.textDim, fontSize: 12, marginTop: 2 },
});
