import React from 'react';
import { View } from 'react-native';
import { Clay, T, Pill, Press, Screen, Gap, Label, Divider } from '../components/Clay';
import { Ring, Spark } from '../components/Charts';
import { Wordmark } from '../components/Logo';
import Icon from '../components/Icon';
import { useApi } from '../hooks';
import { fmt, ago, hourLabel, eventMeta } from '../util';
import { C } from '../theme';

const TONE = { critical: C.bad, warning: C.warn, info: C.info };
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

function Tile({ icon, color, label, value, children, flex = 1 }) {
  return (
    <Clay style={{ flex }} radius={24} inner={{ padding: 14, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={17} color={color} />
        <T s={12.5} f="bold" c={C.mute}>{label}</T>
      </View>
      <T s={26} f="black" c={C.ink} style={{ letterSpacing: -0.5 }}>{value}</T>
      {children}
    </Clay>
  );
}

const VPD_SEGS = [C.info, '#B7CC95', C.ok, C.warn, C.bad];

export default function Home({ active, go }) {
  const st = useApi('/api/status', { ms: 8000, active });
  const hist = useApi('/api/history?range=6h', { ms: 60000, active });
  const s = st.data, t = s?.telemetry || {}, set = s?.settings;
  const points = hist.data?.points || [];
  const soilState = t.soil_fault ? 'Sensor fault' : t.soil_pct == null ? 'No reading' : t.soil_pct < (set?.soil_dry_pct ?? 40) ? 'Dry' : t.soil_pct > 75 ? 'Wet' : 'Comfortable';
  const nw = s?.next_watering;

  return (
    <Screen onRefresh={() => { st.reload(); hist.reload(); }} refreshing={st.loading && !!s}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Wordmark />
        {s ? <Pill label={s.online ? 'Online' : 'Offline'} tone={s.online ? 'ok' : 'bad'} /> : null}
      </View>
      <T s={14} c={C.mute} f="reg" style={{ marginBottom: 18 }}>{greet()}. {s?.online ? 'Everything is reporting in.' : s ? 'The device has gone quiet.' : ' '}</T>

      {st.error && !s ? <Clay><T c={C.bad}>{st.error.message}</T></Clay> : null}

      {(s?.alerts || []).map(a => (
        <Clay key={a.key} radius={20} style={{ marginBottom: 10 }} inner={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{ width: 8, alignSelf: 'stretch', borderRadius: 4, backgroundColor: TONE[a.level] }} />
          <T s={14} f="semi" style={{ flex: 1 }}>{a.text}</T>
        </Clay>
      ))}

      <Clay radius={30} inner={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <Ring size={132} stroke={15} value={t.soil_pct ?? 0}>
          <T s={30} f="black" c={C.matchaInk} style={{ letterSpacing: -1 }}>{t.soil_pct == null ? '–' : t.soil_pct}<T s={15} c={C.mute}>%</T></T>
        </Ring>
        <View style={{ flex: 1, gap: 6 }}>
          <T s={13} f="bold" c={C.mute}>Soil moisture</T>
          <T s={21} f="black" c={C.matchaInk}>{soilState}</T>
          {nw ? (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }}>
              <Icon name="clock" size={15} color={C.mute} />
              <T s={13} c={C.mute}>Next water {nw.day}, {hourLabel(nw.hour)}</T>
            </View>
          ) : null}
          <T s={12} c={C.faint} f="reg">{t.updated_at ? `Updated ${ago(t.updated_at)}` : ''}</T>
        </View>
      </Clay>

      <Gap />
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <Tile icon="thermo" color={C.temp} label="Temperature" value={fmt(t.temp_c, '°', 1)}>
          <Spark values={points.map(p => p.temp)} color={C.temp} />
        </Tile>
        <Tile icon="drop" color={C.hum} label="Humidity" value={fmt(t.humidity, '%')}>
          <Spark values={points.map(p => p.hum)} color={C.hum} />
        </Tile>
      </View>

      <Gap />
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <Tile icon="shade" color={C.matchaFlat} label="Cover" value={t.shade ? (t.shade === 'closed' ? 'Closed' : 'Open') : '–'} />
        <Tile icon="drop" color={C.matchaFlat} label="Pump" value={t.pump ? 'Running' : 'Idle'} />
      </View>

      {s?.vpd ? (
        <>
          <Gap />
          <Clay radius={26} inner={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <T s={13} f="bold" c={C.mute}>Air dryness (VPD)</T>
                <T s={24} f="black" c={C.ink}>{s.vpd.kpa.toFixed(2)} <T s={14} c={C.mute}>kPa</T></T>
              </View>
              <Pill label={s.vpd.zone} tone={s.vpd.zone === 'ideal' ? 'ok' : s.vpd.zone === 'low' || s.vpd.zone === 'high' ? 'warn' : 'bad'} />
            </View>
            <View style={{ marginTop: 14, height: 14, flexDirection: 'row', borderRadius: 7, overflow: 'hidden' }}>
              {VPD_SEGS.map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c, opacity: 0.85 }} />)}
            </View>
            <View style={{ height: 0 }}>
              <View style={{ position: 'absolute', top: -20, left: `${Math.min(100, (s.vpd.kpa / 2) * 100)}%`, marginLeft: -9, width: 18, height: 26, borderRadius: 9, backgroundColor: '#fff', borderWidth: 3, borderColor: C.matchaInk }} />
            </View>
            <T s={12} c={C.faint} f="reg" style={{ marginTop: 10 }}>Around 0.8 to 1.2 kPa most plants drink comfortably.</T>
          </Clay>
        </>
      ) : null}

      <Gap h={22} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Label style={{ marginBottom: 6 }}>Recent</Label>
        <Press onPress={() => go('logs')}><T s={13} f="bold" c={C.matchaFlat}>See all</T></Press>
      </View>
      <Clay radius={26} inner={{ paddingVertical: 8, paddingHorizontal: 16 }}>
        {(s?.events || []).length === 0 ? <T s={14} c={C.mute} style={{ paddingVertical: 12 }}>Nothing has happened yet.</T> :
          s.events.map((e, i) => {
            const m = eventMeta(e);
            return (
              <View key={e.id}>
                {i > 0 && <Divider />}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                  <Icon name={m.icon} size={19} color={m.tone === 'bad' ? C.bad : C.matchaFlat} />
                  <View style={{ flex: 1 }}>
                    <T s={14.5} f="bold">{m.title}</T>
                    {m.sub ? <T s={12.5} c={C.mute} f="reg">{m.sub}</T> : null}
                  </View>
                  <T s={12} c={C.faint}>{ago(e.occurred_at)}</T>
                </View>
              </View>
            );
          })}
      </Clay>
    </Screen>
  );
}
