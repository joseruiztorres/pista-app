import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';
import { iconFor } from '../lib/sports';
import { haversineKm } from '../lib/geo';
import RouteRecorder from '../components/RouteRecorder';
import { colors, shape } from '../lib/theme';
import { checkActivityBadges } from '../lib/awardBadges';

const ACTIVITY_SPORTS = ['running', 'ciclismo', 'caminar', 'senderismo', 'trail', 'patinaje', 'escalada'];
// Deportes de fuerza/sala: no hay ruta GPS que grabar, así que en vez de
// dejar que un simple toque marque la racha (fácil de falsear), aquí se pide
// un mínimo real: cuánto ha durado la sesión y cómo ha ido.
const FUERZA_SPORTS = ['gym', 'crossfit', 'calistenia', 'halterofilia'];
const EFFORT_LABELS = { suave: 'Suave', normal: 'Normal', intenso: 'A tope' };

function cropRoute(route, meters = 200) {
  if (!route || route.length < 3) return route;
  const totalKm = route.slice(1).reduce((sum, point, index) => sum + haversineKm(route[index], point), 0);
  const cropKm = Math.min(meters / 1000, totalKm * 0.2);
  let start = 0;
  let accumulated = 0;
  while (start < route.length - 2 && accumulated < cropKm) {
    accumulated += haversineKm(route[start], route[start + 1]);
    start += 1;
  }
  let end = route.length - 1;
  accumulated = 0;
  while (end > start + 1 && accumulated < cropKm) {
    accumulated += haversineKm(route[end], route[end - 1]);
    end -= 1;
  }
  return route.slice(start, end + 1);
}

