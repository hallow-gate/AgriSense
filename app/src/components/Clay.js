import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tick } from '../haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '../theme';
import Icon from './Icon';

const LINE = 'rgba(88,112,58,0.12)';
const BEVEL = { borderColor: LINE };

export const T = ({ s = 15, c = C.ink, f = 'semi', style, children, ...p }) =>
  <Text {...p} style={[{ fontSize: s, color: c, fontFamily: F[f] }, style]}>{children}</Text>;

// Raised clay surface: diagonal gradient + lit top-left bevel + soft drop shadow.
export function Clay({ children, style, inner, radius = 26, colors = C.card, depth = 1 }) {
  const shadow = {
    shadowColor: C.shadow, shadowOpacity: 0.12 * Math.min(depth, 1.2), shadowRadius: 10 * depth,
    shadowOffset: { width: 0, height: 4 * depth }, elevation: Math.round(2 * depth),
  };
  return (
    <View style={[{ borderRadius: radius, backgroundColor: colors[1] }, shadow, style]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[{ borderRadius: radius, borderWidth: 1, ...BEVEL, padding: 16 }, inner]}>
        {children}
      </LinearGradient>
    </View>
  );
}

export function Well({ children, style, radius = 18 }) {
  return <View style={[{ backgroundColor: C.well, borderRadius: radius, borderWidth: 1, borderColor: LINE }, style]}>{children}</View>;
}

export function Press({ onPress, disabled, children, style, scale = 0.97 }) {
  const v = useRef(new Animated.Value(1)).current;
  const to = x => Animated.spring(v, { toValue: x, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable disabled={disabled} onPressIn={() => to(scale)} onPressOut={() => to(1)}
      onPress={() => { tick(); onPress && onPress(); }}>
      <Animated.View style={[{ transform: [{ scale: v }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({ label, onPress, kind = 'matcha', icon, disabled, loading, style }) {
  const matcha = kind === 'matcha', danger = kind === 'danger';
  const bg = matcha ? C.matchaFlat : danger ? '#F6E3DC' : C.mist;
  const color = matcha ? '#fff' : danger ? C.bad : C.matchaInk;
  return (
    <Press onPress={onPress} disabled={disabled || loading} style={[{ opacity: disabled ? 0.45 : 1 }, style]}>
      <View style={{ minHeight: 48, borderRadius: 16, backgroundColor: bg, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading ? <ActivityIndicator color={color} /> : icon ? <Icon name={icon} size={19} color={color} /> : null}
        <T s={15} f="bold" c={color}>{label}</T>
      </View>
    </Press>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <Well radius={16} style={{ flexDirection: 'row', padding: 4, gap: 4 }}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <Press key={o.key} onPress={() => onChange(o.key)} style={{ flex: 1 }} scale={0.98}>
            <View style={[{ height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
              on && { backgroundColor: '#fff', shadowColor: C.shadow, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }]}>
              <T s={13.5} f={on ? 'black' : 'semi'} c={on ? C.matchaInk : C.mute} numberOfLines={1}>{o.label}</T>
            </View>
          </Press>
        );
      })}
    </Well>
  );
}

export function Chip({ label, on, onPress }) {
  return (
    <Press onPress={onPress} scale={0.95}>
      <View style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: on ? C.matchaFlat : 'transparent', borderWidth: 1, borderColor: on ? C.matchaFlat : 'rgba(88,112,58,0.28)' }}>
        <T s={13} f="bold" c={on ? '#fff' : C.mute}>{label}</T>
      </View>
    </Press>
  );
}

export function Toggle({ value, onChange, disabled }) {
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => { Animated.spring(x, { toValue: value ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start(); }, [value]);
  return (
    <Pressable onPress={() => { if (disabled) return; tick(); onChange(!value); }} style={{ opacity: disabled ? 0.5 : 1 }}>
      <View style={{ width: 52, height: 30, borderRadius: 15, justifyContent: 'center', backgroundColor: value ? C.matchaFlat : C.well, borderWidth: 1, borderColor: value ? C.matchaFlat : 'rgba(88,112,58,0.28)' }}>
        <Animated.View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: C.shadow, shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [3, 25] }) }] }} />
      </View>
    </Pressable>
  );
}

export function Stepper({ label, hint, value, unit = '', onChange, min, max, step = 1, disabled, format }) {
  const set = v => onChange(Math.min(max, Math.max(min, +(v).toFixed(1))));
  const Btn = ({ icon, d }) => (
    <Press onPress={() => set(value + d)} disabled={disabled || (d < 0 ? value <= min : value >= max)} style={{ opacity: disabled || (d < 0 ? value <= min : value >= max) ? 0.35 : 1 }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.mist, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={C.matchaInk} sw={2.2} />
      </View>
    </Press>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <T s={15} f="bold">{label}</T>
        {hint ? <T s={12.5} c={C.mute} f="reg">{hint}</T> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Btn icon="minus" d={-step} />
        <T s={15.5} f="black" c={C.matchaInk} style={{ minWidth: 66, textAlign: 'center' }}>{format ? format(value) : `${value}${unit}`}</T>
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

export function Screen({ children, onRefresh, refreshing }) {
  const ins = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: ins.top + 14, paddingHorizontal: 18, paddingBottom: 112 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.matchaDeep} colors={[C.matchaDeep]} /> : undefined}>
      {children}
    </ScrollView>
  );
}

export const Gap = ({ h = 14 }) => <View style={{ height: h }} />;
