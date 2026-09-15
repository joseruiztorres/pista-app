import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SportLoader from '../components/SportLoader';
import { iconFor } from '../lib/sports';
import { colors } from '../lib/theme';

// Trae los sitios junto con la nota media y el número de reseñas, calculados
// a partir de posts.details.rating (siguiendo el patrón extensible de la app:
// la nota no tiene columna propia, vive en el JSONB de cada reseña).
async function loadPlacesWithRatings() {
  const [{ data: places }, { data: reviews }] = await Promise.all([
    supabase.from('places').select('*').order('name'),
    supabase.from('posts').select('place_id, details').eq('type', 'resena').not('place_id', 'is', null),
  ]);
  const stats = {};
  (reviews || []).forEach((r) => {
    const rating = Number(r.details?.rating);
    if (!rating) return;
    if (!stats[r.place_id]) stats[r.place_id] = { sum: 0, count: 0 };
    stats[r.place_id].sum += rating;
    stats[r.place_id].count += 1;
  });
  return (places || []).map((p) => ({
    ...p,
    avgRating: stats[p.id] ? stats[p.id].sum / stats[p.id].count : null,
    reviewCount: stats[p.id]?.count || 0,
  }));
}

export default function PlacesScreen({ navigation }) {
  const [places, setPlaces] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setPlaces(await loadPlacesWithRatings());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const filtered = query.trim()
    ? places.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : places;

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Text style={styles.h1}>Lugares</Text>
        <Pressable style={styles.fab} onPress={() => navigation.navigate('CreatePlace')}>
          <Ionicons name="add" size={22} color={colors.bg} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textDim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar gimnasios, parques, rutas…"
          placeholderTextColor={colors.textDim}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {loading ? (
        <View style={styles.center}><SportLoader /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>Todavía no hay sitios. Añade el primero.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => navigation.navigate('PlaceDetail', { placeId: item.id })}>
              <View style={styles.iconWrap}>
                <Ionicons name={item.sport_id ? iconFor(item.sport_id) : 'location-outline'} size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {!!item.address && <Text style={styles.cardAddress} numberOfLines={1}>{item.address}</Text>}
              </View>
              <View style={styles.ratingWrap}>
                {item.avgRating ? (
                  <>
                    <Ionicons name="star" size={14} color={colors.amber} />
                    <Text style={styles.ratingText}>{item.avgRating.toFixed(1)}</Text>
                    <Text style={styles.ratingCount}>({item.reviewCount})</Text>
                  </>
                ) : (
                  <Text style={styles.ratingCount}>Sin reseñas</Text>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 10 },
  h1: { color: colors.text, fontSize: 20, fontWeight: '800' },
  fab: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8,
    backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line,
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 10, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cardAddress: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  ratingWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  ratingCount: { color: colors.textDim, fontSize: 11 },
});
