import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { T } from './Clay';
import { C } from '../theme';

// Native build: the widget runs inside a tiny WebView. `baseUrl` must be a hostname that is allowed on the Turnstile widget
// (Cloudflare dashboard -> Turnstile -> your widget -> Hostnames).
const html = (siteKey, action) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;background:transparent;overflow:hidden}#w{width:100%}</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script></head><body><div id="w"></div>
<script>
var post=function(o){window.ReactNativeWebView.postMessage(JSON.stringify(o))};
var id=null;
function boot(){ if(!window.turnstile){return setTimeout(boot,150)}
  id=turnstile.render('#w',{sitekey:${JSON.stringify(siteKey)},action:${JSON.stringify(action)},theme:'light',size:'flexible',retry:'auto','refresh-expired':'auto',
   callback:function(t){post({t:t})},'expired-callback':function(){post({t:null})},'timeout-callback':function(){post({t:null})},'error-callback':function(){post({t:null,error:1})}});}
boot();
window.resetWidget=function(){try{turnstile.reset(id)}catch(e){}};
</script></body></html>`;

const Turnstile = forwardRef(function Turnstile({ siteKey, onToken, baseUrl, action = 'login' }, ref) {
  const web = useRef(null), [err, setErr] = useState(false);
  const src = useMemo(() => ({ html: html(siteKey, action), baseUrl }), [siteKey, action, baseUrl]);
  useImperativeHandle(ref, () => ({ reset: () => { onToken(null); web.current?.injectJavaScript('window.resetWidget&&window.resetWidget();true;'); } }), [onToken]);
  return (
    <View style={{ marginBottom: 14, height: 70 }}>
      <WebView ref={web} source={src} originWhitelist={['*']} javaScriptEnabled domStorageEnabled
        style={{ backgroundColor: 'transparent' }} scrollEnabled={false} overScrollMode="never"
        onMessage={e => { try { const m = JSON.parse(e.nativeEvent.data); setErr(!!m.error); onToken(m.t || null); } catch {} }}
        onError={() => setErr(true)} />
      {err ? <T s={12.5} c={C.bad}>The security check could not load.</T> : null}
    </View>
  );
});
export default Turnstile;
