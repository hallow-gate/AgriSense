import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clay, Press, T } from './Clay';
import Icon from './Icon';
import { C } from '../theme';

export default function TabBar({ tabs, active, onChange }) {
  const ins = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(ins.bottom, 10) + 2 }}>
      <Clay radius={34} depth={1.1} inner={{ padding: 7, flexDirection: 'row', gap: 2 }}>
        {tabs.map(t => {
          const on = t.key === active;
          return (
            <Press key={t.key} onPress={() => onChange(t.key)} style={{ flex: 1 }} scale={0.94}>
              {on ? (
                <Clay colors={C.matcha} radius={26} depth={0.6} inner={{ paddingVertical: 8, paddingHorizontal: 2, alignItems: 'center', gap: 2 }}>
                  <Icon name={t.icon} size={21} color="#fff" />
                  <T s={10.5} f="bold" c="#fff">{t.label}</T>
                </Clay>
              ) : (
                <View style={{ paddingVertical: 10, alignItems: 'center', gap: 2 }}>
                  <Icon name={t.icon} size={21} color={C.mute} />
                  <T s={10.5} f="semi" c={C.mute}>{t.label}</T>
                </View>
              )}
            </Press>
          );
        })}
      </Clay>
    </View>
  );
}
