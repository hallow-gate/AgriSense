import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Line, Rect, Defs, LinearGradient as LG, Stop, Text as SText } from 'react-native-svg';
import { C, F } from '../theme';
import { T } from './Clay';

// ---------- ring gauge ----------
export function Ring({ size = 150, stroke = 16, value = 0, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, value)) / 100;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs><LG id="ring" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#B0CB84" /><Stop offset="1" stopColor="#5F7F3A" /></LG></Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.well} strokeWidth={stroke} fill="none" />
        {p > 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke="url(#ring)" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} />}
      </Svg>
      {children}
    </View>
  );
}

// ---------- helpers ----------
function smooth(pts) {
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
  }
  const l = pts[pts.length - 1];
  return d + ` L${l[0]} ${l[1]}`;
}
const niceTick = (v, dec) => (dec ? v.toFixed(dec) : String(Math.round(v)));
const useWidth = () => { const [w, setW] = useState(0); return [w, e => setW(e.nativeEvent.layout.width)]; };

// ---------- sparkline ----------
export function Spark({ values, color = C.matchaFlat, height = 34 }) {
  const [w, onLayout] = useWidth();
  const v = (values || []).filter(x => x != null);
  return (
    <View onLayout={onLayout} style={{ height }}>
      {w > 0 && v.length > 1 && (() => {
        const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
        const pts = v.map((y, i) => [3 + (i / (v.length - 1)) * (w - 6), 3 + (height - 6) * (1 - (y - min) / span)]);
        return <Svg width={w} height={height}><Path d={smooth(pts)} stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" /></Svg>;
      })()}
    </View>
  );
}

// ---------- line chart with touch scrubbing ----------
// points: [{ t: ISO, v: number|null }]
export function LineChart({ points, color = C.matchaFlat, height = 150, dec = 0, onSelect, fmtX, id = 'a' }) {
  const [w, onLayout] = useWidth();
  const [sel, setSel] = useState(null);
  const pad = { l: 34, r: 8, t: 8, b: 20 };
  const valid = points.filter(p => p.v != null);
  if (!valid.length) return <View style={{ height, alignItems: 'center', justifyContent: 'center' }}><T s={13} c={C.faint}>No readings in this range yet</T></View>;
  const min = Math.min(...valid.map(p => p.v)), max = Math.max(...valid.map(p => p.v));
  const span = max - min || 1, lo = min - span * 0.18, hi = max + span * 0.18;
  const iw = Math.max(1, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const X = i => pad.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const Y = v => pad.t + ih * (1 - (v - lo) / (hi - lo));

  // split into runs so gaps in data stay gaps
  const runs = []; let cur = [];
  points.forEach((p, i) => { if (p.v == null) { if (cur.length) runs.push(cur); cur = []; } else cur.push([X(i), Y(p.v), i]); });
  if (cur.length) runs.push(cur);

  const touch = e => {
    if (!w) return;
    const x = e.nativeEvent.locationX;
    let best = null, bd = 1e9;
    points.forEach((p, i) => { if (p.v == null) return; const d = Math.abs(X(i) - x); if (d < bd) { bd = d; best = i; } });
    if (best != null && best !== sel) { setSel(best); onSelect && onSelect(points[best]); }
  };
  const ticks = [hi - (hi - lo) * 0.08, (hi + lo) / 2, lo + (hi - lo) * 0.08];
  const xl = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <View onLayout={onLayout} style={{ height }} onTouchStart={touch} onTouchMove={touch}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Defs><LG id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity="0.28" /><Stop offset="1" stopColor={color} stopOpacity="0" /></LG></Defs>
          {ticks.map((tv, i) => (
            <React.Fragment key={i}>
              <Line x1={pad.l} x2={w - pad.r} y1={Y(tv)} y2={Y(tv)} stroke="rgba(88,112,58,0.12)" strokeWidth={1.5} strokeDasharray="4 6" />
              <SText x={pad.l - 6} y={Y(tv) + 4} fontSize={10.5} fontFamily={F.semi} fill={C.faint} textAnchor="end">{niceTick(tv, dec)}</SText>
            </React.Fragment>
          ))}
          {runs.map((r, i) => r.length > 1 && (
            <Path key={'a' + i} d={`${smooth(r)} L${r[r.length - 1][0]} ${pad.t + ih} L${r[0][0]} ${pad.t + ih} Z`} fill={`url(#fill-${id})`} />
          ))}
          {runs.map((r, i) => <Path key={'l' + i} d={smooth(r)} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          {runs.filter(r => r.length === 1).map((r, i) => <Circle key={'d' + i} cx={r[0][0]} cy={r[0][1]} r={3.5} fill={color} />)}
          {fmtX && xl.map((i, k) => points[i] && (
            <SText key={k} x={X(i)} y={height - 4} fontSize={10.5} fontFamily={F.semi} fill={C.faint} textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}>{fmtX(points[i].t)}</SText>
          ))}
          {sel != null && points[sel]?.v != null && (
            <>
              <Line x1={X(sel)} x2={X(sel)} y1={pad.t} y2={pad.t + ih} stroke={color} strokeWidth={1.5} opacity={0.45} />
              <Circle cx={X(sel)} cy={Y(points[sel].v)} r={7} fill="#fff" stroke={color} strokeWidth={3} />
            </>
          )}
        </Svg>
      )}
    </View>
  );
}

