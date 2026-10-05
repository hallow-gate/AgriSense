import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { cfg } from '../config.js';
import { wrap, localDate } from '../util.js';
import { getSettings } from '../settings.js';

const r = Router();
const round = (v, d = 1) => (v == null ? null : +Number(v).toFixed(d));

// ---- sensor history for charts ----
const RANGES = { '6h': [6 * 3600, 300], '24h': [24 * 3600, 900], '7d': [7 * 86400, 3600], '30d': [30 * 86400, 14400] };
r.get('/history', wrap(async (req, res) => {
  const range = RANGES[req.query.range] ? req.query.range : '24h';
  const [secs, bucket] = RANGES[range];
  const { data, error } = await db.rpc('readings_bucketed', { since: new Date(Date.now() - secs * 1000).toISOString(), bucket_seconds: bucket });
  if (error) return res.status(500).json({ error: 'db' });
  res.json({ range, bucket_seconds: bucket, points: (data || []).map(p => ({ t: p.t, temp: round(p.temp_c), hum: round(p.humidity, 0), soil: round(p.soil_pct, 0) })) });
}));

// ---- per-day statistics (stats charts + history tab) ----
const Days = z.coerce.number().int().min(1).max(90).catch(7);
r.get('/stats', wrap(async (req, res) => {
  const days = Days.parse(req.query.days);
  const s = await getSettings();
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const [ds, ev] = await Promise.all([
    db.rpc('daily_stats', { days: days + 1, tz: cfg.TIMEZONE }),
    db.from('events').select('type,detail,occurred_at').gte('occurred_at', since).order('occurred_at').limit(1000),
  ]);
  if (ds.error || ev.error) return res.status(500).json({ error: 'db' });

  const map = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = localDate(new Date(Date.now() - i * 864e5), cfg.TIMEZONE);
    map[d] = { date: d, waterings: 0, water_seconds: 0, skipped: 0, shade_moves: 0, avg_temp: null, min_temp: null, max_temp: null, avg_hum: null, avg_soil: null };
  }
  for (const d of ds.data || []) if (map[d.day]) Object.assign(map[d.day], { avg_temp: round(d.avg_temp), min_temp: round(d.min_temp), max_temp: round(d.max_temp), avg_hum: round(d.avg_hum, 0), avg_soil: round(d.avg_soil, 0) });
  for (const e of ev.data || []) {
    const row = map[localDate(new Date(e.occurred_at), cfg.TIMEZONE)];
    if (!row) continue;
    const ok = e.detail?.result === 'ok' && !e.detail?.noop;
    if ((e.type === 'water_auto' || e.type === 'water_manual') && ok) { row.waterings++; row.water_seconds += Number(e.detail?.seconds) || 0; }
    else if (e.type === 'water_skipped') row.skipped++;
    else if ((e.type === 'shade_close' || e.type === 'shade_open') && ok) row.shade_moves++;
  }
  const list = Object.values(map).map(d => ({ ...d, liters: +(d.water_seconds * s.pump_ml_per_s / 1000).toFixed(2) }));
  const temps = list.filter(d => d.avg_temp != null);
  res.json({
    days: list,
    totals: {
      waterings: list.reduce((a, d) => a + d.waterings, 0),
      liters: +list.reduce((a, d) => a + d.liters, 0).toFixed(1),
      shade_moves: list.reduce((a, d) => a + d.shade_moves, 0),
      skipped: list.reduce((a, d) => a + d.skipped, 0),
      avg_temp: temps.length ? round(temps.reduce((a, d) => a + d.avg_temp, 0) / temps.length) : null,
      min_temp: temps.length ? Math.min(...temps.map(d => d.min_temp)) : null,
      max_temp: temps.length ? Math.max(...temps.map(d => d.max_temp)) : null,
    },
  });
}));

// ---- activity log (paged) ----
const GROUPS = { water: ['water_auto', 'water_manual'], cover: ['shade_close', 'shade_open'], skipped: ['water_skipped'] };
const EventsQ = z.object({ group: z.enum(['all', 'water', 'cover', 'skipped']).catch('all'), limit: z.coerce.number().int().min(1).max(50).catch(25), before: z.coerce.number().int().positive().optional().catch(undefined) });
r.get('/events', wrap(async (req, res) => {
  const q = EventsQ.parse(req.query);
  let b = db.from('events').select('id,type,source,detail,occurred_at').order('id', { ascending: false }).limit(q.limit);
  if (q.group !== 'all') b = b.in('type', GROUPS[q.group]);
  if (q.before) b = b.lt('id', q.before);
  const { data, error } = await b;
  if (error) return res.status(500).json({ error: 'db' });
  res.json({ events: data, next_before: data.length === q.limit ? data[data.length - 1].id : null });
}));

// ---- user logs: admins see everyone, viewers only themselves ----
const AuditQ = z.object({ limit: z.coerce.number().int().min(1).max(50).catch(25), before: z.coerce.number().int().positive().optional().catch(undefined) });
r.get('/audit', wrap(async (req, res) => {
  const q = AuditQ.parse(req.query);
  let b = db.from('audit_logs').select('id,created_at,actor_email,action,ip,user_agent,meta').order('id', { ascending: false }).limit(q.limit);
  if (req.user.role !== 'admin') b = b.eq('actor_id', req.user.id);
  if (q.before) b = b.lt('id', q.before);
  const { data, error } = await b;
  if (error) return res.status(500).json({ error: 'db' });
  res.json({ logs: data, scope: req.user.role === 'admin' ? 'all' : 'self', next_before: data.length === q.limit ? data[data.length - 1].id : null });
}));

export default r;
