import React, { useState } from 'react';
import { View } from 'react-native';
import { Clay, T, Segmented, Screen, Header, Gap, Label } from '../components/Clay';
import { LineChart, BarChart, RangeChart } from '../components/Charts';
import Icon from '../components/Icon';
import { useApi } from '../hooks';
import { fmt, clock, dayLabel } from '../util';
import { C } from '../theme';

const RANGES = [{ key: '6h', label: '6 h' }, { key: '24h', label: '24 h' }, { key: '7d', label: '7 days' }, { key: '30d', label: '30 days' }];
const short = r => iso => (r === '6h' || r === '24h' ? clock(iso) : dayLabel(iso));

function Series({ id, title, icon, color, unit, dec, points, range }) {
  const [sel, setSel] = useState(null);
  const vals = points.filter(p => p.v != null).map(p => p.v);
  const last = points.filter(p => p.v != null).slice(-1)[0];
  const shown = sel && points.some(p => p.t === sel.t) ? sel : last;
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  return (
    <Clay radius={26} style={{ marginBottom: 16 }} inner={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={icon} size={18} color={color} />
          <T s={14} f="bold" c={C.mute}>{title}</T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T s={24} f="black" c={C.ink} style={{ letterSpacing: -0.5 }}>{shown ? fmt(shown.v, unit, dec) : '–'}</T>
          <T s={11.5} c={C.faint}>{shown ? `${dayLabel(shown.t)}, ${clock(shown.t)}` : ''}</T>
        </View>
      </View>
      <View style={{ marginTop: 6 }}>
        <LineChart id={id} points={points} color={color} dec={dec} onSelect={setSel} fmtX={short(range)} />
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
    <Clay style={{ flex: 1 }} radius={22} inner={{ padding: 14, gap: 2 }}>
      <Icon name={icon} size={18} color={C.matchaFlat} />
      <T s={24} f="black" c={C.ink} style={{ marginTop: 6, letterSpacing: -0.5 }}>{value}</T>
      <T s={12.5} f="bold" c={C.mute}>{label}</T>
      {sub ? <T s={11.5} c={C.faint} f="reg">{sub}</T> : null}
    </Clay>
  );
}

export default function Stats({ active }) {
  const [range, setRange] = useState('24h');
  const days = range === '30d' ? 30 : 7;
  const hist = useApi(`/api/history?range=${range}`, { ms: 60000, active });
  const stats = useApi(`/api/stats?days=${days}`, { ms: 120000, active });
  const pts = hist.data?.points || [];
  const series = k => pts.map(p => ({ t: p.t, v: p[k] }));
  const temp = series('temp'), hum = series('hum'), soil = series('soil');
  const tot = stats.data?.totals, d = stats.data?.days || [];

  return (
    <Screen onRefresh={() => { hist.reload(); stats.reload(); }} refreshing={hist.loading && pts.length > 0}>
      <Header title="Statistics" sub="Drag across a chart to read exact values" />
      <Segmented options={RANGES} value={range} onChange={setRange} />
      <Gap h={18} />

      <Series id="t" title="Temperature" icon="thermo" color={C.temp} unit="°" dec={1} points={temp} range={range} />
      <Series id="h" title="Humidity" icon="drop" color={C.hum} unit="%" dec={0} points={hum} range={range} />
      <Series id="s" title="Soil moisture" icon="leaf" color={C.soil} unit="%" dec={0} points={soil} range={range} />

      <Label style={{ marginTop: 6 }}>Last {days} days</Label>
      <View style={{ flexDirection: 'row', gap: 14, marginBottom: 14 }}>
        <Stat icon="drop" label="Waterings" value={tot ? tot.waterings : '–'} sub={tot?.skipped ? `${tot.skipped} skipped` : null} />
        <Stat icon="gauge" label="Water used" value={tot ? `${tot.liters} L` : '–'} sub="estimated" />
      </View>
      <View style={{ flexDirection: 'row', gap: 14, marginBottom: 16 }}>
        <Stat icon="thermo" label="Avg temperature" value={tot ? fmt(tot.avg_temp, '°', 1) : '–'} sub={tot?.max_temp != null ? `peak ${tot.max_temp}°` : null} />
        <Stat icon="shade" label="Cover moves" value={tot ? tot.shade_moves : '–'} />
      </View>

      <Clay radius={26} style={{ marginBottom: 16 }} inner={{ padding: 16 }}>
        <T s={14} f="bold" c={C.mute} style={{ marginBottom: 8 }}>Water per day (litres)</T>
        <BarChart id="w" data={d.map(x => ({ label: x.date.slice(8), value: x.liters }))} />
      </Clay>

      <Clay radius={26} inner={{ padding: 16 }}>
        <T s={14} f="bold" c={C.mute}>Daily temperature range</T>
        <T s={12} c={C.faint} f="reg" style={{ marginBottom: 8 }}>Low to high, dot is the average</T>
        <RangeChart data={d.map(x => ({ label: x.date.slice(8), min: x.min_temp, max: x.max_temp, avg: x.avg_temp }))} />
      </Clay>
    </Screen>
  );
}
