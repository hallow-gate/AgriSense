import { cfg } from './config.js';
import { localHM } from './util.js';

export const ONLINE_MS = 120_000;
export const isOnline = tel => !!tel?.updated_at && Date.now() - new Date(tel.updated_at).getTime() < ONLINE_MS;

// Vapour pressure deficit (kPa): how hard the air pulls water from leaves.
export function vpd(t, rh) {
  if (t == null || rh == null) return null;
  const es = 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
  const v = +(es * (1 - rh / 100)).toFixed(2);
  const zone = v < 0.4 ? 'too humid' : v < 0.8 ? 'low' : v <= 1.2 ? 'ideal' : v <= 1.6 ? 'high' : 'too dry';
  return { kpa: v, zone };
}

export function nextWatering(s) {
  const hours = [s.water_hour_1, s.water_hour_2].sort((a, b) => a - b);
  const { h, m } = localHM(new Date(), cfg.TIMEZONE);
  const nowMin = h * 60 + m;
  for (const x of hours) if (x * 60 > nowMin) return { hour: x, day: 'today', in_minutes: x * 60 - nowMin };
  return { hour: hours[0], day: 'tomorrow', in_minutes: 1440 - nowMin + hours[0] * 60 };
}

export function buildAlerts({ tel, settings, online, failedSignins, isAdmin }) {
  const a = [];
  if (!tel) a.push({ level: 'info', key: 'no_data', text: 'No data from the device yet.' });
  else if (!online) a.push({ level: 'critical', key: 'offline', text: 'Device is offline. Controls are queued for 10 minutes only.' });
  if (tel && online) {
    if (tel.soil_fault) a.push({ level: 'critical', key: 'soil_fault', text: 'Soil sensor fault. Automatic watering is paused.' });
    if (tel.temp_c != null && tel.temp_c >= settings.hot_c)
      a.push({ level: 'warning', key: 'hot', text: `It is ${tel.temp_c.toFixed(1)}°C, above your ${settings.hot_c}°C limit.` });
    if (!tel.soil_fault && tel.soil_pct != null && tel.soil_pct < settings.soil_dry_pct)
      a.push({ level: 'info', key: 'dry', text: `Soil is dry (${tel.soil_pct}%).` });
    if (tel.rssi != null && tel.rssi < -80) a.push({ level: 'info', key: 'wifi', text: 'Weak Wi-Fi at the device.' });
  }
  if (isAdmin && failedSignins >= 3) a.push({ level: 'warning', key: 'signins', text: `${failedSignins} failed sign-in attempts in the last 24 hours.` });
  return a;
}
