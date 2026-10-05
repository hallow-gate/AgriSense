import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
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

export function Press({ onPress, disabled, children, style, scale = 0.97 }) {
  const v = useRef(new Animated.Value(1)).current;
  const to = x => Animated.spring(v, { toValue: x, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable disabled={disabled} onPressIn={() => to(scale)} onPressOut={() => to(1)}
      onPress={() => { try { Haptics.selectionAsync(); } catch {} onPress && onPress(); }}>
      <Animated.View style={[{ transform: [{ scale: v }] }, style]}>{children}</Animated.View>
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
  return (
    <Well radius={22} style={{ flexDirection: 'row', padding: 3 }}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <Press key={o.key} onPress={() => onChange(o.key)} style={{ flex: 1 }} scale={0.98}>
            {on ? (
              <Clay radius={18} depth={0.5} inner={{ paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center' }}>
                <T s={13.5} f="bold" c={C.matchaInk}>{o.label}</T>
              </Clay>
            ) : (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}><T s={13.5} f="semi" c={C.mute}>{o.label}</T></View>
            )}
          </Press>
        );
      })}
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
  useEffect(() => { Animated.spring(x, { toValue: value ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 8 }).start(); }, [value]);
  return (
    <Pressable onPress={() => { if (disabled) return; try { Haptics.selectionAsync(); } catch {} onChange(!value); }} style={{ opacity: disabled ? 0.5 : 1 }}>
      <Well radius={18} style={{ width: 58, height: 34, justifyContent: 'center', backgroundColor: value ? C.mist : C.well }}>
        <Animated.View style={{ transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [1, 23] }) }] }}>
          <Clay radius={14} depth={0.4} colors={value ? C.matcha : C.card} inner={{ width: 28, height: 28, padding: 0, borderWidth: 1.5 }} />
        </Animated.View>
      </Well>
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
      contentContainerStyle={{ paddingTop: ins.top + 14, paddingHorizontal: 18, paddingBottom: 130 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.matchaDeep} colors={[C.matchaDeep]} /> : undefined}>
      {children}
    </ScrollView>
  );
}

export const Gap = ({ h = 14 }) => <View style={{ height: h }} />;
