import { createClient } from '@supabase/supabase-js';
import { cfg } from './config.js';

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

// Service-role client: full DB access. Never used to sign users in (that would
// swap its credentials for the user's token).
export const db = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_KEY, opts);

// A fresh anon client per sign-in so one user's session can never leak into another request.
export const anonClient = () => createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, opts);
