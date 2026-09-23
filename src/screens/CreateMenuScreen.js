import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

const OPTIONS = [
  { icon: 'images-outline', title: 'Publicación', text: 'Foto, vídeo, progreso o consejo', screen: 'CrearPost' },
  { icon: 'time-outline', title: 'Historia', text: 'Foto o vídeo visible durante 24 horas', screen: 'CreateStory' },
  { icon: 'navigate-circle-outline', title: 'Actividad GPS', text: 'Graba distancia, tiempo, ritmo y recorrido', screen: 'Tabs', params: { screen: 'Registrar' } },
  { icon: 'people-outline', title: 'Quedada', text: 'Organiza una actividad con punto de encuentro', screen: 'CreateMeetup' },
];

export default function CreateMenuScreen({ navigation }) {
  function open(option) { navigation.goBack(); setTimeout(() => navigation.navigate(option.screen, option.params), 0); }
  return <View style={styles.screen}><Text style={styles.title}>¿Qué quieres crear?</Text><Text style={styles.subtitle}>Elige una opción para compartir tu deporte.</Text><View style={styles.grid}>{OPTIONS.map((option) => <Pressable key={option.title} style={styles.card} onPress={() => open(option)}><View style={styles.icon}><Ionicons name={option.icon} size={27} color={colors.accentStrong} /></View><Text style={styles.cardTitle}>{option.title}</Text><Text style={styles.cardText}>{option.text}</Text></Pressable>)}</View></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg, padding: 18 }, title: { color: colors.text, fontSize: 24, fontWeight: '900' }, subtitle: { color: colors.textDim, fontSize: 13, marginTop: 5, marginBottom: 18 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, card: { width: '48%', minHeight: 155, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14 }, icon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, cardTitle: { color: colors.text, fontSize: 15, fontWeight: '900' }, cardText: { color: colors.textDim, fontSize: 11, lineHeight: 16, marginTop: 5 } });
