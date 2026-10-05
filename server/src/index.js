import express from 'express';
import { cfg } from './config.js';
import { db } from './db.js';
import { securityHeaders, requireHttps, noStore, globalLimiter, deviceLimiter } from './security.js';
import { requireUser } from './auth.js';
import { deviceAuth } from './deviceAuth.js';
import authRoutes from './routes/auth.js';
import statusRoutes from './routes/status.js';
import commandRoutes from './routes/commands.js';
import dataRoutes from './routes/data.js';
import settingsRoutes from './routes/settings.js';
import deviceRoutes from './routes/device.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);                       // one proxy hop (Render) so req.ip is the real client
// No CORS on purpose: the mobile app is not a browser, so no web origin gets cross-site access.

app.use(securityHeaders, noStore, requireHttps);
app.get('/healthz', (_q, res) => res.json({ ok: true }));
app.use(globalLimiter);
app.use(express.json({ limit: '16kb', strict: true, verify: (req, _res, buf) => { req.rawBody = buf; } }));

app.use((req, res, next) => {                    // one line per request, no bodies, no tokens
  const t0 = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.baseUrl}${req.path} ${res.statusCode} ${Date.now() - t0}ms`));
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/device', deviceLimiter, deviceAuth, deviceRoutes);
app.use('/api', requireUser, statusRoutes, commandRoutes, dataRoutes, settingsRoutes);

app.use((_q, res) => res.status(404).json({ error: 'not found' }));
app.use((err, _q, res, _n) => {
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') return res.status(400).json({ error: 'bad request' });
  console.error('unhandled', err?.message);   // message only, never request data
  res.status(500).json({ error: 'server error' });
});

// ---- data retention ----
const ago = d => new Date(Date.now() - d * 864e5).toISOString();
async function purge() {
  try {
    await db.from('readings').delete().lt('recorded_at', ago(90));
    await db.from('commands').delete().lt('created_at', ago(90)).not('status', 'in', '(pending,sent)');
    await db.from('audit_logs').delete().lt('created_at', ago(365));
  } catch (e) { console.error('purge failed', e?.message); }
}
setInterval(purge, 6 * 3600_000).unref();
purge();

const server = app.listen(cfg.PORT, () => console.log(`agrisense api up on ${cfg.PORT}`));
server.requestTimeout = 20_000; server.headersTimeout = 15_000;
process.on('SIGTERM', () => server.close(() => process.exit(0)));
