import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Press, T } from './Clay';
import Icon from './Icon';
import { C } from '../theme';

// Docked, flat bar: one pill behind the active icon, label always visible.
export default function TabBar({ tabs, active, onChange }) {
  const ins = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: C.card[0],
      borderTopWidth: 1, borderTopColor: 'rgba(88,112,58,0.14)', paddingTop: 8, paddingBottom: Math.max(ins.bottom, 8) }}>
      {tabs.map(t => {
        const on = t.key === active;
        return (
          <Press key={t.key} onPress={() => onChange(t.key)} style={{ flex: 1 }} scale={0.95}>
            <View style={{ alignItems: 'center', gap: 3 }}>
              <View style={{ width: 58, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.mist : 'transparent' }}>
                <Icon name={t.icon} size={21} color={on ? C.matchaDeep : C.mute} />
              </View>
              <T s={11} f={on ? 'black' : 'semi'} c={on ? C.matchaInk : C.mute} numberOfLines={1}>{t.label}</T>
            </View>
          </Press>
        );
      })}
    </View>
  );
}
