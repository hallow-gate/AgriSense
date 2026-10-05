import crypto from 'crypto';

export const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const sha256hex = s => crypto.createHash('sha256').update(s).digest('hex');
export const clip = (s, n) => String(s ?? '').slice(0, n);

// Tiny in-memory failure counter with lockout. Single-instance only (fine for one Render service).
export class Throttle {
  constructor(max, windowMs, lockMs) { this.max = max; this.windowMs = windowMs; this.lockMs = lockMs; this.m = new Map(); }
  locked(key) { const e = this.m.get(key); return e && e.until > Date.now() ? Math.ceil((e.until - Date.now()) / 1000) : 0; }
  fail(key) {
    const now = Date.now(); let e = this.m.get(key);
    if (!e || now - e.first > this.windowMs) e = { n: 0, first: now, until: 0 };
    e.n++; if (e.n >= this.max) { e.until = now + this.lockMs; e.n = 0; e.first = now; }
    this.m.set(key, e); this.prune();
  }
  clear(key) { this.m.delete(key); }
  prune() { if (this.m.size < 1000) return; const now = Date.now(); for (const [k, e] of this.m) if (e.until < now && now - e.first > this.windowMs) this.m.delete(k); }
}

// local calendar date (YYYY-MM-DD) in a given timezone
export const localDate = (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const localHM = (d, tz) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  return { h: +p.find(x => x.type === 'hour').value, m: +p.find(x => x.type === 'minute').value };
};
