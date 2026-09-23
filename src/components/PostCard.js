import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Modal, ScrollView, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { iconFor } from '../lib/sports';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import RoutePreview from './RoutePreview';
import VideoPlayer from './VideoPlayer';

const TYPE_LABEL = { ruta: 'Ruta', progreso: 'Progreso', comida: 'Comida', tip: 'Tip', resena: 'Reseña' };
const REPORT_REASONS = [
  { id: 'spam', label: 'Spam o publicidad' },
  { id: 'inapropiado', label: 'Contenido inapropiado' },
  { id: 'acoso', label: 'Acoso o discurso de odio' },
  { id: 'otro', label: 'Otro motivo' },
];

export default function PostCard({ post, liked, onToggleLike, onPressAuthor, onPressComments, onEdit, onChanged }) {
  const { user } = useAuth();
  const author = post.profiles || {};
  const details = post.details || {};
  const commentCount = post.comments?.[0]?.count ?? 0;
  const isMine = user && user.id === post.author_id;
  const media = (post.post_media || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
  const photos = media.filter((item) => (item.media_type || 'image') === 'image');
  const video = media.find((item) => item.media_type === 'video');

  const [stage, setStage] = useState(null); // null | 'main' | 'confirmDelete' | 'confirmBlock' | 'report'
  const [busy, setBusy] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  function closeMenu() { setStage(null); }

  async function handleDelete() {
    setBusy(true);
    const { error } = await supabase.from('posts').delete().eq('id', post.id).eq('author_id', user.id);
    setBusy(false);
    closeMenu();
    if (error) { Alert.alert('No se pudo eliminar', error.message); return; }
    onChanged?.();
  }

  async function handleBlock() {
    setBusy(true);
    const { error } = await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: post.author_id });
    setBusy(false);
    closeMenu();
    if (error) { Alert.alert('No se pudo bloquear', error.message); return; }
    onChanged?.();
  }

  async function handleReport(reasonId) {
    setBusy(true);
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id, target_type: 'post', target_id: post.id, reason: reasonId,
    });
    setBusy(false);
    closeMenu();
    if (error) { Alert.alert('No se pudo enviar el reporte', error.message); return; }
    Alert.alert('Gracias', 'Hemos recibido tu reporte.');
  }

  async function handleMutePosts() {
    setBusy(true);
    const { data: current } = await supabase.from('mutes').select('mute_stories').eq('owner_id', user.id).eq('muted_id', post.author_id).maybeSingle();
    const { error } = await supabase.from('mutes').upsert({ owner_id: user.id, muted_id: post.author_id, mute_posts: true, mute_stories: !!current?.mute_stories }, { onConflict: 'owner_id,muted_id' });
    setBusy(false); closeMenu();
    if (error) { Alert.alert('No se pudo silenciar', error.message); return; }
    onChanged?.();
  }

  function onPhotoScroll(e) {
    const w = Dimensions.get('window').width;
    const idx = Math.round(e.nativeEvent.contentOffset.x / Math.max(w - 60, 1));
    setPhotoIndex(idx);
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Pressable style={styles.headPress} onPress={() => onPressAuthor?.(post.author_id)}>
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
              {post.edited_at ? ' · editado' : ''}
              {post.location ? ` · ${post.location}` : ''}
            </Text>
          </View>
        </Pressable>
        {post.sport_id && <Ionicons name={iconFor(post.sport_id)} size={18} color={colors.textDim} style={{ marginRight: 4 }} />}
        {user && (
          <Pressable hitSlop={8} onPress={() => setStage('main')}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textDim} />
          </Pressable>
        )}
      </View>

      {details.route && (
        <RoutePreview route={details.route} />
      )}
      {post.type === 'ruta' && !details.activity_kind && (details.distance_km || details.duration_min) && (
        <View style={styles.statsRow}>
          {details.distance_km && <Stat label="Distancia" value={`${details.distance_km} km`} />}
          {details.duration_min && <Stat label="Duración" value={`${details.duration_min} min`} />}
          {details.pace_min_km && <Stat label="Ritmo" value={details.pace_min_km} />}
          {details.avg_speed_kmh && <Stat label="Velocidad" value={details.avg_speed_kmh} />}
          {details.elevation_m && <Stat label="Desnivel" value={`${details.elevation_m} m`} />}
        </View>
      )}

      {details.activity_kind === 'climbing' && (
        <View style={styles.statsRow}>
          {details.climb_type && <Stat label="Tipo" value={{ rocodromo: 'Rocódromo', roca: 'Roca', boulder: 'Boulder' }[details.climb_type] || details.climb_type} />}
          {!!details.routes_completed && <Stat label="Vías" value={String(details.routes_completed)} />}
          {details.highest_grade && <Stat label="Grado máximo" value={details.highest_grade} />}
          {!!details.attempts && <Stat label="Intentos" value={String(details.attempts)} />}
          {!!details.vertical_m && <Stat label="Altura" value={`${details.vertical_m} m`} />}
          {!!details.duration_min && <Stat label="Duración" value={`${details.duration_min} min`} />}
          {!!details.approach_distance_km && <Stat label="Aproximación" value={`${details.approach_distance_km} km`} />}
        </View>
      )}

      {video && <VideoPlayer uri={video.url} style={styles.video} controls loop={false} />}

      {post.type === 'resena' && (post.place || details.rating) && (
        <View style={styles.reviewRow}>
          {post.place?.name && (
            <View style={styles.placePill}>
              <Ionicons name="location-outline" size={12} color={colors.textDim} />
              <Text style={styles.placePillText}>{post.place.name}</Text>
            </View>
          )}
          {!!details.rating && (
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons key={n} name={n <= details.rating ? 'star' : 'star-outline'} size={13} color={colors.amber} />
              ))}
            </View>
          )}
        </View>
      )}

      {(details.exercise || details.distance_m || details.score || details.workout_duration_min) && (
        <View style={styles.statsRow}>
          {details.exercise && <Stat label="Entrenamiento" value={details.exercise} />}
          {details.sets && <Stat label="Series" value={String(details.sets)} />}
          {details.reps && <Stat label="Repeticiones" value={String(details.reps)} />}
          {details.weight_kg && <Stat label="Peso" value={`${details.weight_kg} kg`} />}
          {details.distance_m && <Stat label="Distancia" value={`${details.distance_m} m`} />}
          {details.score && <Stat label="Resultado" value={details.score} />}
          {details.workout_duration_min && <Stat label="Duración" value={`${details.workout_duration_min} min`} />}
        </View>
      )}

      {photos.length > 1 && (
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onPhotoScroll}>
            {photos.map((p, i) => (
              <Image key={i} source={{ uri: p.url }} style={styles.imageCarousel} />
            ))}
          </ScrollView>
          <View style={styles.photoCounter}>
            <Text style={styles.photoCounterText}>{photoIndex + 1}/{photos.length}</Text>
          </View>
        </View>
      )}
      {photos.length === 1 && (
        <Image source={{ uri: photos[0].url }} style={styles.image} />
      )}

      {!!post.caption && <Text style={styles.caption}>{post.caption}</Text>}

      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={onToggleLike}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? colors.clay : colors.textDim} />
          <Text style={[styles.actionText, liked && { color: colors.clay }]}>{(post.like_count || 0) + (liked ? 1 : 0)}</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => onPressComments?.(post.id)}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.textDim} />
          <Text style={styles.actionText}>{commentCount}</Text>
        </Pressable>
      </View>

      <Modal visible={!!stage} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.backdrop} onPress={closeMenu}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {stage === 'main' && isMine && (
              <>
                <MenuItem icon="create-outline" label="Editar" onPress={() => { closeMenu(); onEdit?.(post); }} />
                <MenuItem icon="trash-outline" label="Eliminar" destructive onPress={() => setStage('confirmDelete')} />
                <MenuItem icon="close" label="Cancelar" onPress={closeMenu} />
              </>
            )}
            {stage === 'main' && !isMine && (
              <>
                <MenuItem icon="volume-mute-outline" label={`Silenciar publicaciones de @${author.username}`} onPress={handleMutePosts} disabled={busy} />
                <MenuItem icon="flag-outline" label="Reportar publicación" onPress={() => setStage('report')} />
                <MenuItem icon="ban-outline" label={`Bloquear a @${author.username}`} destructive onPress={() => setStage('confirmBlock')} />
                <MenuItem icon="close" label="Cancelar" onPress={closeMenu} />
              </>
            )}
            {stage === 'confirmDelete' && (
              <>
                <Text style={styles.confirmText}>¿Eliminar esta publicación? No se puede deshacer.</Text>
                <MenuItem icon="trash-outline" label={busy ? 'Eliminando…' : 'Sí, eliminar'} destructive onPress={handleDelete} disabled={busy} />
                <MenuItem icon="close" label="Cancelar" onPress={closeMenu} />
              </>
            )}
            {stage === 'confirmBlock' && (
              <>
                <Text style={styles.confirmText}>¿Bloquear a @{author.username}? Ya no verás sus publicaciones ni él las tuyas.</Text>
                <MenuItem icon="ban-outline" label={busy ? 'Bloqueando…' : 'Sí, bloquear'} destructive onPress={handleBlock} disabled={busy} />
                <MenuItem icon="close" label="Cancelar" onPress={closeMenu} />
              </>
            )}
            {stage === 'report' && (
              <>
                <Text style={styles.confirmText}>¿Por qué reportas esta publicación?</Text>
                {REPORT_REASONS.map((r) => (
                  <MenuItem key={r.id} icon="flag-outline" label={r.label} onPress={() => handleReport(r.id)} disabled={busy} />
                ))}
                <MenuItem icon="close" label="Cancelar" onPress={closeMenu} />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuItem({ icon, label, onPress, destructive, disabled }) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={18} color={destructive ? colors.clay : colors.text} />
      <Text style={[styles.menuItemText, destructive && { color: colors.clay }]}>{label}</Text>
    </Pressable>
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
  headPress: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.bg, fontWeight: '700', fontSize: 13 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontWeight: '700', fontSize: 14 },
  tag: { backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { color: colors.textDim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  meta: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  placePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  placePillText: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  starsRow: { flexDirection: 'row', gap: 1 },
  statChip: { backgroundColor: colors.surface2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  statLabel: { color: colors.textDim, fontSize: 10 },
  statValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  image: { width: '100%', aspectRatio: 16 / 10, borderRadius: 14, backgroundColor: colors.surface2 },
  video: { aspectRatio: 9 / 16, maxHeight: 560 },
  imageCarousel: { width: Dimensions.get('window').width - 60, aspectRatio: 16 / 10, borderRadius: 14, backgroundColor: colors.surface2, marginRight: 0 },
  photoCounter: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  photoCounterText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  caption: { color: colors.text, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 20 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 10, paddingBottom: 28, gap: 2 },
  confirmText: { color: colors.text, fontSize: 13, lineHeight: 19, padding: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12 },
  menuItemText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
