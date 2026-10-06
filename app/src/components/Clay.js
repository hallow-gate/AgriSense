import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, ActivityIndicator, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tick } from '../haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '../theme';
import Icon from './Icon';

const BEVEL = {
  borderTopColor: 'rgba(255,255,255,0.95)', borderLeftColor: 'rgba(255,255,255,0.85)',
  borderBottomColor: 'rgba(88,112,58,0.16)', borderRightColor: 'rgba(88,112,58,0.12)',
};

export const T = ({ s = 15, c = C.ink, f = 'semi', style, children, ...p }) =>
  <Text {...p} style={[{ fontSize: s, color: c, fontFamily: F[f] }, style]}>{children}</Text>;

// Raised clay surface: diagonal gradient + lit top-left bevel + soft drop shadow.
export function Clay({ children, style, inner, radius = 26, colors = C.card, depth = 1 }) {
  const shadow = {
    shadowColor: C.shadow, shadowOpacity: 0.26 * Math.min(depth, 1.2), shadowRadius: 14 * depth,
    shadowOffset: { width: 6 * depth, height: 9 * depth }, elevation: Math.round(7 * depth),
  };
  return (
    <View style={[{ borderRadius: radius, backgroundColor: colors[1] }, shadow, style]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[{ borderRadius: radius, borderWidth: 2, ...BEVEL, padding: 16 }, inner]}>
        {children}
      </LinearGradient>
    </View>
  );
}

// Pressed-in surface (inputs, tracks, segmented control).
export function Well({ children, style, radius = 18 }) {
  return (
    <View style={[{
      backgroundColor: C.well, borderRadius: radius, borderWidth: 2,
      borderTopColor: 'rgba(88,112,58,0.18)', borderLeftColor: 'rgba(88,112,58,0.12)',
      borderBottomColor: 'rgba(255,255,255,0.9)', borderRightColor: 'rgba(255,255,255,0.8)',
    }, style]}>{children}</View>
  );
}

