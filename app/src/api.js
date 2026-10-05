import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

export const BASE = (process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || '').replace(/\/$/, '');
const KEY = 'agrisense.session';

export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data; }
}

let session = null;            // { access_token, refresh_token, expires_at, user }
let onLost = () => {};
let refreshing = null;

export const setOnAuthLost = fn => { onLost = fn; };
export const getSession = () => session;

export async function loadSession() {
  try { const raw = await SecureStore.getItemAsync(KEY); session = raw ? JSON.parse(raw) : null; } catch { session = null; }
  return session;
}
async function saveSession(s) {
  session = s;
  if (s) await SecureStore.setItemAsync(KEY, JSON.stringify(s), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  else await SecureStore.deleteItemAsync(KEY);
}

async function raw(path, { method = 'GET', body, token } = {}) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(BASE + path, {
      method, signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error || 'request failed', data);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, e.name === 'AbortError' ? 'The server took too long to answer.' : 'Cannot reach the server.');
  } finally { clearTimeout(to); }
}

async function refresh() {
  if (!session?.refresh_token) return false;
  refreshing ||= raw('/api/auth/refresh', { method: 'POST', body: { refresh_token: session.refresh_token } })
    .then(async s => { await saveSession(s); return true; })
    .catch(async e => { if (e.status === 401 || e.status === 403) await saveSession(null); return false; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function api(path, opts = {}) {
  if (!session) throw new ApiError(401, 'signed out');
  try { return await raw(path, { ...opts, token: session.access_token }); }
  catch (e) {
    if (e.status !== 401) throw e;
    if (await refresh()) return raw(path, { ...opts, token: session.access_token });
    if (!session) onLost();          // refresh was refused for good; a network blip keeps the session
    throw e;
  }
}

export async function login(email, password) {
  const s = await raw('/api/auth/login', { method: 'POST', body: { email: email.trim(), password } });
  await saveSession(s); return s.user;
}
export async function logout() {
  try { if (session) await raw('/api/auth/logout', { method: 'POST', token: session.access_token }); } catch {}
  await saveSession(null);
}
export const me = () => api('/api/auth/me');
