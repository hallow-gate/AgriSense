import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

// Hand-drawn 24px line icons. Strings are paths, {c:[cx,cy,r]} circles, {r:[x,y,w,h,rx]} rects.
const I = {
  home: ['M3.5 11 12 4l8.5 7', 'M5.5 9.5V20h13V9.5', 'M10 20v-5h4v5'],
  chart: ['M4 4v16h16', 'M8 15l3.5-4.5 3 2.5L19 7'],
  list: ['M9 6.5h11', 'M9 12h11', 'M9 17.5h11', { c: [4.5, 6.5, 1] }, { c: [4.5, 12, 1] }, { c: [4.5, 17.5, 1] }],
  sliders: ['M4 7h8', 'M16 7h4', 'M4 17h4', 'M12 17h8', { c: [14, 7, 2] }, { c: [10, 17, 2] }],
  chip: [{ r: [7, 7, 10, 10, 2] }, 'M10 4v3', 'M14 4v3', 'M10 17v3', 'M14 17v3', 'M4 10h3', 'M4 14h3', 'M17 10h3', 'M17 14h3'],
  drop: ['M12 3.5c3.4 4 5.7 6.9 5.7 9.6a5.7 5.7 0 0 1-11.4 0C6.3 10.4 8.6 7.5 12 3.5z'],
  thermo: ['M10 14.2V5.5a2 2 0 1 1 4 0v8.7a4 4 0 1 1-4 0z'],
  shade: ['M3.5 12a8.5 8.5 0 0 1 17 0z', 'M12 12v5.5a2 2 0 0 1-4 0'],
  sun: [{ c: [12, 12, 3.6] }, 'M12 3v2', 'M12 19v2', 'M3 12h2', 'M19 12h2', 'M5.6 5.6 7 7', 'M17 17l1.4 1.4', 'M5.6 18.4 7 17', 'M17 7l1.4-1.4'],
  leaf: ['M5 19c0-8 5-14 14.5-14.5C19.5 14 14 19.5 5 19z', 'M5 19c3-5.5 6.5-8.5 10-10.5'],
  user: [{ c: [12, 8, 3.8] }, 'M4.5 20c.6-3.8 3.7-5.8 7.5-5.8s6.9 2 7.5 5.8'],
  shield: ['M12 3.5l7.5 2.8v5.6c0 4.4-3.1 7.5-7.5 8.6-4.4-1.1-7.5-4.2-7.5-8.6V6.3L12 3.5z', 'M9 12l2.2 2.2L15.2 10'],
  wifi: ['M3 9.5a13.5 13.5 0 0 1 18 0', 'M6 13a9 9 0 0 1 12 0', 'M9 16.5a4.5 4.5 0 0 1 6 0', { c: [12, 19.5, 0.6] }],
  clock: [{ c: [12, 12, 8.5] }, 'M12 7.5V12l3 2'],
  logout: ['M9.5 4.5h-4v15h4', 'M15 8l4 4-4 4', 'M19 12H9.5'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  alert: ['M12 4l8.5 15h-17L12 4z', 'M12 10v4.2', 'M12 16.8v.1'],
  lock: [{ r: [5, 11, 14, 9, 2.5] }, 'M8 11V8.5a4 4 0 0 1 8 0V11'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  pause: ['M9 6.5v11', 'M15 6.5v11'],
  refresh: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v4h-4'],
  chevron: ['M9 6l6 6-6 6'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', { c: [12, 12, 3] }],
  eyeoff: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', { c: [12, 12, 3] }, 'M4 4l16 16'],
  gauge: ['M4.5 17a8.5 8.5 0 1 1 15 0', 'M12 13l3.5-4'],
};

export default function Icon({ name, size = 22, color = '#2A3320', sw = 1.8 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {(I[name] || []).map((p, i) =>
        typeof p === 'string' ? <Path key={i} d={p} />
          : p.c ? <Circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} />
          : <Rect key={i} x={p.r[0]} y={p.r[1]} width={p.r[2]} height={p.r[3]} rx={p.r[4]} />)}
    </Svg>
  );
}
