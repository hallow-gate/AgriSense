import { Textbee } from '@textbee/sdk';
import { cfg } from './config.js';
import { getSettings } from './settings.js';

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

// Plain GSM characters only (no degree sign / dashes) so one SMS segment stays 160 chars.
const stamp = (iso, tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' })
  .format(new Date(iso)).replace(/,/g, '');

// One block per event:  status line, the reading, then the timestamp
function block(e) {
  const d = e.detail || {}, src = SRC[e.source] || e.source;
  const out = [];
  const failed = d.result && d.result !== 'ok';
  const soil = Number.isFinite(d.soil_pct) && d.soil_pct >= 0 ? `${d.soil_pct}%` : null;
  const temp = Number.isFinite(d.temp_c) && d.temp_c !== 0 ? `${Number(d.temp_c).toFixed(1)} C` : null;

  if (e.type === 'water_auto' || e.type === 'water_manual') {
    out.push(failed ? `Pump FAILED (${WHY[d.result] || d.result}) [${src}]` : `Pump ON ${d.seconds ? d.seconds + 's' : ''} - ${LABEL[e.type]} [${src}]`.replace(/ +/g, ' '));
    if (soil) out.push(`Soil moisture: ${soil}`);
  } else if (e.type === 'water_skipped') {
    out.push(`Pump OFF - watering skipped (${WHY[d.reason] || d.reason || 'skipped'}) [${src}]`);
    if (soil) out.push(`Soil moisture: ${soil}`);
  } else if (e.type === 'shade_close' || e.type === 'shade_open') {
    const closing = e.type === 'shade_close';
    out.push(failed ? `Shade FAILED (${WHY[d.result] || d.result}) [${src}]` : `Shade ${closing ? 'CLOSED' : 'OPENED'} [${src}]`);
    if (temp) out.push(`Temperature: ${temp}`);
  } else out.push(`${LABEL[e.type] || e.type} [${src}]`);

  out.push(`Time: ${stamp(e.occurred_at, cfg.TIMEZONE)}`);
  return out.join('\n');
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
    const message = ('AgriSense\n' + fresh.map(block).join('\n\n')).slice(0, 480);
    await client.sendSms({ ...(cfg.TEXTBEE_DEVICE_ID ? { deviceId: cfg.TEXTBEE_DEVICE_ID } : {}), recipients: s.sms_recipients, message });
  } catch (e) { console.error('sms failed', e?.message); }           // never break the device sync
}
