import { db } from './db.js';
import { clip } from './util.js';

// Fire-and-forget: a logging failure must never break a request.
export function audit(req, action, meta = {}, actor = req.user) {
  db.from('audit_logs').insert({
    actor_id: actor?.id ?? null,
    actor_email: clip(actor?.email ?? meta.email ?? '', 254) || null,
    action,
    ip: clip(req.ip, 64),
    user_agent: clip(req.headers['user-agent'], 200),
    meta,
  }).then(({ error }) => { if (error) console.error('audit insert failed'); });
}
