import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { iconFor } from '../lib/sports';
import RoutePreview from './RoutePreview';

const TYPE_LABEL = { ruta: 'Ruta', progreso: 'Progreso', comida: 'Comida', tip: 'Tip', resena: 'Reseña' };

export default function PostCard({ post, liked, onToggleLike }) {
  const author = post.profiles || {};
  const details = post.details || {};

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(author.display_name || author.username || '?').slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{author.display_name || author.username}</Text>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{TYPE_LABEL[post.type] || post.type}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            @{author.username} · {new Date(post.created_at).toLocaleDateString('es-ES')}
            {post.location ? ` · ${post.location}` : ''}
          </Text>
        </View>
        {post.sport_id && <Ionicons name={iconFor(post.sport_id)} size={18} color={colors.textDim} />}
      </View>

      {post.type === 'ruta' && details.route && (
        <RoutePreview route={details.route} />
      )}
      {post.type === 'ruta' && (details.distance_km || details.duration_min) && (
        <View style={styles.statsRow}>
          {details.distance_km && <Stat label="Distancia" value={`${details.distance_km} km`} />}
          {details.duration_min && <Stat label="Duración" value={`${details.duration_min} min`} />}
          {details.elevation_m && <Stat label="Desnivel" value={`${details.elevation_m} m`} />}
        </View>
      )}

      {post.post_media && post.post_media[0] && (
        <Image source={{ uri: post.post_media[0].url }} style={styles.image} />
      )}

      {!!post.caption && <Text style={styles.caption}>{post.caption}</Text>}

      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={onToggleLike}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? colors.clay : colors.textDim} />
          <Text style={[styles.actionText, liked && { color: colors.clay }]}>{(post.like_count || 0) + (liked ? 1 : 0)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.bg, fontWeight: '700', fontSize: 13 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontWeight: '700', fontSize: 14 },
  tag: { backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { color: colors.textDim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  meta: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statChip: { backgroundColor: colors.surface2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  statLabel: { color: colors.textDim, fontSize: 10 },
  statValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  image: { width: '100%', aspectRatio: 16 / 10, borderRadius: 14, backgroundColor: colors.surface2 },
  caption: { color: colors.text, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 20 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
});
