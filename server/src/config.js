import { z } from 'zod';

const list = z.string().default('').transform(s => s.split(',').map(x => x.trim().toLowerCase()).filter(Boolean));

const Env = z.object({
  NODE_ENV: z.string().default('production'),
  PORT: z.coerce.number().int().default(3000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_KEY: z.string().min(20),
  DEVICE_ID: z.string().regex(/^[A-Za-z0-9_-]{3,32}$/),
  DEVICE_SECRET: z.string().min(32, 'DEVICE_SECRET must be at least 32 characters (openssl rand -hex 32)'),
  ADMIN_EMAILS: list,
  VIEWER_EMAILS: list,
  TIMEZONE: z.string().default('Asia/Manila'),
}).refine(e => e.ADMIN_EMAILS.length > 0, { message: 'ADMIN_EMAILS needs at least one email', path: ['ADMIN_EMAILS'] });

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  // print variable names only, never values
  for (const i of parsed.error.issues) console.error(`config error: ${i.path.join('.')}: ${i.message}`);
  process.exit(1);
}
try { new Intl.DateTimeFormat('en', { timeZone: parsed.data.TIMEZONE }); }
catch { console.error('config error: TIMEZONE is not a valid IANA zone'); process.exit(1); }

export const cfg = parsed.data;
export const isProd = cfg.NODE_ENV === 'production';
