import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { T } from './Clay';
import { C } from '../theme';

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading = null;
const loadScript = () => loading ||= new Promise((ok, fail) => {
  if (window.turnstile) return ok(window.turnstile);
  const s = document.createElement('script');
  s.src = SRC; s.async = true; s.defer = true;
  s.onload = () => ok(window.turnstile);
  s.onerror = () => { loading = null; fail(new Error('load')); };
  document.head.appendChild(s);
});

// Cloudflare Turnstile widget. Calls onToken(token) when solved, onToken(null) when it expires or fails.
// ref.reset() gets a fresh challenge (a token works once, so call it after any failed sign-in).
const Turnstile = forwardRef(function Turnstile({ siteKey, onToken, action = 'login' }, ref) {
  const box = useRef(null), id = useRef(null), cb = useRef(onToken);
  const [failed, setFailed] = useState(false);
  cb.current = onToken;
  useImperativeHandle(ref, () => ({ reset: () => { cb.current(null); try { id.current != null && window.turnstile.reset(id.current); } catch {} } }), []);

  useEffect(() => {
    let dead = false;
    loadScript().then(ts => {
      if (dead || !box.current) return;
      id.current = ts.render(box.current, {
        sitekey: siteKey, action, theme: 'light', size: 'flexible', retry: 'auto', 'refresh-expired': 'auto',
        callback: t => { setFailed(false); cb.current(t); },
        'expired-callback': () => cb.current(null),
        'timeout-callback': () => cb.current(null),
        'error-callback': () => { setFailed(true); cb.current(null); },
      });
    }).catch(() => setFailed(true));
    return () => { dead = true; try { id.current != null && window.turnstile.remove(id.current); } catch {} id.current = null; };
  }, [siteKey]);

  return (
    <View style={{ marginBottom: 14, minHeight: 65 }}>
      {React.createElement('div', { ref: box, style: { width: '100%' } })}
      {failed ? <T s={12.5} c={C.bad} style={{ marginTop: 6 }}>The security check could not load. Check your connection or disable content blockers, then reload.</T> : null}
    </View>
  );
});
export default Turnstile;