export function Press({ onPress, disabled, children, style, scale = 0.97, hitSlop }) {
  const v = useRef(new Animated.Value(1)).current;
  const to = x => Animated.spring(v, { toValue: x, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  // `style` (flex, width, alignSelf, opacity) belongs on the Pressable, which is the real child of the parent row.
  return (
    <Pressable disabled={disabled} hitSlop={hitSlop} onPressIn={() => to(scale)} onPressOut={() => to(1)}
      onPress={() => { tick(); onPress && onPress(); }}
      style={[{ cursor: disabled ? 'default' : 'pointer' }, style]}>
      <Animated.View style={{ transform: [{ scale: v }], flexGrow: 1 }}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({ label, onPress, kind = 'matcha', icon, disabled, loading, style }) {
  const matcha = kind === 'matcha', danger = kind === 'danger';
  const colors = matcha ? C.matcha : danger ? ['#F8E7DF', '#EDCFC3'] : C.card;
  const color = matcha ? '#fff' : danger ? C.bad : C.matchaInk;
  return (
    <Press onPress={onPress} disabled={disabled || loading} style={[{ opacity: disabled ? 0.45 : 1 }, style]}>
      <Clay colors={colors} radius={22} depth={matcha ? 0.9 : 0.6}
        inner={{ paddingVertical: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading ? <ActivityIndicator color={color} /> : icon ? <Icon name={icon} size={20} color={color} /> : null}
        <T s={15.5} f="bold" c={color}>{label}</T>
      </Clay>
    </Press>
  );
}

export function Segmented({ options, value, onChange }) {
  const [w, setW] = useState(0);
  const n = options.length, idx = Math.max(0, options.findIndex(o => o.key === value));
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => { Animated.spring(x, { toValue: idx, useNativeDriver: true, speed: 18, bounciness: 5 }).start(); }, [idx]);
  const pad = 4, seg = w ? (w - pad * 2) / n : 0;
  return (
    <Well radius={22} style={{ padding: pad }}>
      <View style={{ flexDirection: 'row' }} onLayout={e => setW(e.nativeEvent.layout.width + pad * 2)}>
        {seg > 0 && (
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: seg, transform: [{ translateX: x.interpolate({ inputRange: [0, n - 1 || 1], outputRange: [0, seg * (n - 1)] }) }] }}>
            <Clay radius={17} depth={0.45} style={{ flex: 1 }} inner={{ flex: 1, padding: 0 }} />
          </Animated.View>
        )}
        {options.map(o => {
          const on = o.key === value;
          return (
            <Pressable key={o.key} onPress={() => { tick(); onChange(o.key); }} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <T s={13.5} f={on ? 'bold' : 'semi'} c={on ? C.matchaInk : C.mute} numberOfLines={1}>{o.label}</T>
            </Pressable>
          );
        })}
      </View>
    </Well>
  );
}

export function Chip({ label, on, onPress }) {
  return (
    <Press onPress={onPress} scale={0.95}>
      <Clay radius={16} depth={on ? 0.5 : 0.3} colors={on ? C.matcha : C.card} inner={{ paddingVertical: 6, paddingHorizontal: 14 }}>
        <T s={13} f="bold" c={on ? '#fff' : C.mute}>{label}</T>
      </Clay>
    </Press>
  );
}

export function Toggle({ value, onChange, disabled }) {
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => { Animated.spring(x, { toValue: value ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start(); }, [value]);
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: !!value, disabled: !!disabled }}
      onPress={() => { if (disabled) return; tick(); onChange(!value); }}
      style={{ width: 58, height: 34, flexShrink: 0, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      <View style={{ width: 58, height: 34, borderRadius: 17, backgroundColor: value ? C.mist : C.well, borderWidth: 2, borderTopColor: 'rgba(88,112,58,0.18)', borderLeftColor: 'rgba(88,112,58,0.12)', borderBottomColor: 'rgba(255,255,255,0.9)', borderRightColor: 'rgba(255,255,255,0.8)' }}>
        <Animated.View style={{ position: 'absolute', top: 1, left: 1, width: 26, height: 26, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) }] }}>
          <Clay radius={13} depth={0.35} colors={value ? C.matcha : C.card} style={{ width: 26, height: 26 }} inner={{ width: 26, height: 26, padding: 0, borderWidth: 1.5 }} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

export function Stepper({ label, hint, value, unit = '', onChange, min, max, step = 1, disabled, format }) {
  const set = v => onChange(Math.min(max, Math.max(min, +(v).toFixed(1))));
  const Btn = ({ icon, d }) => (
    <Press onPress={() => set(value + d)} disabled={disabled || (d < 0 ? value <= min : value >= max)} style={{ opacity: disabled || (d < 0 ? value <= min : value >= max) ? 0.35 : 1 }}>
      <Clay radius={15} depth={0.4} inner={{ width: 34, height: 34, padding: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 }}>
        <Icon name={icon} size={18} color={C.matchaInk} sw={2.2} />
      </Clay>
    </Press>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, gap: 8 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T s={15} f="bold">{label}</T>
        {hint ? <T s={12.5} c={C.mute} f="reg">{hint}</T> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <Btn icon="minus" d={-step} />
        <T s={15.5} f="black" c={C.matchaInk} style={{ minWidth: 64, textAlign: 'center' }}>{format ? format(value) : `${value}${unit}`}</T>
        <Btn icon="plus" d={step} />
      </View>
    </View>
  );
}

export function Pill({ label, tone = 'ok', dot = true }) {
  const col = { ok: C.ok, warn: C.warn, bad: C.bad, info: C.info, mute: C.mute }[tone] || C.ok;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: col + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
      {dot ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: col }} /> : null}
      <T s={12} f="bold" c={col}>{label}</T>
    </View>
  );
}

export const Divider = () => <View style={{ height: 1.5, backgroundColor: 'rgba(88,112,58,0.09)', marginVertical: 6 }} />;

export function Header({ title, sub, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
      <View style={{ flex: 1 }}>
        <T s={28} f="black" c={C.matchaInk} style={{ letterSpacing: -0.6 }}>{title}</T>
        {sub ? <T s={14} c={C.mute} f="reg">{sub}</T> : null}
      </View>
      {right}
    </View>
  );
}

export const Label = ({ children, style }) =>
  <T s={12.5} f="bold" c={C.mute} style={[{ letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }, style]}>{children}</T>;

export function Screen({ children, onRefresh, refreshing, maxWidth = 760 }) {
  const ins = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pad = width >= 768 ? 28 : 18;
  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: ins.top + 14, paddingHorizontal: pad, paddingBottom: (width >= 900 ? 40 : 130 + ins.bottom), width: '100%', maxWidth, alignSelf: 'center' }}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.matchaDeep} colors={[C.matchaDeep]} /> : undefined}>
      {children}
    </ScrollView>
  );
}

export const Gap = ({ h = 14 }) => <View style={{ height: h }} />;
