import { cfg } from './config.js';

const URL_ = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Returns { ok: true } | { ok: false, reason }.  reason: 'rejected' (bad/used/expired token) | 'unavailable' (Cloudflare unreachable).
// Fails closed: if the check can't be completed, nobody gets in.
export async function verifyTurnstile(token, ip) {
  if (!cfg.TURNSTILE_SECRET) return { ok: true, skipped: true };       // only possible outside production (see config.js)
  try {
    const body = new URLSearchParams({ secret: cfg.TURNSTILE_SECRET, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch(URL_, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, reason: 'unavailable' };
    const d = await res.json();
    if (!d.success) return { ok: false, reason: 'rejected', codes: d['error-codes'] };
    if (d.action && d.action !== 'login') return { ok: false, reason: 'rejected', codes: ['action-mismatch'] };
    if (cfg.TURNSTILE_HOSTNAMES.length && !cfg.TURNSTILE_HOSTNAMES.includes(String(d.hostname || '').toLowerCase())) return { ok: false, reason: 'rejected', codes: ['hostname-mismatch'] };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
