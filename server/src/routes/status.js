import { Router } from 'express';
import { db } from '../db.js';
import { wrap } from '../util.js';
import { getSettings } from '../settings.js';
import { isOnline, vpd, nextWatering, buildAlerts } from '../insights.js';
import { expireCommands } from '../commands.js';

const r = Router();

r.get('/status', wrap(async (req, res) => {
  await expireCommands();
  const isAdmin = req.user.role === 'admin';
  const since = new Date(Date.now() - 864e5).toISOString();
  const [t, e, c, settings, f] = await Promise.all([
    db.from('telemetry').select('*').eq('id', 1).maybeSingle(),
    db.from('events').select('id,type,source,detail,occurred_at').order('id', { ascending: false }).limit(5),
    db.from('commands').select('action,status,created_at').in('status', ['pending', 'sent']),
    getSettings(),
    isAdmin ? db.from('audit_logs').select('id', { count: 'exact', head: true }).in('action', ['login_failed', 'login_locked']).gte('created_at', since) : { count: 0 },
  ]);
  const tel = t.data, online = isOnline(tel);
  res.json({
    now: new Date().toISOString(), role: req.user.role,
    telemetry: tel, online,
    vpd: vpd(tel?.temp_c, tel?.humidity),
    next_watering: nextWatering(settings),
    events: e.data || [], open: c.data || [],
    settings,
    alerts: buildAlerts({ tel, settings, online, failedSignins: f.count || 0, isAdmin }),
  });
}));

export default r;
