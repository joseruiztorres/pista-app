import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SportLoader from '../components/SportLoader';
import { iconFor } from '../lib/sports';
import { colors, shape } from '../lib/theme';
import GoogleMapCard from '../components/GoogleMapCard';

const REVIEW_SELECT = '*, profiles:author_id(username, display_name)';

export default function PlaceDetailScreen({ route, navigation }) {
  const { placeId } = route.params;
  const [place, setPlace] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: placeRow }, { data: reviewRows }] = await Promise.all([
      supabase.from('places').select('*').eq('id', placeId).single(),
      supabase.from('posts').select(REVIEW_SELECT).eq('place_id', placeId).eq('type', 'resena').order('created_at', { ascending: false }),
    ]);
    setPlace(placeRow);
    setReviews(reviewRows || []);
    setLoading(false);
  }, [placeId]);

  useEffect(() => { load(); }, [load]);

  if (loading || !place) {
    return <View style={styles.center}><SportLoader /></View>;
  }

  const ratings = reviews.map((r) => Number(r.details?.rating)).filter(Boolean);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  return (
    <FlatList
      style={styles.screen}
      data={reviews}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ gap: 14, marginBottom: 6 }}>
          <View style={styles.headerCard}>
            <View style={styles.iconWrap}>
              <Ionicons name={place.sport_id ? iconFor(place.sport_id) : 'location-outline'} size={26} color={colors.accent} />
            </View>
            <Text style={styles.name}>{place.name}</Text>
            {!!place.address && <Text style={styles.address}>{place.address}</Text>}
            {avg ? (
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Ionicons key={n} name={n <= Math.round(avg) ? 'star' : 'star-outline'} size={16} color={colors.amber} />
                ))}
                <Text style={styles.avgText}>{avg.toFixed(1)} · {reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}</Text>
              </View>
            ) : (
              <Text style={styles.noReviews}>Todavía no tiene reseñas</Text>
            )}
          </View>

          <GoogleMapCard
            query={place.address || place.name}
            latitude={place.lat}
            longitude={place.lng}
            label={place.address || place.name}
          />

          <Pressable style={styles.reviewBtn} onPress={() => navigation.navigate('CrearPost', { presetType: 'resena', presetPlace: place })}>
            <Ionicons name="create-outline" size={16} color={colors.bg} />
            <Text style={styles.reviewBtnText}>Escribir una reseña</Text>
          </Pressable>

          {reviews.length > 0 && <Text style={styles.sectionTitle}>Reseñas</Text>}
        </View>
      }
      ListEmptyComponent={null}
      renderItem={({ item }) => (
        <View style={styles.reviewCard}>
          <View style={styles.reviewHead}>
            <Text style={styles.reviewAuthor}>{item.profiles?.display_name || item.profiles?.username}</Text>
            <View style={styles.starsRowSmall}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons key={n} name={n <= (item.details?.rating || 0) ? 'star' : 'star-outline'} size={12} color={colors.amber} />
              ))}
            </View>
          </View>
          {!!item.caption && <Text style={styles.reviewCaption}>{item.caption}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  headerCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 18, alignItems: 'center', gap: 6 },
  iconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  name: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  address: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  avgText: { color: colors.textDim, fontSize: 12, marginLeft: 4 },
  noReviews: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, ...shape.button, paddingVertical: 12 },
  reviewBtnText: { color: colors.bg, fontSize: 14, fontWeight: '700' },
  sectionTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.line, gap: 6 },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewAuthor: { color: colors.text, fontSize: 13, fontWeight: '700' },
  starsRowSmall: { flexDirection: 'row', gap: 1 },
  reviewCaption: { color: colors.text, fontSize: 13, lineHeight: 18 },
});
