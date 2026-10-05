import React, { useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import { Clay, T, Pill, Toggle, Button, Screen, Header, Gap, Label, Divider } from '../components/Clay';
import Icon from '../components/Icon';
import { useApi } from '../hooks';
import { BASE } from '../api';
import { lockEnabled, setLockEnabled, biometricsAvailable } from '../lock';
import { ago, uptime } from '../util';
import { C } from '../theme';

const Row = ({ label, value }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
    <T s={14} c={C.mute}>{label}</T>
    <T s={14} f="bold">{value ?? '–'}</T>
  </View>
);

function Bars({ rssi }) {
  const n = rssi == null ? 0 : rssi > -55 ? 4 : rssi > -65 ? 3 : rssi > -75 ? 2 : 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 18 }}>
      {[6, 10, 14, 18].map((h, i) => <View key={i} style={{ width: 5, height: h, borderRadius: 2.5, backgroundColor: i < n ? C.matchaFlat : C.well }} />)}
    </View>
  );
}

export default function Device({ active, user, onSignOut }) {
  const q = useApi('/api/status', { ms: 10000, active });
  const t = q.data?.telemetry || {}, online = q.data?.online;
  const [lock, setLock] = useState(false), [bio, setBio] = useState(false);
  useEffect(() => { lockEnabled().then(setLock); biometricsAvailable().then(setBio); }, [active]);
  const host = BASE.replace(/^https?:\/\//, '');

  return (
    <Screen onRefresh={q.reload} refreshing={false}>
      <Header title="Device" sub="The ESP32 in your garden" />

      <Clay radius={28} inner={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: C.mist, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chip" size={26} color={C.matchaDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <T s={18} f="black" c={C.matchaInk}>AgriSense node</T>
            <T s={13} c={C.mute} f="reg">{t.updated_at ? `Last seen ${ago(t.updated_at)}` : 'Never seen'}</T>
          </View>
          {q.data ? <Pill label={online ? 'Online' : 'Offline'} tone={online ? 'ok' : 'bad'} /> : null}
        </View>
        <Divider />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
          <T s={14} c={C.mute}>Wi-Fi signal</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T s={13} c={C.faint}>{t.rssi != null ? `${t.rssi} dBm` : ''}</T><Bars rssi={t.rssi} />
          </View>
        </View>
        <Row label="Uptime" value={uptime(t.uptime_s)} />
        <Row label="Restarts" value={t.boots} />
        <Row label="Free memory" value={t.heap != null ? `${Math.round(t.heap / 1024)} KB` : null} />
        <Row label="Firmware" value={t.fw} />
        <Row label="Soil sensor" value={t.soil_fault ? 'Fault' : t.soil_pct != null ? 'Working' : null} />
      </Clay>

      <Gap h={22} />
      <Label>Account</Label>
      <Clay radius={28} inner={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: C.mist, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="user" size={23} color={C.matchaDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <T s={15} f="bold" numberOfLines={1}>{user?.email}</T>
            <T s={12.5} c={C.mute} f="reg">{user?.role === 'admin' ? 'Admin · can control and change settings' : 'Viewer · read only'}</T>
          </View>
        </View>
        <Divider />
        {Platform.OS !== 'web' && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <T s={15} f="bold">Lock with biometrics</T>
            <T s={12.5} c={C.mute} f="reg">{bio ? 'Ask for fingerprint or face when you come back to the app.' : 'Set up a fingerprint or face unlock on this phone first.'}</T>
          </View>
          <Toggle value={lock} disabled={!bio} onChange={async v => { if (await setLockEnabled(v)) setLock(v); }} />
        </View>}
        <Gap h={10} />
        <Button kind="danger" icon="logout" label="Sign out" onPress={onSignOut} />
      </Clay>

      <T s={12} c={C.faint} f="reg" style={{ textAlign: 'center', marginTop: 22 }}>AgriSense 1.0 · {host}</T>
    </Screen>
  );
}
