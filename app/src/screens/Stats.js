import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, Easing, useWindowDimensions } from 'react-native';
import { Clay, T, Segmented, Screen, Header, Gap, Label } from '../components/Clay';
import { LineChart, BarChart, RangeChart } from '../components/Charts';
import Icon from '../components/Icon';
import { useApi } from '../hooks';
import { fmt, dayLabel } from '../util';
import { C } from '../theme';

const RANGES = [{ key: '6h', label: '6 h' }, { key: '24h', label: '24 h' }, { key: '7d', label: '7 days' }, { key: '30d', label: '30 days' }];
const SPAN = { '6h': 6 * 3600e3, '24h': 24 * 3600e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3 };
const SHORT = r => r === '6h' || r === '24h';
const fmtTick = r => ms => {
  const d = new Date(ms);
  if (!SHORT(r)) return dayLabel(d.toISOString());
  return d.toLocaleTimeString([], d.getMinutes() ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' });
};
const stampOf = t => { const d = new Date(t); return `${dayLabel(d.toISOString())}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`; };

function LiveBadge({ at, online, now }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!online) return;
    const l = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    l.start(); return () => l.stop();
  }, [online]);
  const sec = at ? Math.max(0, Math.round((now - new Date(at).getTime()) / 1000)) : null;
  const label = !at ? 'Waiting for device' : !online ? 'Device offline' : sec < 5 ? 'Live · just now' : sec < 90 ? `Live · ${sec}s ago` : `Live · ${Math.round(sec / 60)} min ago`;
  const col = online ? C.ok : C.faint;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: col + '1F', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, alignSelf: 'flex-start' }}>
      <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
        {online ? <Animated.View style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: col, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] }) }] }} /> : null}
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col }} />
      </View>
      <T s={12.5} f="bold" c={online ? C.matchaDeep : C.mute}>{label}</T>
    </View>
  );
}

function Series({ id, title, icon, color, unit, dec, points, range, domain, gapMs, live, liveValue, refLine, height, style }) {
  const [sel, setSel] = useState(null);
  const vals = points.filter(p => p.v != null).map(p => p.v);
  const last = liveValue ?? points.filter(p => p.v != null).slice(-1)[0];
  const shown = sel || last;
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  return (
    <Clay radius={26} style={[{ marginBottom: 16 }, style]} inner={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 3 }}>
          <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={17} color={color} /></View>
          <T s={14.5} f="bold" c={C.mute}>{title}</T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T s={26} f="black" c={C.ink} style={{ letterSpacing: -0.6 }}>{shown ? fmt(shown.v, unit, dec) : '–'}</T>
          <T s={11.5} c={C.faint}>{shown ? (sel ? stampOf(shown.t) : 'Now') : ''}</T>
        </View>
      </View>
      <View style={{ marginTop: 8 }}>
        <LineChart id={id} points={points} domain={domain} color={color} dec={dec} unit={unit} onSelect={setSel} fmtX={fmtTick(range)} gapMs={gapMs} live={live} refLine={refLine} height={height} />
      </View>
      <View style={{ flexDirection: 'row', marginTop: 10, gap: 8 }}>
        {[['Low', vals.length ? Math.min(...vals) : null], ['Average', avg], ['High', vals.length ? Math.max(...vals) : null]].map(([l, v]) => (
          <View key={l} style={{ flex: 1, backgroundColor: C.well, borderRadius: 14, paddingVertical: 8, alignItems: 'center' }}>
            <T s={11} f="bold" c={C.mute}>{l}</T>
            <T s={15} f="black" c={C.matchaInk}>{fmt(v, unit, dec)}</T>
          </View>
        ))}
      </View>
    </Clay>
  );
}

function Stat({ icon, label, value, sub }) {
  return (
    <Clay style={{ flex: 1, minWidth: 0 }} radius={22} inner={{ padding: 14, gap: 2 }}>
      <Icon name={icon} size={18} color={C.matchaFlat} />
      <T s={24} f="black" c={C.ink} style={{ marginTop: 6, letterSpacing: -0.5 }}>{value}</T>
      <T s={12.5} f="bold" c={C.mute}>{label}</T>
      {sub ? <T s={11.5} c={C.faint} f="reg">{sub}</T> : null}
    </Clay>
  );
}

