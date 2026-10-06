import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clay, T } from './Clay';
import { Wordmark } from './Logo';
import Icon from './Icon';
import { tick } from '../haptics';
import { C } from '../theme';

// Phones and small tablets: floating bar at the bottom, equal-width tabs, a pill that slides to the active one.
function Bottom({ tabs, active, onChange }) {
  const ins = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const n = tabs.length, idx = Math.max(0, tabs.findIndex(t => t.key === active));
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => { Animated.spring(x, { toValue: idx, useNativeDriver: true, speed: 16, bounciness: 7 }).start(); }, [idx]);
  const seg = w / n;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(ins.bottom, 10) + 2, alignItems: 'center', paddingHorizontal: 14 }}>
      <Clay radius={32} depth={1.1} style={{ width: '100%', maxWidth: 520 }} inner={{ padding: 6 }}>
        <View style={{ flexDirection: 'row' }} onLayout={e => setW(e.nativeEvent.layout.width)}>
          {seg > 0 && (
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: seg, padding: 1, transform: [{ translateX: x.interpolate({ inputRange: [0, n - 1], outputRange: [0, seg * (n - 1)] }) }] }}>
              <Clay colors={C.matcha} radius={25} depth={0.55} style={{ flex: 1 }} inner={{ flex: 1, padding: 0 }} />
            </Animated.View>
          )}
          {tabs.map(t => {
            const on = t.key === active;
            return (
              <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}
                onPress={() => { tick(); onChange(t.key); }}
                style={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, gap: 3, cursor: 'pointer' }}>
                <Icon name={t.icon} size={21} color={on ? '#fff' : C.mute} />
                <T s={10.5} f={on ? 'bold' : 'semi'} c={on ? '#fff' : C.mute} numberOfLines={1}>{t.label}</T>
              </Pressable>
            );
          })}
        </View>
      </Clay>
    </View>
  );
}

// Desktop / landscape tablets: a side rail instead of a bottom bar.
function Rail({ tabs, active, onChange }) {
  const ins = useSafeAreaInsets();
  return (
    <View style={{ width: 236, paddingTop: ins.top + 26, paddingBottom: 24, paddingHorizontal: 16, borderRightWidth: 1.5, borderRightColor: 'rgba(88,112,58,0.12)', backgroundColor: 'rgba(225,232,208,0.45)' }}>
      <View style={{ paddingHorizontal: 10, marginBottom: 28 }}><Wordmark /></View>
      <View style={{ gap: 6 }}>
        {tabs.map(t => {
          const on = t.key === active;
          const row = (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
              <Icon name={t.icon} size={21} color={on ? '#fff' : C.mute} />
              <T s={15} f={on ? 'bold' : 'semi'} c={on ? '#fff' : C.mute}>{t.label}</T>
            </View>
          );
          return (
            <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }}
              onPress={() => { tick(); onChange(t.key); }} style={{ cursor: 'pointer' }}>
              {on ? <Clay colors={C.matcha} radius={20} depth={0.5} inner={{ padding: 0 }}>{row}</Clay> : row}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabBar({ variant = 'bottom', ...p }) {
  return variant === 'rail' ? <Rail {...p} /> : <Bottom {...p} />;
}
