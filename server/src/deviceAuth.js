import crypto from 'crypto';
import { cfg } from './config.js';
import { audit } from './audit.js';

/*
  Device requests are signed, not just keyed:
    x-device-id  fixed id
    x-ts         unix seconds (must be within 5 min of server clock)
    x-nonce      32 hex chars, single use
    x-sig        hex HMAC-SHA256(DEVICE_SECRET, `${ts}.${nonce}.${rawBody}`)
  The secret itself never travels. Responses are signed the same way with the
  request's ts+nonce, so the ESP32 can reject forged or replayed commands.
*/
const SKEW = 300;
const seen = new Map();                       // nonce -> expiry
setInterval(() => { const n = Date.now(); for (const [k, v] of seen) if (v < n) seen.delete(k); }, 60_000).unref();

const hmac = (...parts) => {
  const h = crypto.createHmac('sha256', cfg.DEVICE_SECRET);
  for (const p of parts) h.update(p);
  return h.digest('hex');
};
let lastAuditAt = 0;
const deny = (req, res, why) => {
  if (Date.now() - lastAuditAt > 60_000) { lastAuditAt = Date.now(); audit(req, 'device_auth_failed', { why }, { email: 'device' }); }
  return res.status(401).json({ error: 'unauthorized' });
};

export function deviceAuth(req, res, next) {
  const id = req.headers['x-device-id'], ts = req.headers['x-ts'], nonce = req.headers['x-nonce'], sig = req.headers['x-sig'];
  if (typeof id !== 'string' || typeof ts !== 'string' || typeof nonce !== 'string' || typeof sig !== 'string') return deny(req, res, 'missing');
  if (id !== cfg.DEVICE_ID) return deny(req, res, 'id');
  if (!/^\d{10}$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > SKEW) return deny(req, res, 'clock');
  if (!/^[0-9a-f]{32}$/.test(nonce) || !/^[0-9a-f]{64}$/.test(sig)) return deny(req, res, 'format');
  const raw = req.rawBody ?? Buffer.alloc(0);
  const want = Buffer.from(hmac(`${ts}.${nonce}.`, raw), 'hex');
  if (!crypto.timingSafeEqual(want, Buffer.from(sig, 'hex'))) return deny(req, res, 'sig');
  if (seen.has(nonce)) return deny(req, res, 'replay');
  seen.set(nonce, Date.now() + (SKEW * 2 + 5) * 1000);
  res.signedJson = obj => {
    const body = JSON.stringify(obj);
    res.status(200).set({ 'Content-Type': 'application/json; charset=utf-8', 'x-sig': hmac(`${ts}.${nonce}.`, body) }).send(body);
  };
  next();
}
