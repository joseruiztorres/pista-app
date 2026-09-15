import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import SportLoader from '../components/SportLoader';

const REASON_LABEL = { spam: 'Spam o publicidad', inapropiado: 'Contenido inapropiado', acoso: 'Acoso o discurso de odio', otro: 'Otro motivo' };
const TARGET_ICON = { post: 'document-text-outline', comment: 'chatbubble-outline', profile: 'person-outline' };

function formatWhen(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `hace ${diffD} d`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// Visible solo para profile.is_admin (comprobado por App.js al enrutar aquí,
// y de todas formas la base de datos lo exige vía RLS: sin is_admin, esta
// pantalla simplemente no vería ningún reporte).
export default function AdminReportsScreen() {
  const [tab, setTab] = useState('pendientes'); // 'pendientes' | 'resueltos'
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('reports')
      .select('*')
      .eq('resolved', tab === 'resueltos')
      .order('created_at', { ascending: false })
      .limit(100);
    setReports(data || []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function resolve(id) {
    await supabase.from('reports').update({ resolved: true, resolved_at: new Date().toISOString() }).eq('id', id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  }

  async function dismiss(id) {
    await supabase.from('reports').delete().eq('id', id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  }

  async function deleteContent(report) {
    if (report.target_type === 'post') await supabase.from('posts').delete().eq('id', report.target_id);
    if (report.target_type === 'comment') await supabase.from('comments').delete().eq('id', report.target_id);
    await resolve(report.id);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.tabs}>
        <Tab label="Pendientes" active={tab === 'pendientes'} onPress={() => setTab('pendientes')} />
        <Tab label="Resueltos" active={tab === 'resueltos'} onPress={() => setTab('resueltos')} />
      </View>

      {loading ? (
        <View style={styles.center}><SportLoader /></View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={<Text style={styles.empty}>
            {tab === 'pendientes' ? 'No hay reportes pendientes.' : 'Todavía no has resuelto ningún reporte.'}
          </Text>}
          renderItem={({ item }) => (
            <ReportRow report={item} onResolve={() => resolve(item.id)} onDismiss={() => dismiss(item.id)} onDeleteContent={() => deleteContent(item)} />
          )}
        />
      )}
    </View>
  );
}

function ReportRow({ report, onResolve, onDismiss, onDeleteContent }) {
  const [preview, setPreview] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      let text = '';
      if (report.target_type === 'post') {
        const { data } = await supabase.from('posts').select('caption, profiles:author_id(username)').eq('id', report.target_id).maybeSingle();
        text = data ? `@${data.profiles?.username || '?'}: ${data.caption || '(sin descripción)'}` : '(publicación ya no existe)';
      } else if (report.target_type === 'comment') {
        const { data } = await supabase.from('comments').select('body, profiles:author_id(username)').eq('id', report.target_id).maybeSingle();
        text = data ? `@${data.profiles?.username || '?'}: ${data.body}` : '(comentario ya no existe)';
      } else if (report.target_type === 'profile') {
        const { data } = await supabase.from('profiles').select('username').eq('id', report.target_id).maybeSingle();
        text = data ? `@${data.username}` : '(perfil ya no existe)';
      }
      if (active) setPreview(text);
    })();
    return () => { active = false; };
  }, [report]);

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Ionicons name={TARGET_ICON[report.target_type] || 'flag-outline'} size={15} color={colors.textDim} />
        <Text style={styles.reason}>{REASON_LABEL[report.reason] || report.reason || 'Sin motivo'}</Text>
        <Text style={styles.when}>{formatWhen(report.created_at)}</Text>
      </View>
      <Text style={styles.preview} numberOfLines={2}>{preview === null ? 'Cargando…' : preview}</Text>

      <View style={styles.actions}>
        {report.target_type !== 'profile' && (
          <Pressable style={[styles.actionBtn, confirmDelete && styles.actionBtnDanger]} onPress={() => (confirmDelete ? onDeleteContent() : setConfirmDelete(true))}>
            <Ionicons name="trash-outline" size={14} color={confirmDelete ? colors.bg : colors.clay} />
            <Text style={[styles.actionText, confirmDelete && { color: colors.bg }]}>{confirmDelete ? '¿Seguro? Borrar' : 'Borrar contenido'}</Text>
          </Pressable>
        )}
        <Pressable style={styles.actionBtn} onPress={onResolve}>
          <Ionicons name="checkmark" size={14} color={colors.accentStrong} />
          <Text style={styles.actionText}>Marcar resuelto</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onDismiss}>
          <Ionicons name="close" size={14} color={colors.textDim} />
          <Text style={styles.actionText}>Descartar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Tab({ label, active, onPress }) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface2 },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: colors.bg },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 30 },
  row: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 8 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reason: { color: colors.text, fontSize: 12, fontWeight: '700', flex: 1 },
  when: { color: colors.textDim, fontSize: 11 },
  preview: { color: colors.textDim, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  actionBtnDanger: { backgroundColor: colors.clay },
  actionText: { color: colors.text, fontSize: 11, fontWeight: '700' },
});
