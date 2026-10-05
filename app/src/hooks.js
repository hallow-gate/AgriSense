import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from './api';
import { usePolling } from './util';

// Fetch a path; optionally poll while `active`.
export function useApi(path, { ms, active = true } = {}) {
  const [s, set] = useState({ data: null, error: null, loading: true });
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const load = useCallback(async () => {
    try { const d = await api(path); alive.current && set({ data: d, error: null, loading: false }); }
    catch (e) { alive.current && set(p => ({ ...p, error: e, loading: false })); }
  }, [path]);
  usePolling(load, ms || 60000, active && !!ms);
  useEffect(() => { if (!ms && active) load(); }, [active, load, ms]);
  return { ...s, reload: load };
}

// Cursor-paged lists (events, audit logs).
export function usePaged(path, key, active) {
  const [st, set] = useState({ items: [], next: null, loading: true, error: null });
  const fetchPage = useCallback(async before => {
    const sep = path.includes('?') ? '&' : '?';
    return api(`${path}${sep}limit=20${before ? `&before=${before}` : ''}`);
  }, [path]);
  const reload = useCallback(async () => {
    set(p => ({ ...p, loading: true }));
    try { const d = await fetchPage(); set({ items: d[key], next: d.next_before, loading: false, error: null }); }
    catch (e) { set(p => ({ ...p, loading: false, error: e })); }
  }, [fetchPage, key]);
  const more = useCallback(async () => {
    if (!st.next) return;
    try { const d = await fetchPage(st.next); set(p => ({ ...p, items: [...p.items, ...d[key]], next: d.next_before })); } catch {}
  }, [fetchPage, key, st.next]);
  useEffect(() => { if (active) reload(); }, [active, reload]);
  return { ...st, reload, more };
}
