import React, { useState } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Well, Button, T, Gap } from '../components/Clay';
import { LogoDisc } from '../components/Logo';
import { login } from '../api';
import { C, F } from '../theme';

const Field = props => (
  <Well radius={20} style={{ marginBottom: 12 }}>
    <TextInput {...props} placeholderTextColor={C.faint} style={{ fontFamily: F.semi, fontSize: 16, color: C.ink, paddingVertical: 14, paddingHorizontal: 16 }} />
  </Well>
);

export default function Login({ onDone }) {
  const ins = useSafeAreaInsets();
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const go = async () => {
    if (!email || !pw) return setErr('Enter your email and password.');
    setBusy(true); setErr('');
    try { onDone(await login(email, pw)); }
    catch (e) {
      setErr(e.status === 429 ? `Too many attempts. Try again in ${Math.ceil((e.data?.retry_in || 900) / 60)} min.`
        : e.status === 401 ? 'Email or password is wrong.' : e.message);
      setBusy(false);
    }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28, paddingTop: ins.top + 20 }}>
        <View style={{ alignItems: 'center', marginBottom: 34 }}>
          <LogoDisc size={96} />
          <Gap h={20} />
          <T s={32} f="black" c={C.matchaInk} style={{ letterSpacing: -0.8 }}>AgriSense</T>
          <T s={15} c={C.mute} f="reg">Sign in to check on your plants</T>
        </View>
        <Field value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="email" />
        <Field value={pw} onChangeText={setPw} placeholder="Password" secureTextEntry textContentType="password" autoComplete="password" onSubmitEditing={go} />
        {err ? <T s={13.5} c={C.bad} style={{ marginBottom: 12, marginLeft: 6 }}>{err}</T> : null}
        <Button label="Sign in" onPress={go} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
