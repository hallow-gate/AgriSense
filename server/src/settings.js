import { z } from 'zod';
import { db } from './db.js';

const Base = z.object({
  auto_water: z.boolean(),
  auto_shade: z.boolean(),
  soil_dry_pct: z.number().int().min(10).max(80),
  hot_c: z.number().min(30).max(45),
  cool_c: z.number().min(25).max(43),
  pump_seconds: z.number().int().min(5).max(30),
  water_hour_1: z.number().int().min(0).max(23),
  water_hour_2: z.number().int().min(0).max(23),
  pump_ml_per_s: z.number().min(1).max(200),
});
export const SettingsBody = Base.refine(s => s.cool_c <= s.hot_c - 1, { message: 'cool_c must be at least 1 below hot_c', path: ['cool_c'] })
  .refine(s => s.water_hour_1 !== s.water_hour_2, { message: 'watering times must differ', path: ['water_hour_2'] });

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
  hot_c: s.hot_c, cool_c: s.cool_c, pump_seconds: s.pump_seconds,
  water_hour_1: s.water_hour_1, water_hour_2: s.water_hour_2,
});
