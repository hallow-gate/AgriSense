import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { holdSplash, hideSplash } from './src/splash';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';

import { C } from './src/theme';
import { loadSession, me, logout, setOnAuthLost } from './src/api';
import { lockEnabled, unlock } from './src/lock';
import TabBar from './src/components/TabBar';
import { Button, T } from './src/components/Clay';
import { LogoDisc } from './src/components/Logo';
import Login from './src/screens/Login';
import Home from './src/screens/Home';
import Stats from './src/screens/Stats';
import Logs from './src/screens/Logs';
import Control from './src/screens/Control';
import Device from './src/screens/Device';

holdSplash();

const TABS = [
  { key: 'home', label: 'Home', icon: 'home', Screen: Home },
  { key: 'stats', label: 'Stats', icon: 'chart', Screen: Stats },
  { key: 'logs', label: 'Logs', icon: 'list', Screen: Logs },
  { key: 'control', label: 'Control', icon: 'sliders', Screen: Control },
  { key: 'device', label: 'Device', icon: 'chip', Screen: Device },
];
const RELOCK_AFTER_MS = 30_000;

function LockScreen({ onUnlock }) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async () => { setBusy(true); if (await unlock()) onUnlock(); setBusy(false); }, [onUnlock]);
  useEffect(() => { run(); }, []);
  return (
    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 40 }}>
      <LogoDisc size={96} />
      <T s={24} f="black" c={C.matchaInk}>AgriSense is locked</T>
      <Button label="Unlock" icon="lock" onPress={run} loading={busy} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

function Shell({ user, onSignOut }) {
  const [tab, setTab] = useState('home'), [seen, setSeen] = useState({ home: true });
  const [locked, setLocked] = useState(false);
  const bgAt = useRef(0);

  useEffect(() => { lockEnabled().then(on => on && setLocked(true)); }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', async state => {
      if (state === 'background' || state === 'inactive') { if (!bgAt.current) bgAt.current = Date.now(); }
      else if (state === 'active') {
        if (bgAt.current && Date.now() - bgAt.current > RELOCK_AFTER_MS && (await lockEnabled())) setLocked(true);
        bgAt.current = 0;
      }
    });
    return () => sub.remove();
  }, []);

  const go = k => { setTab(k); setSeen(s => (s[k] ? s : { ...s, [k]: true })); };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {TABS.map(({ key, Screen }) => seen[key] && (
        <View key={key} style={[StyleSheet.absoluteFill, tab !== key && { display: 'none' }]}>
          <Screen active={tab === key && !locked} user={user} go={go} onSignOut={onSignOut} />
        </View>
      ))}
      <TabBar tabs={TABS} active={tab} onChange={go} />
      {locked ? <LockScreen onUnlock={() => setLocked(false)} /> : null}
    </View>
  );
}

export default function App() {
  const [fontsReady] = useFonts({ Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  const [booted, setBooted] = useState(false), [user, setUser] = useState(null);

  useEffect(() => {
    setOnAuthLost(() => setUser(null));
    (async () => {
      const s = await loadSession();
      if (s) {
        try { setUser(await me()); }
        catch (e) { if (e.status === 0) setUser(s.user); }     // offline at launch: keep the session, screens show the error
      }
      setBooted(true);
    })();
  }, []);

  useEffect(() => { if (fontsReady && booted) hideSplash(); }, [fontsReady, booted]);
  if (!fontsReady || !booted) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          {user ? <Shell user={user} onSignOut={async () => { await logout(); setUser(null); }} /> : <Login onDone={setUser} />}
        </View>
      </View>
    </SafeAreaProvider>
  );
}
