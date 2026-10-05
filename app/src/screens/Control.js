import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Clay, T, Button, Toggle, Stepper, Pill, Screen, Header, Gap, Label, Divider } from '../components/Clay';
import { useApi } from '../hooks';
import { api } from '../api';
import { uuid, hourLabel, confirmAsk } from '../util';
import { C } from '../theme';

// stepping onto the other slot's hour jumps one further so the two times never match
const skip = (v, cur, other) => (v === other ? Math.min(23, Math.max(0, v + (v > cur ? 1 : -1))) : v);
const KEYS = ['auto_water', 'auto_shade', 'soil_dry_pct', 'hot_c', 'cool_c', 'pump_seconds', 'water_hour_1', 'water_hour_2', 'pump_ml_per_s'];

export default function Control({ active, user }) {
  const st = useApi('/api/status', { ms: 5000, active });
  const s = st.data, admin = user?.role === 'admin';
  const [draft, setDraft] = useState(null), [msg, setMsg] = useState(''), [busy, setBusy] = useState(null), [err, setErr] = useState('');
  useEffect(() => { if (s?.settings && !draft) setDraft(s.settings); }, [s]);

  const open = (s?.open || []).map(c => c.action);
  const dirty = draft && s && KEYS.some(k => draft[k] !== s.settings[k]);
  const up = (k, v) => setDraft(d => {
    const n = { ...d, [k]: v };
    if (k === 'hot_c' && n.cool_c > v - 1) n.cool_c = v - 1;
    return n;
  });

  const send = async action => {
    setBusy(action); setMsg('');
    try {
      const r = await api('/api/commands', { method: 'POST', body: { action, idem_key: uuid() } });
      setMsg(r.duplicate ? 'That is already queued.' : r.device_online === false ? 'Queued, but the device looks offline. It will run if it reconnects within 10 minutes.' : 'Sent. The device picks it up within about 30 seconds.');
      st.reload();
    } catch (e) { setMsg(e.status === 403 ? 'This account is view-only.' : e.message); }
    setBusy(null);
  };
  const water = () => confirmAsk('Water now?', `The pump will run for ${s?.settings?.pump_seconds ?? 30} seconds.`, 'Water', () => send('water'));

  const save = async () => {
    setBusy('save'); setErr('');
    try { const r = await api('/api/settings', { method: 'PUT', body: Object.fromEntries(KEYS.map(k => [k, draft[k]])) }); setDraft(r); st.reload(); setMsg('Saved. The device applies it on its next check-in.'); }
    catch (e) { setErr(e.message); }
    setBusy(null);
  };

  const closed = s?.telemetry?.shade === 'closed';
  const D = draft;
  return (
    <Screen onRefresh={st.reload} refreshing={false}>
      <Header title="Control" sub={admin ? 'Run things now, or let it run itself' : 'View-only account'} />

      <Label>Right now</Label>
      <Clay radius={28} inner={{ padding: 16, gap: 12 }}>
        <Button label={open.includes('water') ? 'Waiting for device…' : 'Water now'} icon="drop" onPress={water} loading={busy === 'water'} disabled={!admin || open.includes('water')} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button style={{ flex: 1 }} kind="soft" icon="shade" label={open.includes('cover') ? 'Closing…' : 'Cover'} onPress={() => send('cover')} loading={busy === 'cover'} disabled={!admin || open.includes('cover') || closed} />
          <Button style={{ flex: 1 }} kind="soft" icon="sun" label={open.includes('uncover') ? 'Opening…' : 'Uncover'} onPress={() => send('uncover')} loading={busy === 'uncover'} disabled={!admin || open.includes('uncover') || s?.telemetry?.shade === 'open'} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T s={13} c={C.mute} f="reg" style={{ flex: 1 }}>{msg || 'Manual cover moves pause automatic shading for an hour.'}</T>
          {s ? <Pill label={s.online ? 'Device online' : 'Device offline'} tone={s.online ? 'ok' : 'bad'} /> : null}
        </View>
      </Clay>

      <Gap h={22} />
      <Label>Automation</Label>
      {D ? (
        <Clay radius={28} inner={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <T s={15} f="bold">Scheduled watering</T>
              <T s={12.5} c={C.mute} f="reg">Checks the soil at the two times below and only waters if dry.</T>
            </View>
            <Toggle value={D.auto_water} onChange={v => up('auto_water', v)} disabled={!admin} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <T s={15} f="bold">Automatic shade</T>
              <T s={12.5} c={C.mute} f="reg">Closes the cover when it stays hot, reopens when it cools.</T>
            </View>
            <Toggle value={D.auto_shade} onChange={v => up('auto_shade', v)} disabled={!admin} />
          </View>
          <Divider />
          <Stepper label="Water first at" value={D.water_hour_1} min={0} max={23} format={hourLabel} onChange={v => up('water_hour_1', skip(v, D.water_hour_1, D.water_hour_2))} disabled={!admin} />
          <Stepper label="Water again at" value={D.water_hour_2} min={0} max={23} format={hourLabel} onChange={v => up('water_hour_2', skip(v, D.water_hour_2, D.water_hour_1))} disabled={!admin} />
          <Stepper label="Soil counts as dry below" value={D.soil_dry_pct} unit="%" min={10} max={80} step={5} onChange={v => up('soil_dry_pct', v)} disabled={!admin} />
          <Stepper label="Pump runs for" hint="Hard limit 30 s" value={D.pump_seconds} unit=" s" min={5} max={30} step={5} onChange={v => up('pump_seconds', v)} disabled={!admin} />
          <Divider />
          <Stepper label="Close cover at" value={D.hot_c} unit="°C" min={30} max={45} onChange={v => up('hot_c', v)} disabled={!admin} />
          <Stepper label="Reopen at" value={D.cool_c} unit="°C" min={25} max={D.hot_c - 1} onChange={v => up('cool_c', v)} disabled={!admin} />
          <Divider />
          <Stepper label="Pump flow" hint="Only used for the litres estimate" value={D.pump_ml_per_s} unit=" ml/s" min={1} max={200} step={5} onChange={v => up('pump_ml_per_s', v)} disabled={!admin} />
          {err ? <T s={13} c={C.bad} style={{ marginTop: 8 }}>{err}</T> : null}
          {admin && dirty ? (
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              <Button style={{ flex: 1 }} kind="soft" label="Undo" onPress={() => setDraft(s.settings)} />
              <Button style={{ flex: 2 }} label="Save changes" icon="check" onPress={save} loading={busy === 'save'} />
            </View>
          ) : null}
        </Clay>
      ) : <T c={C.mute}>{st.error ? st.error.message : 'Loading…'}</T>}
    </Screen>
  );
}
