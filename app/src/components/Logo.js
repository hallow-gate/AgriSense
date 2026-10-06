import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient as LG, Stop } from 'react-native-svg';
import { Clay, T } from './Clay';
import { C } from '../theme';

export function Sprout({ size = 40, light }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs><LG id="sg" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={light ? '#D5E8B0' : '#8DAA63'} /><Stop offset="1" stopColor={light ? '#A9C97A' : '#4D6B2C'} /></LG></Defs>
      <Path d="M32 38C32 27 23 18 11 17C11 29 19 38 32 38Z" fill="url(#sg)" />
      <Path d="M32 32C32 21 41 12 54 11C54 23 45 32 32 32Z" fill="url(#sg)" />
      <Path d="M32 34V50" stroke={light ? '#A9C97A' : '#5F7F3A'} strokeWidth={4.6} strokeLinecap="round" />
    </Svg>
  );
}

// the app icon as a clay disc
export function LogoDisc({ size = 84 }) {
  return (
    <Clay radius={size / 2} depth={size / 90} inner={{ width: size, height: size, padding: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Sprout size={size * 0.62} />
    </Clay>
  );
}

export function Wordmark({ size = 20, light }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Sprout size={size + 8} light={light} />
      <T s={size} f="black" c={light ? '#fff' : C.matchaInk} style={{ letterSpacing: -0.4 }}>AgriSense</T>
    </View>
  );
}
