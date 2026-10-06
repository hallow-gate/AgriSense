import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function LoginVideo() {
  const player = useVideoPlayer(require('../../assets/login-bg.mp4'), p => { p.loop = true; p.muted = true; p.play(); });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#2C3A1E' }]}>
      <VideoView player={player} nativeControls={false} contentFit="cover" style={StyleSheet.absoluteFill} />
    </View>
  );
}
