import React, { useRef, useState } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, Gap } from '../components/Clay';
import { Wordmark } from '../components/Logo';
import Icon from '../components/Icon';
import LoginVideo from '../components/LoginVideo';
import Constants from 'expo-constants';
import Turnstile from '../components/Turnstile';
import { login, BASE } from '../api';
import { C, F } from '../theme';

const web = Platform.OS === 'web';
const extra = Constants.expoConfig?.extra || {};
// A site key is public by design (it ships in every page that shows the widget). The secret key lives only on the server.
const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || extra.turnstileSiteKey || '0x4AAAAAAFPyh2X1GS8e-smM';
const CAPTCHA_BASE = process.env.EXPO_PUBLIC_TURNSTILE_BASE_URL || extra.turnstileBaseUrl || BASE;

function Field({ label, right, inputRef, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <T s={12.5} f="bold" c={C.mute} style={{ marginBottom: 6, marginLeft: 2 }}>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: focus ? C.matchaFlat : 'rgba(88,112,58,0.22)' }}>
        <TextInput ref={inputRef} {...props} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} placeholderTextColor={C.faint}
          style={[{ flex: 1, minWidth: 0, fontFamily: F.semi, fontSize: 16, color: C.ink, paddingVertical: 14, paddingHorizontal: 14 }, web && { outlineStyle: 'none' }]} />
        {right}
      </View>
    </View>
  );
}

export default function Login({ onDone }) {
  const ins = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const split = width >= 900;
  const pwRef = useRef(null), cap = useRef(null);
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [show, setShow] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState('');

  const go = async () => {
    if (busy) return;
    if (!email || !pw) return setErr('Enter your email and password.');
    if (!token) return setErr('Complete the security check first.');
    setBusy(true); setErr('');
    try { onDone(await login(email, pw, token)); }
    catch (e) {
      cap.current?.reset();                              // a token only works once
      setErr(e.data?.code === 'captcha' ? 'The security check failed. Please try it again.'
        : e.data?.code === 'captcha_unavailable' ? 'The security check is unavailable right now. Try again in a moment.'
        : e.status === 429 ? `Too many attempts. Try again in ${Math.ceil((e.data?.retry_in || 900) / 60)} min.`
        : e.status === 401 ? 'Email or password is wrong.' : e.message);
      setBusy(false);
    }
  };

  const form = (
    <View style={{ width: '100%', maxWidth: 400, backgroundColor: 'rgba(250,252,244,0.94)', borderRadius: 22, padding: width < 380 ? 20 : 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', ...(web ? { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', boxShadow: '0 18px 50px rgba(20,32,10,0.28)' } : { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 }) }}>
      {!split ? <View style={{ marginBottom: 22 }}><Wordmark size={22} /></View> : null}
      <T s={24} f="black" c={C.matchaInk} style={{ letterSpacing: -0.5 }}>Welcome back</T>
      <T s={14.5} c={C.mute} f="reg" style={{ marginTop: 4, marginBottom: 22 }}>Sign in to see how the garden is doing.</T>

      <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false}
        keyboardType="email-address" textContentType="username" autoComplete="email" returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()} />
      <Field label="Password" inputRef={pwRef} value={pw} onChangeText={setPw} placeholder="Your password" secureTextEntry={!show}
        textContentType="password" autoComplete="password" returnKeyType="go" onSubmitEditing={go}
        right={<Pressable onPress={() => setShow(s => !s)} hitSlop={8} accessibilityLabel={show ? 'Hide password' : 'Show password'} style={{ paddingHorizontal: 14, cursor: 'pointer' }}><Icon name={show ? 'eyeoff' : 'eye'} size={20} color={C.mute} /></Pressable>} />

      {SITE_KEY ? <Turnstile ref={cap} siteKey={SITE_KEY} onToken={setToken} baseUrl={CAPTCHA_BASE} /> : null}

      {err ? (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: C.bad + '16', borderRadius: 12, padding: 10, marginBottom: 14 }}>
          <Icon name="alert" size={17} color={C.bad} /><T s={13.5} c={C.bad} style={{ flex: 1 }}>{err}</T>
        </View>
      ) : null}

      <Pressable onPress={go} disabled={busy || !token} style={({ pressed }) => ({ opacity: busy ? 0.7 : !token ? 0.55 : pressed ? 0.88 : 1, cursor: token ? 'pointer' : 'default' })}>
        <LinearGradient colors={C.matcha} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}>
          <T s={16} f="bold" c="#fff">{busy ? 'Signing in…' : !token ? 'Verifying you\'re human…' : 'Sign in'}</T>
        </LinearGradient>
      </Pressable>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#2C3A1E' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LoginVideo />
      {/* tint + darker edges keep text readable over any footage */}
      <LinearGradient pointerEvents="none" colors={['rgba(24,38,14,0.55)', 'rgba(24,38,14,0.35)', 'rgba(24,38,14,0.72)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, minHeight: height, paddingTop: ins.top + 24, paddingBottom: ins.bottom + 24, paddingHorizontal: split ? 56 : 20 }}>
        {split ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 48 }}>
            <View style={{ flex: 1, maxWidth: 520, alignSelf: 'stretch', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Wordmark size={24} light />
              <View>
                <T s={44} f="black" c="#fff" style={{ letterSpacing: -1.4, lineHeight: 48 }}>Water, shade and soil, looked after.</T>
                <T s={17} c="rgba(255,255,255,0.82)" f="reg" style={{ marginTop: 14, lineHeight: 25, maxWidth: 440 }}>Live readings from your garden, and control over the pump and cover from wherever you are.</T>
              </View>
              <T s={13} c="rgba(255,255,255,0.6)" f="reg">AgriSense</T>
            </View>
            {form}
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{form}</View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
