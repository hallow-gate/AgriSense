import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';

export const fmt = (v, u = '', d = 0) => (v == null || Number.isNaN(v) ? '–' : `${Number(v).toFixed(d)}${u}`);

export function ago(iso) {
  if (!iso) return '–';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
export const clock = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const dayLabel = iso => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
export const stamp = iso => `${dayLabel(iso)}, ${clock(iso)}`;
export const hourLabel = h => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;
export function uptime(s) {
  if (s == null) return '–';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}
export const uuid = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);

// run `fn` now and every `ms` while `active`
export function usePolling(fn, ms, active = true) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => {
    if (!active) return;
    ref.current();
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms, active]);
}

// ---------- readable labels for log rows ----------
const SRC = { schedule: 'Scheduled', manual: 'Manual', auto_heat: 'Auto, heat' };
const WHY = { wet: 'Soil was moist enough', sensor_fault: 'Soil sensor fault', busy: 'Pump was busy', cooldown: 'Cooling down' };

export function eventMeta(e) {
  const d = e.detail || {}, bad = d.result && d.result !== 'ok', src = SRC[e.source] || e.source;
  const soil = d.soil_pct != null && d.soil_pct >= 0 ? `soil ${d.soil_pct}%` : null;
  const join = (...a) => a.filter(Boolean).join(' · ');
  switch (e.type) {
    case 'water_auto':
    case 'water_manual':
      return bad ? { icon: 'drop', tone: 'bad', title: 'Watering refused', sub: join(src, WHY[d.result] || d.result) }
        : { icon: 'drop', tone: 'ok', title: 'Watered', sub: join(src, d.seconds ? `${d.seconds} s` : null, soil) };
    case 'water_skipped':
      return { icon: 'pause', tone: 'mute', title: 'Watering skipped', sub: join(WHY[d.reason] || d.reason, soil) };
    case 'shade_close':
    case 'shade_open': {
      const closing = e.type === 'shade_close';
      return bad ? { icon: 'shade', tone: 'bad', title: 'Cover move refused', sub: join(src, WHY[d.result] || d.result) }
        : { icon: 'shade', tone: 'ok', title: closing ? 'Cover closed' : 'Cover opened', sub: join(src, d.temp_c ? `${d.temp_c}°C` : null, d.noop ? 'already there' : null) };
    }
    default: return { icon: 'list', tone: 'mute', title: e.type, sub: src };
  }
}

const ACT = {
  login_ok: ['shield', 'ok', 'Signed in'], login_failed: ['lock', 'bad', 'Failed sign-in'], login_locked: ['lock', 'bad', 'Locked out'],
  logout: ['logout', 'mute', 'Signed out'], device_auth_failed: ['chip', 'bad', 'Device request rejected'],
};
export function auditMeta(l) {
  if (l.action === 'command_created') {
    const a = l.meta?.action;
    return { icon: a === 'water' ? 'drop' : 'shade', tone: 'ok', title: `Sent: ${a === 'water' ? 'water now' : a}` };
  }
  if (l.action === 'settings_changed') {
    const keys = Object.keys(l.meta || {});
    return { icon: 'sliders', tone: 'info', title: `Changed ${keys.length} setting${keys.length === 1 ? '' : 's'}`, sub: keys.map(k => k.replace(/_/g, ' ')).join(', ') };
  }
  const a = ACT[l.action];
  return a ? { icon: a[0], tone: a[1], title: a[2] } : { icon: 'list', tone: 'mute', title: l.action };
}
export function deviceName(ua = '') {
  if (/okhttp|Expo|AgriSense/i.test(ua)) return 'Phone app';
  if (/CFNetwork|Darwin/i.test(ua)) return 'iPhone app';
  return ua ? ua.slice(0, 28) : '';
}

// Alert.alert is a no-op on the web, so use the browser's confirm box there.
export function confirmAsk(title, msg, okLabel, onOk) {
  if (Platform.OS === 'web') { if (window.confirm(`${title}\n\n${msg}`)) onOk(); return; }
  Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: okLabel, onPress: onOk }]);
}
