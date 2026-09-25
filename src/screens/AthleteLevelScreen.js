import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../lib/theme';
import { athleteIdentity, LEVELS, syncGamification } from '../lib/gamification';
import LevelCard from '../components/LevelCard';
import SportLoader from '../components/SportLoader';

export default function AthleteLevelScreen() {
  const { user } = useAuth();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const result = await syncGamification(user.id);
    setProgress(result?.progress || null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><SportLoader label="Descubriendo tu perfil deportivo" /></View>;
  const identity = athleteIdentity(progress?.stats || {});
  const stats = progress?.stats || {};

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <LevelCard progress={progress} />

      <View style={styles.identityCard}>
        <View style={styles.identityIcon}><Ionicons name={identity.icon} size={28} color={colors.amber} /></View>
        <Text style={styles.eyebrow}>TU TIPO DE DEPORTISTA</Text>
        <Text style={styles.identityTitle}>{identity.label}</Text>
        <Text style={styles.body}>{identity.description}</Text>
        <Text style={styles.hint}>Se adapta solo según los deportes que haces, tu constancia, las rutas y las quedadas.</Text>
      </View>

      <Text style={styles.sectionTitle}>Tu recorrido</Text>
      <View style={styles.statsGrid}>
        <Stat icon="checkmark-circle-outline" value={stats.sessions || 0} label="días activos" />
        <Stat icon="map-outline" value={`${Number(stats.distance || 0).toFixed(1)} km`} label="acumulados" />
        <Stat icon="time-outline" value={Math.round(stats.minutes || 0)} label="minutos" />
        <Stat icon="navigate-outline" value={stats.routes || 0} label="rutas grabadas" />
      </View>

      <Text style={styles.sectionTitle}>Niveles Pista</Text>
      <View style={styles.levelList}>
        {LEVELS.map((item) => {
          const reached = Number(progress?.level || 1) >= item.level;
          return (
            <View key={item.level} style={[styles.levelRow, reached && styles.reached]}>
              <View style={[styles.smallLevel, reached && styles.smallLevelReached]}><Text style={[styles.smallLevelText, reached && styles.smallLevelTextReached]}>{item.level}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.levelName}>{item.name}</Text><Text style={styles.levelXp}>Desde {item.min.toLocaleString('es-ES')} XP</Text></View>
              <Ionicons name={reached ? 'checkmark-circle' : 'lock-closed-outline'} size={19} color={reached ? colors.accentStrong : colors.textDim} />
            </View>
          );
        })}
      </View>

      <View style={styles.info}><Ionicons name="information-circle-outline" size={19} color={colors.accentStrong} /><Text style={styles.infoText}>Ganas XP al entrenar, mantener la racha, completar retos, planificar sesiones, participar en quedadas y conseguir medallas.</Text></View>
    </ScrollView>
  );
}

function Stat({ icon, value, label }) {
  return <View style={styles.stat}><Ionicons name={icon} size={18} color={colors.accentStrong} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  identityCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 20 },
  identityIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  eyebrow: { color: colors.accentStrong, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  identityTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 4 },
  body: { color: colors.text, textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 7 },
  hint: { color: colors.textDim, textAlign: 'center', fontSize: 10, lineHeight: 15, marginTop: 8 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '48%', minHeight: 100, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 13, justifyContent: 'space-between' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
  statLabel: { color: colors.textDim, fontSize: 10 },
  levelList: { gap: 8 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 12, opacity: 0.62 },
  reached: { opacity: 1, borderColor: colors.accent },
  smallLevel: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  smallLevelReached: { backgroundColor: colors.accent },
  smallLevelText: { color: colors.textDim, fontWeight: '900' },
  smallLevelTextReached: { color: colors.bg },
  levelName: { color: colors.text, fontWeight: '800', fontSize: 13 },
  levelXp: { color: colors.textDim, fontSize: 10, marginTop: 2 },
  info: { flexDirection: 'row', gap: 9, backgroundColor: colors.surface2, borderRadius: 15, padding: 13 },
  infoText: { flex: 1, color: colors.textDim, fontSize: 11, lineHeight: 16 },
});
