import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { colors } from '../lib/theme';

export default function VideoPlayer({ uri, style, autoplay = false, controls = true, loop = true, resizeMode = ResizeMode.CONTAIN }) {
  if (!uri) return null;
  return (
    <View style={[styles.wrap, style]}>
      <Video
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        shouldPlay={autoplay}
        isLooping={loop}
        isMuted={autoplay}
        useNativeControls={controls}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 9 / 16, backgroundColor: '#05060D', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
});
