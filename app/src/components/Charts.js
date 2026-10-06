import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, PanResponder } from 'react-native';
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
// Monotone cubic (Fritsch-Carlson): smooth like a spline but never overshoots the data.
function curve(pts) {
  const n = pts.length;
  if (!n) return '';
  if (n === 1) return `M${pts[0][0]} ${pts[0][1]}`;
  if (n === 2) return `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]}`;
  const dx = [], m = [], t = new Array(n);
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0] || 1e-6; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  }
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h} ${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h} ${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]} ${pts[i + 1][1]}`;
  }
  return d;
}
const useWidth = () => { const [w, setW] = useState(0); return [w, e => setW(e.nativeEvent.layout.width)]; };

// "nice" axis ticks (1, 2, 5 x 10^n)
function niceTicks(lo, hi, want = 4) {
  const span = hi - lo || 1, raw = span / want, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(x => x >= raw) || raw;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return { ticks: out, step };
}

// time ticks that land on round clock times in the viewer's timezone
const MIN = 60000, HR = 3600000, DAY = 86400000;
function timeTicks(t0, t1, maxN = 5) {
  const steps = [10 * MIN, 30 * MIN, HR, 2 * HR, 3 * HR, 6 * HR, 12 * HR, DAY, 2 * DAY, 3 * DAY, 5 * DAY, 7 * DAY];
  const step = steps.find(st => (t1 - t0) / st <= maxN) || steps[steps.length - 1];
  const off = new Date(t0).getTimezoneOffset() * MIN;
  const out = [];
  for (let t = Math.ceil((t0 - off) / step) * step + off; t <= t1; t += step) out.push(t);
  return out;
}

// ---------- sparkline ----------
export function Spark({ values, color = C.matchaFlat, height = 34 }) {
  const [w, onLayout] = useWidth();
  const v = (values || []).filter(x => x != null);
  return (
    <View onLayout={onLayout} style={{ height }}>
      {w > 0 && v.length > 1 && (() => {
        const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
        const pts = v.map((y, i) => [3 + (i / (v.length - 1)) * (w - 6), 3 + (height - 6) * (1 - (y - min) / span)]);
        return <Svg width={w} height={height}><Path d={curve(pts)} stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" /></Svg>;
      })()}
    </View>
  );
}

// ---------- realtime line chart ----------
// points: [{ t: ISO|ms, v: number|null }]  domain: [fromMs, toMs]  (the x axis is real time, not point index)
// Drag / scrub to read a value; release returns to the live reading.
export function LineChart({ points, domain, color = C.matchaFlat, height = 190, dec = 0, unit = '', onSelect, fmtX, id = 'a', gapMs = 30 * MIN, refLine, live = false }) {
  const [w, onLayout] = useWidth();
  const [sel, setSel] = useState(null);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!live) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start(); return () => loop.stop();
  }, [live]);

  const api = useRef({ pick: () => {}, end: () => {} });
  const last = useRef(-1);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > Math.abs(g.dy) + 2,
    onPanResponderTerminationRequest: () => true,
    onPanResponderGrant: e => api.current.pick(e.nativeEvent.locationX),
    onPanResponderMove: e => api.current.pick(e.nativeEvent.locationX),
    onPanResponderRelease: () => api.current.end(),
    onPanResponderTerminate: () => api.current.end(),
  })).current;

  const pad = { l: 38, r: 12, t: 14, b: 24 };
  const pts = points.map(p => ({ t: typeof p.t === 'number' ? p.t : new Date(p.t).getTime(), v: p.v })).filter(p => p.v != null && !Number.isNaN(p.t)).sort((a, b) => a.t - b.t);
  if (!pts.length) return <View onLayout={onLayout} style={{ height, alignItems: 'center', justifyContent: 'center' }}><T s={13} c={C.faint}>No readings in this range yet</T></View>;

  const t0 = domain ? domain[0] : pts[0].t, t1 = domain ? domain[1] : pts[pts.length - 1].t;
  let min = Math.min(...pts.map(p => p.v)), max = Math.max(...pts.map(p => p.v));
  if (refLine) { min = Math.min(min, refLine.v); max = Math.max(max, refLine.v); }
  const span = max - min || Math.max(1, Math.abs(max) * 0.1), lo = min - span * 0.15, hi = max + span * 0.15;
  const iw = Math.max(1, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const X = t => pad.l + ((t - t0) / (t1 - t0 || 1)) * iw;
  const Y = v => pad.t + ih * (1 - (v - lo) / (hi - lo));

  // break the line wherever the device stopped reporting, so gaps stay honest
  const runs = []; let cur = [];
  pts.forEach((p, i) => {
    if (i && p.t - pts[i - 1].t > gapMs) { runs.push(cur); cur = []; }
    cur.push([X(p.t), Y(p.v)]);
  });
  runs.push(cur);

  const nearest = x => {
    let best = 0, bd = 1e12;
    pts.forEach((p, i) => { const d = Math.abs(X(p.t) - x); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const pick = x => {
    if (!w) return;
    const i = nearest(x);
    if (i === last.current) return;
    last.current = i; setSel(i); onSelect && onSelect({ t: new Date(pts[i].t).toISOString(), v: pts[i].v });
  };
  api.current = { pick, end: () => { last.current = -1; setSel(null); onSelect && onSelect(null); } };

  const yt = niceTicks(lo, hi, height > 170 ? 4 : 3).ticks;
  const xt = timeTicks(t0, t1, w < 340 ? 3 : w < 520 ? 4 : 6);
  const lastP = pts[pts.length - 1], sp = sel != null ? pts[Math.min(sel, pts.length - 1)] : null;
  const fmtV = v => v.toFixed(dec) + unit;

  // tooltip bubble kept inside the plot
  let tip = null;
  if (sp) {
    const label = fmtV(sp.v), tw = Math.max(46, label.length * 8 + 16), tx = Math.min(Math.max(X(sp.t) - tw / 2, pad.l), w - pad.r - tw), ty = Math.max(0, Y(sp.v) - 40);
    tip = (<>
      <Rect x={tx} y={ty} width={tw} height={26} rx={9} fill={C.matchaInk} />
      <SText x={tx + tw / 2} y={ty + 17.5} fontSize={12.5} fontFamily={F.bold} fill="#fff" textAnchor="middle">{label}</SText>
    </>);
  }

  return (
    <View onLayout={onLayout} style={{ height, cursor: 'crosshair', userSelect: 'none', touchAction: 'pan-y' }} {...pan.panHandlers}>
      {w > 0 && (
        <>
          <Svg width={w} height={height} pointerEvents="none">
            <Defs><LG id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity="0.32" /><Stop offset="1" stopColor={color} stopOpacity="0" /></LG></Defs>
            {yt.map(tv => (
              <React.Fragment key={'y' + tv}>
                <Line x1={pad.l} x2={w - pad.r} y1={Y(tv)} y2={Y(tv)} stroke="rgba(88,112,58,0.13)" strokeWidth={1.2} strokeDasharray="3 6" />
                <SText x={pad.l - 7} y={Y(tv) + 3.5} fontSize={10.5} fontFamily={F.semi} fill={C.faint} textAnchor="end">{tv.toFixed(dec)}</SText>
              </React.Fragment>
            ))}
            {xt.map((t, i) => {
              const x = X(t); if (x < pad.l + 14 || x > w - pad.r - 14) return null;
              return <SText key={'x' + i} x={x} y={height - 6} fontSize={10.5} fontFamily={F.semi} fill={C.faint} textAnchor="middle">{fmtX ? fmtX(t) : ''}</SText>;
            })}
            {refLine && refLine.v >= lo && refLine.v <= hi && (
              <>
                <Line x1={pad.l} x2={w - pad.r} y1={Y(refLine.v)} y2={Y(refLine.v)} stroke={C.warn} strokeWidth={1.6} strokeDasharray="6 5" opacity={0.8} />
                <SText x={w - pad.r} y={Y(refLine.v) - 5} fontSize={10.5} fontFamily={F.bold} fill={C.warn} textAnchor="end">{refLine.label}</SText>
              </>
            )}
            {runs.map((r, i) => r.length > 1 && (
              <Path key={'a' + i} d={`${curve(r)} L${r[r.length - 1][0]} ${pad.t + ih} L${r[0][0]} ${pad.t + ih} Z`} fill={`url(#fill-${id})`} />
            ))}
            {runs.map((r, i) => <Path key={'l' + i} d={curve(r)} stroke={color} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
            {runs.filter(r => r.length === 1).map((r, i) => <Circle key={'d' + i} cx={r[0][0]} cy={r[0][1]} r={3.2} fill={color} />)}
            {!sp && <Circle cx={X(lastP.t)} cy={Y(lastP.v)} r={4.5} fill="#fff" stroke={color} strokeWidth={2.5} />}
            {sp && (
              <>
                <Line x1={X(sp.t)} x2={X(sp.t)} y1={pad.t} y2={pad.t + ih} stroke={color} strokeWidth={1.4} opacity={0.5} />
                <Circle cx={X(sp.t)} cy={Y(sp.v)} r={6} fill="#fff" stroke={color} strokeWidth={3} />
                {tip}
              </>
            )}
          </Svg>
          {live && !sp && (
            <Animated.View pointerEvents="none" style={{ position: 'absolute', left: X(lastP.t) - 11, top: Y(lastP.v) - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: color, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.6] }) }] }} />
          )}
        </>
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
