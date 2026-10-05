import React, { useState } from 'react';
import { View } from 'react-native';
import { Clay, T, Segmented, Chip, Pill, Press, Screen, Header, Gap, Divider } from '../components/Clay';
import Icon from '../components/Icon';
import { useApi, usePaged } from '../hooks';
import { eventMeta, auditMeta, deviceName, stamp, ago, fmt } from '../util';
import { C } from '../theme';

const TONE_COL = { ok: C.matchaFlat, bad: C.bad, info: C.info, mute: C.faint, warn: C.warn };

function Row({ icon, tone, title, sub, right, rightSub }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: (TONE_COL[tone] || C.faint) + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={TONE_COL[tone] || C.faint} />
      </View>
      <View style={{ flex: 1 }}>
        <T s={14.5} f="bold">{title}</T>
        {sub ? <T s={12.5} c={C.mute} f="reg" numberOfLines={2}>{sub}</T> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {right ? <T s={12} c={C.mute} f="semi">{right}</T> : null}
        {rightSub ? <T s={11.5} c={C.faint} f="reg">{rightSub}</T> : null}
      </View>
    </View>
  );
}

function List({ children, empty, loading, error, more, onMore }) {
  const arr = React.Children.toArray(children);
  return (
    <Clay radius={26} inner={{ paddingVertical: 6, paddingHorizontal: 16 }}>
      {arr.length === 0
        ? <T s={14} c={C.mute} style={{ paddingVertical: 18, textAlign: 'center' }}>{loading ? 'Loading…' : error ? error.message : empty}</T>
        : arr.map((c, i) => <View key={i}>{i > 0 && <Divider />}{c}</View>)}
      {more ? <Press onPress={onMore}><T s={13.5} f="bold" c={C.matchaFlat} style={{ textAlign: 'center', paddingVertical: 12 }}>Load older</T></Press> : null}
    </Clay>
  );
}

function Activity({ active }) {
  const [group, setGroup] = useState('all');
  const p = usePaged(`/api/events?group=${group}`, 'events', active);
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['all', 'All'], ['water', 'Watering'], ['cover', 'Cover'], ['skipped', 'Skipped']].map(([k, l]) => <Chip key={k} label={l} on={group === k} onPress={() => setGroup(k)} />)}
      </View>
      <List empty="No activity yet." loading={p.loading} error={p.error} more={!!p.next} onMore={p.more}>
        {p.items.map(e => { const m = eventMeta(e); return <Row key={e.id} {...m} right={ago(e.occurred_at)} rightSub={stamp(e.occurred_at)} />; })}
      </List>
    </>
  );
}

function History({ active }) {
  const q = useApi('/api/stats?days=30', { active });
  const days = [...(q.data?.days || [])].reverse();
  return (
    <List empty="No history yet." loading={q.loading} error={q.error}>
      {days.map(d => {
        const dt = new Date(d.date + 'T12:00:00'), has = d.avg_temp != null || d.waterings || d.shade_moves;
        return (
          <View key={d.date} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: has ? 1 : 0.45 }}>
            <View style={{ width: 46, alignItems: 'center' }}>
              <T s={11} f="bold" c={C.mute}>{dt.toLocaleDateString([], { weekday: 'short' }).toUpperCase()}</T>
              <T s={20} f="black" c={C.matchaInk}>{dt.getDate()}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T s={14} f="bold">{d.avg_temp != null ? `${fmt(d.min_temp, '', 0)}–${fmt(d.max_temp, '°', 0)}, avg ${fmt(d.avg_temp, '°', 1)}` : 'No sensor data'}</T>
              <T s={12.5} c={C.mute} f="reg">{[d.avg_hum != null ? `humidity ${d.avg_hum}%` : null, d.avg_soil != null ? `soil ${d.avg_soil}%` : null].filter(Boolean).join(' · ') || ' '}</T>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              {d.waterings ? <Pill tone="info" dot={false} label={`${d.waterings}× · ${d.liters} L`} /> : d.skipped ? <Pill tone="mute" dot={false} label="skipped" /> : null}
              {d.shade_moves ? <T s={11.5} c={C.faint}>cover ×{d.shade_moves}</T> : null}
            </View>
          </View>
        );
      })}
    </List>
  );
}

function Users({ active, role }) {
  const p = usePaged('/api/audit', 'logs', active);
  return (
    <>
      <T s={13} c={C.mute} f="reg" style={{ marginBottom: 12 }}>{role === 'admin' ? 'Every sign-in, command and settings change, newest first.' : 'Your own sign-ins and actions.'}</T>
      <List empty="No entries yet." loading={p.loading} error={p.error} more={!!p.next} onMore={p.more}>
        {p.items.map(l => {
          const m = auditMeta(l);
          const sub = [role === 'admin' ? l.actor_email : null, m.sub, [l.ip, deviceName(l.user_agent)].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
          return <Row key={l.id} icon={m.icon} tone={m.tone} title={m.title} sub={sub} right={ago(l.created_at)} rightSub={stamp(l.created_at)} />;
        })}
      </List>
    </>
  );
}

export default function Logs({ active, user }) {
  const [tab, setTab] = useState('activity');
  const [nonce, setNonce] = useState(0);
  return (
    <Screen onRefresh={() => setNonce(n => n + 1)}>
      <Header title="Logs" sub="What the garden and its people have been up to" />
      <Segmented value={tab} onChange={setTab} options={[{ key: 'activity', label: 'Activity' }, { key: 'history', label: 'History' }, { key: 'users', label: user?.role === 'admin' ? 'Users' : 'My access' }]} />
      <Gap h={16} />
      {tab === 'activity' && <Activity key={'a' + nonce} active={active} />}
      {tab === 'history' && <History key={'h' + nonce} active={active} />}
      {tab === 'users' && <Users key={'u' + nonce} active={active} role={user?.role} />}
    </Screen>
  );
}
