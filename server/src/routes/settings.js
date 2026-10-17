import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { audit } from '../audit.js';
import { wrap } from '../util.js';
import { getSettings, SettingsBody, dropSettingsCache, publicSettings } from '../settings.js';

const r = Router();
r.get('/settings', wrap(async (req, res) => res.json(publicSettings(await getSettings(), req.user.role === 'admin'))));

r.put('/settings', requireAdmin, wrap(async (req, res) => {
  const p = SettingsBody.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const old = await getSettings();
  const changed = Object.fromEntries(Object.entries(p.data).filter(([k, v]) => JSON.stringify(old[k]) !== JSON.stringify(v)).map(([k, v]) => [k, { from: old[k], to: v }]));
  if (!Object.keys(changed).length) return res.json(old);
  const { error } = await db.from('settings').update({ ...p.data, updated_at: new Date().toISOString(), updated_by: req.user.id }).eq('id', 1);
  if (error) return res.status(500).json({ error: 'db' });
  dropSettingsCache();
  audit(req, 'settings_changed', 'sms_recipients' in changed ? { ...changed, sms_recipients: { from: old.sms_recipients.length, to: p.data.sms_recipients.length } } : changed);   // numbers stay out of the log
  res.json(await getSettings());
}));

export default r;
