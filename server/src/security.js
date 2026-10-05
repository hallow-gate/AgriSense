import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { isProd } from './config.js';

export const securityHeaders = helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
});

// TLS only. Render terminates TLS and sets x-forwarded-proto.
export function requireHttps(req, res, next) {
  if (!isProd || req.path === '/healthz') return next();
  if (req.headers['x-forwarded-proto'] !== 'https') return res.status(426).json({ error: 'https required' });
  next();
}

export const noStore = (_q, res, next) => { res.set('Cache-Control', 'no-store'); next(); };

const limiter = (windowMs, limit) => rateLimit({
  windowMs, limit, standardHeaders: true, legacyHeaders: false,
  message: { error: 'too many requests' },
});
export const globalLimiter = limiter(60_000, 240);
export const loginLimiter = limiter(15 * 60_000, 20);
export const commandLimiter = limiter(60_000, 20);
export const deviceLimiter = limiter(60_000, 60);
