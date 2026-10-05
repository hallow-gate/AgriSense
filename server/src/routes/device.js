import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { wrap } from '../util.js';
import { getSettings, deviceConfig } from '../settings.js';
import { expireCommands } from '../commands.js';

const r = Router();
const TYPES = ['water_auto', 'water_manual', 'water_skipped', 'shade_close', 'shade_open'];
const SOURCES = ['schedule', 'manual', 'auto_heat'];

const Telemetry = z.object({
  temp_c: z.number().min(-40).max(85).nullish(), humidity: z.number().min(0).max(100).nullish(),
  soil_pct: z.number().int().min(0).max(100).nullish(), soil_fault: z.boolean().optional(),
  shade: z.enum(['open', 'closed']), pump: z.boolean(),
  rssi: z.number().int().min(-120).max(0).nullish(), uptime_s: z.number().int().min(0).nullish(),
  heap: z.number().int().min(0).nullish(), boots: z.number().int().min(0).nullish(), fw: z.string().max(16).nullish(),
});
const Event = z.object({
  event_id: z.string().min(1).max(80).regex(/^[\w.:-]+$/),
  type: z.enum(TYPES), source: z.enum(SOURCES), ts: z.number().optional(),
  command_id: z.string().uuid().nullish(), detail: z.record(z.any()).default({}),
});
const Body = z.object({ telemetry: Telemetry.optional(), events: z.array(z.any()).max(20).default([]) });

let lastReading = 0;
const READING_EVERY_MS = 5 * 60_000;

r.post('/sync', wrap(async (req, res) => {
  const p = Body.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'bad request' });
  const { telemetry: t } = p.data;
  const now = Date.now();

  if (t) {
    await db.from('telemetry').upsert({
      id: 1, temp_c: t.temp_c ?? null, humidity: t.humidity ?? null, soil_pct: t.soil_fault ? null : (t.soil_pct ?? null),
      soil_fault: !!t.soil_fault, shade: t.shade, pump: t.pump, rssi: t.rssi ?? null, uptime_s: t.uptime_s ?? null,
      heap: t.heap ?? null, boots: t.boots ?? null, fw: t.fw ?? null, updated_at: new Date(now).toISOString(),
    });
    if (now - lastReading >= READING_EVERY_MS && (t.temp_c != null || t.soil_pct != null)) {
      lastReading = now;
      await db.from('readings').insert({ temp_c: t.temp_c ?? null, humidity: t.humidity ?? null, soil_pct: t.soil_fault ? null : (t.soil_pct ?? null), shade: t.shade, pump: t.pump });
    }
  }

  // invalid events are dropped (never block the device's outbox forever)
  const rows = p.data.events.map(e => Event.safeParse(e)).filter(x => x.success).map(x => x.data).map(e => ({
    event_id: e.event_id, type: e.type, source: e.source, detail: e.detail, command_id: e.command_id ?? null,
    occurred_at: e.ts && e.ts > 1.7e9 && e.ts * 1000 <= now + 300_000 ? new Date(e.ts * 1000).toISOString() : new Date(now).toISOString(),
  }));
  if (rows.length) {
    const { error } = await db.from('events').upsert(rows, { onConflict: 'event_id', ignoreDuplicates: true });
    if (error) return res.status(500).json({ error: 'db' });         // device keeps its outbox and retries
    for (const e of rows) if (e.command_id)
      await db.from('commands').update({ status: e.detail?.result === 'ok' ? 'done' : 'failed', done_at: new Date().toISOString() })
        .eq('id', e.command_id).in('status', ['pending', 'sent']);
  }

  await expireCommands();
  const stale = new Date(now - 120_000).toISOString();
  const { data: cmds } = await db.from('commands').select('id,action')
    .or(`status.eq.pending,and(status.eq.sent,sent_at.lt.${stale})`).order('created_at').limit(3);
  if (cmds?.length) await db.from('commands').update({ status: 'sent', sent_at: new Date().toISOString() }).in('id', cmds.map(c => c.id));

  res.signedJson({ ok: true, commands: cmds || [], config: deviceConfig(await getSettings()) });
}));

export default r;