export default function Stats({ active }) {
  const { width } = useWindowDimensions();
  const [range, setRange] = useState('24h');
  const [now, setNow] = useState(Date.now());
  const days = range === '30d' ? 30 : 7;
  const short = SHORT(range);

  // history is the backbone; the status poll adds a fresh point every few seconds so the chart moves in real time
  const hist = useApi(`/api/history?range=${range}`, { ms: short ? 30000 : 120000, active });
  const stats = useApi(`/api/stats?days=${days}`, { ms: 120000, active });
  const st = useApi('/api/status', { ms: 5000, active });
  const tel = st.data?.telemetry, online = st.data?.online;

  const buf = useRef(new Map());
  useEffect(() => {
    if (!tel?.updated_at) return;
    const t = new Date(tel.updated_at).getTime();
    if (!Number.isNaN(t) && !buf.current.has(t)) {
      buf.current.set(t, { t, temp: tel.temp_c, hum: tel.humidity, soil: tel.soil_fault ? null : tel.soil_pct });
      if (buf.current.size > 600) buf.current.delete(buf.current.keys().next().value);
    }
    setNow(Date.now());
  }, [tel?.updated_at, st.data]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const domain = useMemo(() => [now - SPAN[range], now], [range, Math.floor(now / 5000)]);
  const histPts = hist.data?.points || [];
  const bucketMs = (hist.data?.bucket_seconds || 300) * 1000;
  const gapMs = Math.max(bucketMs * 2.5, 15 * 60e3);

  const merged = useMemo(() => {
    const base = histPts.map(p => ({ t: new Date(p.t).getTime(), temp: p.temp, hum: p.hum, soil: p.soil }));
    if (!short) return base;
    const lastT = base.length ? base[base.length - 1].t : 0;
    const extra = [...buf.current.values()].filter(p => p.t > lastT && p.t >= domain[0]);
    return [...base, ...extra];
  }, [hist.data, short, tel?.updated_at, domain]);

  const series = k => merged.map(p => ({ t: p.t, v: p[k] }));
  const liveOf = (k, v) => (tel?.updated_at && v != null && online ? { t: new Date(tel.updated_at).getTime(), v } : null);
  const dry = st.data?.settings?.soil_dry_pct;

  const cols = width >= 1180 ? 2 : 1;                 // two chart columns on big desktop screens
  const chartH = width >= 768 ? 210 : width < 360 ? 160 : 185;
  const cardStyle = cols === 2 ? { flex: 1, minWidth: 0 } : null;
  const tot = stats.data?.totals, d = stats.data?.days || [];
  const tileCols = width >= 700 ? 4 : 2;
  const tiles = [
    <Stat key="w" icon="drop" label="Waterings" value={tot ? tot.waterings : '–'} sub={tot?.skipped ? `${tot.skipped} skipped` : null} />,
    <Stat key="u" icon="gauge" label="Water used" value={tot ? `${tot.liters} L` : '–'} sub="estimated" />,
    <Stat key="t" icon="thermo" label="Avg temperature" value={tot ? fmt(tot.avg_temp, '°', 1) : '–'} sub={tot?.max_temp != null ? `peak ${tot.max_temp}°` : null} />,
    <Stat key="c" icon="shade" label="Cover moves" value={tot ? tot.shade_moves : '–'} />,
  ];
  const rows = []; for (let i = 0; i < tiles.length; i += tileCols) rows.push(tiles.slice(i, i + tileCols));

  const common = { range, domain, gapMs, live: short && !!online, height: chartH, style: cardStyle };
  const A = <Series id="t" title="Temperature" icon="thermo" color={C.temp} unit="°" dec={1} points={series('temp')} liveValue={liveOf('temp', tel?.temp_c)} {...common} />;
  const B = <Series id="h" title="Humidity" icon="drop" color={C.hum} unit="%" dec={0} points={series('hum')} liveValue={liveOf('hum', tel?.humidity)} {...common} />;
  const S = <Series id="s" title="Soil moisture" icon="leaf" color={C.soil} unit="%" dec={0} points={series('soil')} liveValue={liveOf('soil', tel?.soil_fault ? null : tel?.soil_pct)} refLine={dry != null ? { v: dry, label: `Dry below ${dry}%` } : null} {...common} />;

  return (
    <Screen maxWidth={cols === 2 ? 1100 : 760} onRefresh={() => { hist.reload(); stats.reload(); st.reload(); }} refreshing={hist.loading && histPts.length > 0}>
      <Header title="Statistics" sub="Drag across a chart to read exact values" />
      <View style={{ marginBottom: 14 }}><LiveBadge at={tel?.updated_at} online={online} now={now} /></View>
      <Segmented options={RANGES} value={range} onChange={setRange} />
      <Gap h={18} />

      {cols === 2 ? (
        <>
          <View style={{ flexDirection: 'row', gap: 16 }}>{A}{B}</View>
          <View style={{ flexDirection: 'row', gap: 16 }}>{S}<View style={{ flex: 1 }} /></View>
        </>
      ) : <>{A}{B}{S}</>}

      <Label style={{ marginTop: 6 }}>Last {days} days</Label>
      {rows.map((r, i) => <View key={i} style={{ flexDirection: 'row', gap: 14, marginBottom: 14 }}>{r}</View>)}

      <View style={{ flexDirection: cols === 2 ? 'row' : 'column', gap: 16 }}>
        <Clay radius={26} style={[{ marginBottom: 16 }, cardStyle]} inner={{ padding: 16 }}>
          <T s={14} f="bold" c={C.mute} style={{ marginBottom: 8 }}>Water per day (litres)</T>
          <BarChart id="w" data={d.map(x => ({ label: x.date.slice(8), value: x.liters }))} />
        </Clay>
        <Clay radius={26} style={[{ marginBottom: 16 }, cardStyle]} inner={{ padding: 16 }}>
          <T s={14} f="bold" c={C.mute}>Daily temperature range</T>
          <T s={12} c={C.faint} f="reg" style={{ marginBottom: 8 }}>Low to high, dot is the average</T>
          <RangeChart data={d.map(x => ({ label: x.date.slice(8), min: x.min_temp, max: x.max_temp, avg: x.avg_temp }))} />
        </Clay>
      </View>
    </Screen>
  );
}