export default function RecordActivityScreen({ navigation, route: navRoute }) {
  const { user } = useAuth();
  const [sports, setSports] = useState([]);
  const [sportId, setSportId] = useState('running');
  const [activity, setActivity] = useState(null);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState('public');
  const [hideEnds, setHideEnds] = useState(true);
  const [saving, setSaving] = useState(false);
  const [climbType, setClimbType] = useState('rocodromo');
  const [climbRoutes, setClimbRoutes] = useState('');
  const [climbGrade, setClimbGrade] = useState('');
  const [climbAttempts, setClimbAttempts] = useState('');
  const [climbVertical, setClimbVertical] = useState('');
  const [climbDuration, setClimbDuration] = useState('60');
  const [recordApproach, setRecordApproach] = useState(false);
  const [fuerzaDuration, setFuerzaDuration] = useState('45');
  const [fuerzaEffort, setFuerzaEffort] = useState('normal');
  const [guideRoute, setGuideRoute] = useState(Array.isArray(navRoute?.params?.targetRoute) ? navRoute.params.targetRoute : null);
  const [sourcePostId, setSourcePostId] = useState(navRoute?.params?.sourcePostId || null);
  const scrollRef = useRef(null);
  const isClimbing = sportId === 'escalada';
  const isFuerza = FUERZA_SPORTS.includes(sportId);

  function finishActivity(nextActivity) {
    setActivity(nextActivity);
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 180);
  }

  function clearGuide() {
    setGuideRoute(null);
    setSourcePostId(null);
    navigation.setParams?.({ targetRoute: undefined, targetSportId: undefined, sourcePostId: undefined });
  }

  useEffect(() => {
    supabase.from('sports').select('*').in('id', [...ACTIVITY_SPORTS, ...FUERZA_SPORTS]).order('name').then(({ data }) => setSports(data || []));
    AsyncStorage.getItem('@pista:last_gps_sport').then((value) => {
      if (!navRoute?.params?.targetSportId && value && ACTIVITY_SPORTS.includes(value)) setSportId(value);
    });
  }, [navRoute?.params?.targetSportId]);

  useEffect(() => {
    const nextRoute = navRoute?.params?.targetRoute;
    const nextSport = navRoute?.params?.targetSportId;
    if (Array.isArray(nextRoute) && nextRoute.length >= 2) {
      setGuideRoute(nextRoute);
      setSourcePostId(navRoute?.params?.sourcePostId || null);
      if (nextSport && ACTIVITY_SPORTS.includes(nextSport)) setSportId(nextSport);
      setActivity(null);
    } else if (nextSport && (ACTIVITY_SPORTS.includes(nextSport) || FUERZA_SPORTS.includes(nextSport))) {
      // Llegada desde el atajo "Reto de hoy": preselecciona el deporte
      // pulsado para que solo falte confirmar la sesión, no repetirla.
      setSportId(nextSport);
    }
  }, [navRoute?.params?.sourcePostId, navRoute?.params?.targetRoute, navRoute?.params?.targetSportId]);

  const metrics = useMemo(() => {
    if (!activity) return null;
    const hours = activity.durationSec / 3600;
    const pace = activity.distanceKm > 0 ? activity.durationSec / 60 / activity.distanceKm : 0;
    return {
      pace: pace ? `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, '0')}/km` : '—',
      speed: hours > 0 ? `${(activity.distanceKm / hours).toFixed(1)} km/h` : '—',
    };
  }, [activity]);

  async function publish() {
    const fuerzaValid = isFuerza && Number(fuerzaDuration) > 0;
    if ((!activity && !isClimbing && !isFuerza) || (isClimbing && recordApproach && !activity) || (isFuerza && !fuerzaValid) || !user || saving) return;
    setSaving(true);
    try {
      const publicRoute = activity ? (hideEnds ? cropRoute(activity.route) : activity.route) : null;
      const details = isClimbing ? {
        activity_kind: 'climbing', climb_type: climbType, routes_completed: Number(climbRoutes || 0), highest_grade: climbGrade.trim() || null,
        attempts: Number(climbAttempts || 0), vertical_m: Number(climbVertical || 0), duration_min: Number(climbDuration || 0),
        route: publicRoute, approach_distance_km: activity ? Number(activity.distanceKm.toFixed(2)) : null,
        approach_duration_min: activity ? Math.max(1, Math.round(activity.durationSec / 60)) : null, hidden_ends: activity ? hideEnds : false,
      } : isFuerza ? {
        activity_kind: 'fuerza', duration_min: Number(fuerzaDuration || 0), effort: fuerzaEffort,
      } : {
        route: publicRoute, distance_km: Number(activity.distanceKm.toFixed(2)), duration_min: Math.max(1, Math.round(activity.durationSec / 60)),
        duration_sec: activity.durationSec, elevation_m: activity.elevationM || 0,
        pace_min_km: ['running', 'caminar', 'senderismo', 'trail'].includes(sportId) ? metrics.pace : null,
        avg_speed_kmh: ['ciclismo', 'patinaje'].includes(sportId) ? metrics.speed : null, hidden_ends: hideEnds,
        repeated_from_post_id: guideRoute && sourcePostId ? sourcePostId : null,
      };
      const { error } = await supabase.from('posts').insert({
        author_id: user.id, sport_id: sportId, type: activity ? 'ruta' : 'progreso', caption: caption.trim() || null, details, audience,
      });
      if (error) throw error;
      await Promise.all([
        AsyncStorage.setItem('@pista:last_gps_sport', sportId),
        supabase.from('daily_checkins').upsert({ profile_id: user.id, sport_id: sportId, check_date: new Date().toISOString().slice(0, 10) }, { onConflict: 'profile_id,check_date' }),
      ]);
      await checkActivityBadges(user.id);
      setActivity(null);
      clearGuide();
      setCaption('');
      setClimbRoutes(''); setClimbGrade(''); setClimbAttempts(''); setClimbVertical('');
      setFuerzaDuration('45'); setFuerzaEffort('normal');
      Alert.alert('Actividad guardada', 'Ya aparece en tu perfil y en el feed, y cuenta para tu racha de hoy.');
      navigation.navigate('Inicio');
    } catch (error) {
      Alert.alert('No se pudo guardar', error.message);
    } finally { setSaving(false); }
  }

  const publishDisabled = saving
    || (sportId === 'escalada' && recordApproach && !activity)
    || (isFuerza && !(Number(fuerzaDuration) > 0));

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>ACTIVIDAD</Text><Text style={styles.title}>Registrar entrenamiento</Text></View>
        <Ionicons name="navigate-circle" size={34} color={colors.accent} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sports}>
        {sports.map((sport) => (
          <Pressable key={sport.id} style={[styles.sport, sportId === sport.id && styles.sportActive]} onPress={() => { setSportId(sport.id); setActivity(null); setRecordApproach(false); clearGuide(); }}>
            <Ionicons name={iconFor(sport.id)} size={17} color={sportId === sport.id ? colors.bg : colors.textDim} />
            <Text style={[styles.sportText, sportId === sport.id && styles.sportTextActive]}>{sport.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {guideRoute && (
        <View style={styles.guideBanner}>
          <Ionicons name="map-outline" size={20} color={colors.accentStrong} />
          <View style={{ flex: 1 }}><Text style={styles.guideTitle}>Ruta de referencia lista</Text><Text style={styles.hint}>Verás tu recorrido en verde y la ruta original en gris mientras grabas.</Text></View>
          <Pressable accessibilityLabel="Quitar ruta de referencia" onPress={clearGuide}><Ionicons name="close" size={20} color={colors.textDim} /></Pressable>
        </View>
      )}

      <View style={styles.card}>
        {isClimbing ? (
          <View style={styles.climbForm}>
            <View style={styles.climbIntro}><Ionicons name="trending-up" size={22} color={colors.amber} /><View style={{ flex: 1 }}><Text style={styles.climbTitle}>Sesión de escalada</Text><Text style={styles.hint}>Registra vías, grado y altura. El GPS puede guardar la aproximación exterior.</Text></View></View>
            <Text style={styles.sectionLabel}>Tipo</Text><View style={styles.row}>{[['rocodromo','Rocódromo'],['roca','Roca'],['boulder','Boulder']].map(([id,label]) => <Choice key={id} active={climbType === id} label={label} onPress={() => setClimbType(id)} />)}</View>
            <View style={styles.climbGrid}><SmallInput label="Vías hechas" value={climbRoutes} onChangeText={setClimbRoutes} placeholder="6" /><SmallInput label="Grado máximo" value={climbGrade} onChangeText={setClimbGrade} placeholder="6b / V4" /><SmallInput label="Intentos" value={climbAttempts} onChangeText={setClimbAttempts} placeholder="10" /><SmallInput label="Altura total (m)" value={climbVertical} onChangeText={setClimbVertical} placeholder="120" /><SmallInput label="Duración (min)" value={climbDuration} onChangeText={setClimbDuration} placeholder="60" /></View>
            <Pressable style={styles.privacyRow} onPress={() => { setRecordApproach((value) => !value); setActivity(null); }}><Ionicons name="trail-sign-outline" size={20} color={recordApproach ? colors.accentStrong : colors.textDim} /><View style={{ flex: 1 }}><Text style={styles.privacyTitle}>Grabar aproximación GPS</Text><Text style={styles.hint}>Para escalada exterior: guarda el camino hasta la zona.</Text></View><Ionicons name={recordApproach ? 'checkbox' : 'square-outline'} size={20} color={colors.accentStrong} /></Pressable>
            {recordApproach && <RouteRecorder onFinish={finishActivity} targetRoute={guideRoute} />}
          </View>
        ) : isFuerza ? (
          <View style={styles.climbForm}>
            <View style={styles.climbIntro}><Ionicons name="barbell" size={22} color={colors.amber} /><View style={{ flex: 1 }}><Text style={styles.climbTitle}>Sesión de fuerza</Text><Text style={styles.hint}>Sin GPS: cuenta lo que registres aquí, no un simple toque. Pon la duración real y cómo te ha ido.</Text></View></View>
            <View style={styles.climbGrid}><SmallInput label="Duración (min)" value={fuerzaDuration} onChangeText={setFuerzaDuration} placeholder="45" /></View>
            <Text style={styles.sectionLabel}>¿Cómo te sentiste?</Text>
            <View style={styles.row}>{Object.entries(EFFORT_LABELS).map(([id, label]) => <Choice key={id} active={fuerzaEffort === id} label={label} onPress={() => setFuerzaEffort(id)} />)}</View>
          </View>
        ) : <><RouteRecorder onFinish={finishActivity} targetRoute={guideRoute} />{!activity && <Text style={styles.hint}>Mantén Pista abierta durante esta primera versión del registro. La aplicación móvil permitirá grabar también con la pantalla bloqueada.</Text>}</>}
      </View>

      {(activity || isClimbing || isFuerza) && (
        <>
          {activity && <View style={styles.finishedBanner}><Ionicons name="checkmark-circle" size={22} color={colors.accentStrong} /><View style={{ flex: 1 }}><Text style={styles.finishedTitle}>Grabación terminada</Text><Text style={styles.hint}>Revisa los datos y pulsa “Guardar y compartir” para que aparezca en Mis rutas.</Text></View></View>}
          {activity && <View style={styles.metrics}>
            <Metric value={`${activity.distanceKm.toFixed(2)} km`} label="Distancia" />
            <Metric value={`${Math.round(activity.durationSec / 60)} min`} label="Tiempo" />
            <Metric value={sportId === 'escalada' ? 'Aproximación' : sportId === 'ciclismo' || sportId === 'patinaje' ? metrics.speed : metrics.pace} label={sportId === 'escalada' ? 'Ruta' : sportId === 'ciclismo' || sportId === 'patinaje' ? 'Velocidad' : 'Ritmo'} />
            <Metric value={`${activity.elevationM || 0} m`} label="Desnivel" />
          </View>}
          <TextInput style={styles.input} placeholder="¿Cómo ha ido el entrenamiento?" placeholderTextColor={colors.textDim} value={caption} onChangeText={setCaption} multiline />
          <Text style={styles.sectionLabel}>Quién puede verlo</Text>
          <View style={styles.row}>{[['public','Todo el mundo'],['followers','Seguidores'],['private','Solo yo']].map(([id,label]) => <Choice key={id} active={audience === id} label={label} onPress={() => setAudience(id)} />)}</View>
          {activity && <Pressable style={styles.privacyRow} onPress={() => setHideEnds((value) => !value)}>
            <Ionicons name={hideEnds ? 'shield-checkmark' : 'shield-outline'} size={20} color={hideEnds ? colors.accentStrong : colors.textDim} />
            <View style={{ flex: 1 }}><Text style={styles.privacyTitle}>Ocultar inicio y final</Text><Text style={styles.hint}>Recorta aproximadamente 200 m para no revelar casa o trabajo.</Text></View>
            <Ionicons name={hideEnds ? 'checkbox' : 'square-outline'} size={20} color={colors.accentStrong} />
          </Pressable>}
          <Pressable style={[styles.publish, publishDisabled && { opacity: 0.45 }]} onPress={publish} disabled={publishDisabled}><Text style={styles.publishText}>{saving ? 'Guardando…' : sportId === 'escalada' && recordApproach && !activity ? 'Termina la aproximación para guardar' : isFuerza && !(Number(fuerzaDuration) > 0) ? 'Pon la duración de la sesión' : 'Guardar y compartir'}</Text></Pressable>
        </>
      )}
    </ScrollView>
  );
}

function Metric({ value, label }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Choice({ active, label, onPress }) { return <Pressable style={[styles.choice, active && styles.choiceActive]} onPress={onPress}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>; }
function SmallInput({ label, value, onChangeText, placeholder }) { return <View style={styles.smallField}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={styles.smallInput} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textDim} keyboardType={label === 'Grado máximo' ? 'default' : 'numeric'} /></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 16, paddingTop: 22, paddingBottom: 42, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { color: colors.accentStrong, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, title: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 2 },
  sports: { gap: 8, paddingVertical: 2 }, sport: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.surface2, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999 }, sportActive: { backgroundColor: colors.accent }, sportText: { color: colors.textDim, fontSize: 12, fontWeight: '700' }, sportTextActive: { color: colors.bg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, gap: 10 }, hint: { color: colors.textDim, fontSize: 11, lineHeight: 16 },
  guideBanner: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent, borderRadius: 15, padding: 12 }, guideTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  finishedBanner: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent, borderRadius: 15, padding: 12 }, finishedTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, metric: { width: '48%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12 }, metricValue: { color: colors.text, fontSize: 17, fontWeight: '900' }, metricLabel: { color: colors.textDim, fontSize: 10, marginTop: 3 },
  input: { minHeight: 76, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, textAlignVertical: 'top' }, sectionLabel: { color: colors.textDim, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, choiceActive: { backgroundColor: colors.accent }, choiceText: { color: colors.textDim, fontSize: 11, fontWeight: '700' }, choiceTextActive: { color: colors.bg },
  privacyRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12 }, privacyTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  publish: { backgroundColor: colors.accent, ...shape.button, paddingVertical: 14, alignItems: 'center' }, publishText: { color: colors.bg, fontSize: 15, fontWeight: '900' },
  climbForm: { gap: 12 }, climbIntro: { flexDirection: 'row', alignItems: 'center', gap: 10 }, climbTitle: { color: colors.text, fontSize: 15, fontWeight: '900' }, climbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, smallField: { width: '48%', gap: 5 }, fieldLabel: { color: colors.textDim, fontSize: 10, fontWeight: '700' }, smallInput: { color: colors.text, backgroundColor: colors.surface2, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 10, fontSize: 12 },
});