// ---------- bars ----------
// data: [{ label, value }]
export function BarChart({ data, height = 140, color = C.matchaFlat, dec = 1, id = 'b' }) {
  const [w, onLayout] = useWidth();
  const max = Math.max(0.1, ...data.map(d => d.value || 0));
  const padB = 20, padT = 16, ih = height - padB - padT, n = data.length;
  const slot = w / Math.max(1, n), bw = Math.min(26, slot * 0.62);
  const every = n > 10 ? Math.ceil(n / 6) : 1;
  return (
    <View onLayout={onLayout} style={{ height }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Defs><LG id={`bar-${id}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#A9C57C" /><Stop offset="1" stopColor={color} /></LG></Defs>
          <Line x1={0} x2={w} y1={padT + ih} y2={padT + ih} stroke="rgba(88,112,58,0.16)" strokeWidth={1.5} />
          {data.map((d, i) => {
            const h = Math.max(d.value ? 6 : 3, ih * ((d.value || 0) / max)), x = slot * i + (slot - bw) / 2, y = padT + ih - h;
            return (
              <React.Fragment key={i}>
                <Rect x={x} y={y} width={bw} height={h} rx={Math.min(8, bw / 2)} fill={d.value ? `url(#bar-${id})` : C.well} />
                {n <= 10 && d.value > 0 && <SText x={x + bw / 2} y={y - 4} fontSize={10.5} fontFamily={F.bold} fill={C.matchaInk} textAnchor="middle">{d.value.toFixed(dec)}</SText>}
                {i % every === 0 && <SText x={x + bw / 2} y={height - 4} fontSize={10.5} fontFamily={F.semi} fill={C.faint} textAnchor="middle">{d.label}</SText>}
              </React.Fragment>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

// ---------- daily min/max temperature capsules ----------
// data: [{ label, min, max, avg }]
export function RangeChart({ data, height = 160, color = C.temp }) {
  const [w, onLayout] = useWidth();
  const have = data.filter(d => d.min != null);
  if (!have.length) return <View style={{ height, alignItems: 'center', justifyContent: 'center' }}><T s={13} c={C.faint}>No temperature history yet</T></View>;
  const lo0 = Math.min(...have.map(d => d.min)) - 1, hi0 = Math.max(...have.map(d => d.max)) + 1;
  const padL = 30, padB = 20, padT = 8, ih = height - padB - padT, iw = Math.max(1, w - padL - 4);
  const Y = v => padT + ih * (1 - (v - lo0) / (hi0 - lo0));
  const n = data.length, slot = iw / n, bw = Math.min(16, slot * 0.55), every = n > 10 ? Math.ceil(n / 6) : 1;
  const ticks = [hi0, (hi0 + lo0) / 2, lo0];
  return (
    <View onLayout={onLayout} style={{ height }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Defs><LG id="rng" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#E3A66E" /><Stop offset="1" stopColor="#B9C98F" /></LG></Defs>
          {ticks.map((t, i) => (
            <React.Fragment key={i}>
              <Line x1={padL} x2={w - 4} y1={Y(t)} y2={Y(t)} stroke="rgba(88,112,58,0.12)" strokeWidth={1.5} strokeDasharray="4 6" />
              <SText x={padL - 6} y={Y(t) + 4} fontSize={10.5} fontFamily={F.semi} fill={C.faint} textAnchor="end">{Math.round(t)}</SText>
            </React.Fragment>
          ))}
          {data.map((d, i) => {
            const x = padL + slot * i + slot / 2;
            return (
              <React.Fragment key={i}>
                {d.min != null && <Rect x={x - bw / 2} y={Y(d.max)} width={bw} height={Math.max(8, Y(d.min) - Y(d.max))} rx={bw / 2} fill="url(#rng)" />}
                {d.avg != null && <Circle cx={x} cy={Y(d.avg)} r={3.2} fill="#fff" />}
                {i % every === 0 && <SText x={x} y={height - 4} fontSize={10.5} fontFamily={F.semi} fill={C.faint} textAnchor="middle">{d.label}</SText>}
              </React.Fragment>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

// ---------- tiny per-day bars for stat tiles ----------
export function MiniBars({ values, color = C.matchaFlat, height = 38 }) {
  const [w, onLayout] = useWidth();
  const n = values.length, max = Math.max(0.0001, ...values.map(v => v || 0)), slot = w / Math.max(1, n), bw = Math.max(2, slot * 0.6);
  return (
    <View onLayout={onLayout} style={{ height, marginTop: 8 }}>
      {w > 0 && n > 0 && (
        <Svg width={w} height={height}>
          {values.map((v, i) => {
            const bh = Math.max(2, (height - 2) * ((v || 0) / max));
            return <Rect key={i} x={slot * i + (slot - bw) / 2} y={height - bh} width={bw} height={bh} rx={Math.min(3, bw / 2)} fill={v ? color : C.well} />;
          })}
        </Svg>
      )}
    </View>
  );
}
