import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { audit } from '../audit.js';
import { commandLimiter } from '../security.js';
import { wrap } from '../util.js';
import { expireCommands } from '../commands.js';
import { isOnline } from '../insights.js';

const r = Router();
const Body = z.object({ action: z.enum(['water', 'cover', 'uncover']), idem_key: z.string().min(8).max(64).regex(/^[\w-]+$/) });

r.post('/commands', requireAdmin, commandLimiter, wrap(async (req, res) => {
  const p = Body.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'bad request' });
  await expireCommands();
  const { data, error } = await db.from('commands')
    .upsert({ action: p.data.action, idem_key: p.data.idem_key, created_by: req.user.id }, { onConflict: 'idem_key', ignoreDuplicates: true })
    .select('id,action,status,created_at').maybeSingle();
  if (error?.code === '23505') return res.json({ ok: true, duplicate: true });     // an open command already exists
  if (error) return res.status(500).json({ error: 'db' });
  const { data: tel } = await db.from('telemetry').select('updated_at').eq('id', 1).maybeSingle();
  if (data) audit(req, 'command_created', { action: p.data.action });
  res.json({ ok: true, duplicate: !data, command: data, device_online: isOnline(tel) });
}));

export default r;
