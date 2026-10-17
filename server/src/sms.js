import { Textbee } from '@textbee/sdk';
import { cfg } from './config.js';
import { getSettings } from './settings.js';
import { localHM } from './util.js';

export const SMS_WINDOW_MS = 5 * 60_000;       // events older than this are history, not news

const client = cfg.TEXTBEE_API_KEY ? new Textbee({ apiKey: cfg.TEXTBEE_API_KEY }) : null;

const LABEL = {
  water_auto: 'Scheduled watering done',
  water_manual: 'Manual watering done',
  water_skipped: 'Scheduled watering skipped',
  shade_close: 'Shade closed',
  shade_open: 'Shade opened',
};
const SRC = { schedule: 'schedule', manual: 'manual', auto_heat: 'auto (heat)' };
const WHY = { wet: 'soil is wet', sensor_fault: 'soil sensor fault', busy: 'pump busy', cooldown: 'cooldown' };

function line(e) {
  const d = e.detail || {}, { h, m } = localHM(new Date(e.occurred_at), cfg.TIMEZONE);
  const hm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  let t = LABEL[e.type] || e.type;
  if (d.result && d.result !== 'ok') t += ` FAILED (${WHY[d.result] || d.result})`;
  else if (e.type === 'water_skipped') t += ` (${WHY[d.reason] || d.reason || 'skipped'})`;
  else if (d.seconds) t += ` ${d.seconds}s`;
  return `${hm} ${t} [${SRC[e.source] || e.source}]`;
}

// `rows` must be ONLY events that were newly inserted by this sync (the DB unique
// event_id already filtered replays), so each event is texted at most once.
export async function notifyEvents(rows) {
  try {
    if (!client || !rows.length) return;
    const fresh = rows.filter(e => Date.now() - new Date(e.occurred_at).getTime() <= SMS_WINDOW_MS);
    if (!fresh.length) return;
    const s = await getSettings();
    if (!s.sms_enabled || !s.sms_recipients?.length) return;       // SMS off -> send nothing
    const message = ('AgriSense: ' + fresh.map(line).join('; ')).slice(0, 300);
    await client.sendSms({ ...(cfg.TEXTBEE_DEVICE_ID ? { deviceId: cfg.TEXTBEE_DEVICE_ID } : {}), recipients: s.sms_recipients, message });
  } catch (e) { console.error('sms failed', e?.message); }           // never break the device sync
}
