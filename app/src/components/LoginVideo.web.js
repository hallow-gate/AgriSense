import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { C } from '../theme';

// Full-bleed looping background. Files live in app/public so they are served as plain static assets.
// Replace public/login-bg.mp4 (and login-poster.jpg) to change the footage.
export default function LoginVideo() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq && mq.matches) setStill(true);
  }, []);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#2C3A1E', overflow: 'hidden' }]}>
      {still
        ? React.createElement('img', { src: '/login-poster.jpg', alt: '', style: { width: '100%', height: '100%', objectFit: 'cover' } })
        : React.createElement('video', {
            src: '/login-bg.mp4', poster: '/login-poster.jpg', autoPlay: true, muted: true, loop: true, playsInline: true,
            preload: 'auto', 'aria-hidden': true, tabIndex: -1, disablePictureInPicture: true,
            style: { width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' },
          })}
    </View>
  );
}
