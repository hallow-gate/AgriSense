import { z } from 'zod';
import { db } from './db.js';

// "09171234567" -> "+639171234567"; anything else must already be +<country><number>
export function normalizePhone(raw) {
  let n = String(raw ?? '').replace(/[\s().-]/g, '');
  if (/^09\d{9}$/.test(n)) n = '+63' + n.slice(1);
  else if (/^639\d{9}$/.test(n)) n = '+' + n;
  return n;
}
const PHONE = /^\+[1-9]\d{7,14}$/;

const Base = z.object({
  auto_water: z.boolean(),
  auto_shade: z.boolean(),
  soil_dry_pct: z.number().int().min(10).max(80),
  hot_c: z.number().min(30).max(45),
  cool_c: z.number().min(25).max(43),
  pump_seconds: z.number().int().min(5).max(180),     // 3 min max
  shade_close_seconds: z.number().int().min(10).max(180),  // time to fully close the cover, 3 min max
  shade_open_seconds: z.number().int().min(10).max(180),   // time to fully open (uncover), 3 min max
  water_hour_1: z.number().int().min(0).max(23),
  water_hour_2: z.number().int().min(0).max(23),
  pump_ml_per_s: z.number().min(1).max(200),
  sms_enabled: z.boolean(),
  sms_recipients: z.array(z.string()).max(3).transform(a => a.map(normalizePhone)),
});
export const SettingsBody = Base.refine(s => s.cool_c <= s.hot_c - 1, { message: 'cool_c must be at least 1 below hot_c', path: ['cool_c'] })
  .refine(s => s.water_hour_1 !== s.water_hour_2, { message: 'watering times must differ', path: ['water_hour_2'] })
  .refine(s => s.sms_recipients.every(n => PHONE.test(n)), { message: 'Phone numbers must look like +639171234567 or 09171234567', path: ['sms_recipients'] })
  .refine(s => new Set(s.sms_recipients).size === s.sms_recipients.length, { message: 'The same number is listed twice', path: ['sms_recipients'] })
  .refine(s => !s.sms_enabled || s.sms_recipients.length >= 1, { message: 'Add at least 1 phone number to turn SMS on', path: ['sms_recipients'] });

const FIELDS = Object.keys(Base.shape);
let cached = null, at = 0;

export async function getSettings() {
  if (cached && Date.now() - at < 10_000) return cached;
  const { data, error } = await db.from('settings').select('*').eq('id', 1).single();
  if (error) throw error;
  cached = Object.fromEntries(FIELDS.map(k => [k, data[k]]));
  cached.updated_at = data.updated_at; at = Date.now();
  return cached;
}
export const dropSettingsCache = () => { cached = null; };

// subset pushed to the ESP32
export const deviceConfig = s => ({
  auto_water: s.auto_water, auto_shade: s.auto_shade, soil_dry_pct: s.soil_dry_pct,
  hot_c: s.hot_c, cool_c: s.cool_c, pump_seconds: s.pump_seconds, shade_close_seconds: s.shade_close_seconds, shade_open_seconds: s.shade_open_seconds,
  water_hour_1: s.water_hour_1, water_hour_2: s.water_hour_2,
});

// viewers never see the phone numbers
export const publicSettings = (s, isAdmin) => isAdmin ? s : { ...s, sms_recipients: [] };
