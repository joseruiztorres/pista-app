import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';

// La marca de Pista: una "P" dibujada con tres calles de pista de atletismo
// y un punto rojo tartán que es el corredor en la curva.
const LANES = [
  'M27 102 V18 H61 A31 31 0 0 1 61 80 H56',
  'M40 102 V31 H61 A18 18 0 0 1 61 67 H56',
  'M53 102 V44 H61 A5 5 0 0 1 61 54 H57',
];

export function PistaMark({ size = 32, framed = false, laneColor = colors.accent }) {
  if (framed) {
    return (
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Rect width="120" height="120" rx="28" fill={colors.bg} />
        {LANES.map((d) => (
          <Path key={d} d={d} fill="none" stroke={laneColor} strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        <Circle cx="85.5" cy="49" r="4.6" fill={colors.clay} />
      </Svg>
    );
  }
  const width = (size * 73) / 92;
  return (
    <Svg width={width} height={size} viewBox="23 14 73 92">
      {LANES.map((d) => (
        <Path key={d} d={d} fill="none" stroke={laneColor} strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <Circle cx="85.5" cy="49" r="4.6" fill={colors.clay} />
    </Svg>
  );
}

export default function PistaLogo({ size = 26, color = colors.text, showWord = true }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Pista">
      <PistaMark size={size} />
      {showWord && (
        <Text style={[styles.word, { color, fontSize: size * 0.98, lineHeight: size * 1.1 }]}>pista</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  word: { fontWeight: '900', letterSpacing: -0.8 },
});
