import { Router } from 'express';
import { z } from 'zod';
import { anonClient, db } from '../db.js';
import { roleOf, requireUser, bearer, forgetToken } from '../auth.js';
import { audit } from '../audit.js';
import { loginLimiter } from '../security.js';
import { Throttle, wrap } from '../util.js';
import { verifyTurnstile } from '../turnstile.js';

const r = Router();
const perIpEmail = new Throttle(5, 15 * 60_000, 15 * 60_000);   // 5 misses from one place
const perEmail = new Throttle(20, 15 * 60_000, 15 * 60_000);    // 20 misses from anywhere
const Login = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200), captcha: z.string().min(10).max(2048).optional() });
const Refresh = z.object({ refresh_token: z.string().min(10).max(2000) });
const out = (s, role) => ({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, user: { email: s.user.email, role } });

r.post('/login', loginLimiter, wrap(async (req, res) => {
  const p = Login.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'bad request' });
  const email = p.data.email.toLowerCase(), k1 = `${req.ip}|${email}`;

  // Human check first. A failed captcha does not count toward the password lockout, so bots can't lock the owner out.
  if (!p.data.captcha) return res.status(400).json({ error: 'captcha required', code: 'captcha' });
  const cap = await verifyTurnstile(p.data.captcha, req.ip);
  if (!cap.ok) {
    audit(req, 'captcha_failed', { email, why: cap.reason, codes: cap.codes }, { email });
    return cap.reason === 'unavailable'
      ? res.status(503).json({ error: 'could not run the security check, try again', code: 'captcha_unavailable' })
      : res.status(400).json({ error: 'security check failed', code: 'captcha' });
  }

  const wait = Math.max(perIpEmail.locked(k1), perEmail.locked(email));
  if (wait) { audit(req, 'login_locked', { email }, { email }); return res.status(429).json({ error: 'too many attempts', retry_in: wait }); }

  let session = null;
  if (roleOf(email)) {                                  // unknown emails never reach Supabase
    const { data, error } = await anonClient().auth.signInWithPassword({ email, password: p.data.password });
    if (!error && data?.session) session = data.session;
  }
  if (!session) {
    perIpEmail.fail(k1); perEmail.fail(email);
    audit(req, 'login_failed', { email }, { email });
    return res.status(401).json({ error: 'invalid email or password' });   // same answer for every failure
  }
  perIpEmail.clear(k1); perEmail.clear(email);
  audit(req, 'login_ok', {}, { id: session.user.id, email });
  res.json(out(session, roleOf(email)));
}));

r.post('/refresh', loginLimiter, wrap(async (req, res) => {
  const p = Refresh.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'bad request' });
  const { data, error } = await anonClient().auth.refreshSession({ refresh_token: p.data.refresh_token });
  const role = roleOf(data?.session?.user?.email);
  if (error || !data?.session || !role) return res.status(401).json({ error: 'unauthorized' });
  res.json(out(data.session, role));
}));

r.get('/me', requireUser, (req, res) => res.json({ email: req.user.email, role: req.user.role }));

r.post('/logout', requireUser, wrap(async (req, res) => {
  const t = bearer(req);
  audit(req, 'logout');
  forgetToken(t);
  try { await db.auth.admin.signOut(t); } catch { /* token already invalid */ }
  res.json({ ok: true });
}));

export default r;
