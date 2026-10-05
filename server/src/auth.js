import { db } from './db.js';
import { cfg } from './config.js';
import { sha256hex } from './util.js';

export const roleOf = email => {
  const e = String(email || '').toLowerCase();
  if (cfg.ADMIN_EMAILS.includes(e)) return 'admin';
  if (cfg.VIEWER_EMAILS.includes(e)) return 'viewer';
  return null;
};

// Short cache so polling screens don't hit Supabase Auth on every request.
const cache = new Map();
export const forgetToken = t => cache.delete(sha256hex(t));
export const bearer = req => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') && h.length < 4096 ? h.slice(7) : '';
};

export async function requireUser(req, res, next) {
  try {
    const token = bearer(req);
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    const key = sha256hex(token), hit = cache.get(key);
    if (hit && hit.exp > Date.now()) { req.user = hit.user; return next(); }
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user?.email) return res.status(401).json({ error: 'unauthorized' });
    const role = roleOf(data.user.email);
    if (!role) return res.status(403).json({ error: 'forbidden' });
    const user = { id: data.user.id, email: data.user.email.toLowerCase(), role };
    if (cache.size > 200) cache.clear();
    cache.set(key, { user, exp: Date.now() + 30_000 });
    req.user = user; next();
  } catch (e) { next(e); }
}

export const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'read-only account' });
