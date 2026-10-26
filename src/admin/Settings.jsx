import { useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { SETTINGS_SCHEMA } from '../lib/data.js';
import { audit, useStore } from '../lib/store.jsx';
import { Toggle } from '../components.jsx';
import { TopBar } from './AdminApp.jsx';

const fmt = (f, v) => {
  if (f.type === 'toggle') return v ? 'on' : 'off';
  if (f.type === 'secret') return v ? `set, ends in …${String(v).slice(-4)}` : '(empty)';
  if (f.type === 'select') return f.options[v] ?? v;
  return v === '' || v == null ? '(empty)' : `${v}${f.unit ? ` ${f.unit}` : ''}`;
};

export default function Settings({ menu, onSignOut }) {
  const { state } = useStore();
  const { group } = useParams();
  const nav = useNavigate();
  const isSuper = state.staffSession.role === 'super_admin';
  const groups = SETTINGS_SCHEMA.filter((g) => isSuper || !g.superOnly);
  const g = groups.find((x) => x.key === group) || groups[0];

  return (
    <>
      <TopBar crumb="Administration › Settings" title={g.label} menu={menu} onSignOut={onSignOut}>
        {g.superOnly && <span className="st s-info"><Icon name="lock" />Super Admin only</span>}
      </TopBar>
      <div className="pad">
        <div className="setgrid">
          <div className="panel snav">
            {groups.map((x) => <NavLink key={x.key} to={`/admin/settings/${x.key}`} className={`it ${x.key === g.key ? 'active' : ''}`}><Icon name={x.icon} />{x.label}</NavLink>)}
            <div className="mini" style={{ padding: '10px 10px 4px' }}>Fares and departure times: <button type="button" style={{ color: 'var(--blue)', textDecoration: 'underline' }} onClick={() => nav('/admin/cms/routes')}>Routes, fares & schedules</button>. Seats and amenities: <button type="button" style={{ color: 'var(--blue)', textDecoration: 'underline' }} onClick={() => nav('/admin/cms/classes')}>Bus classes</button>.</div>
          </div>
          <GroupForm key={g.key} group={g} />
        </div>
      </div>
    </>
  );
}

function GroupForm({ group }) {
  const { state, update, toast } = useStore();
  const [draft, setDraft] = useState(() => structuredClone(state.settings[group.key]));
  const [shown, setShown] = useState({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.settings[group.key]);
  const set = (sec, key, v) => setDraft((d) => ({ ...d, [sec]: { ...d[sec], [key]: v } }));

  const save = () => {
    update((d) => {
      group.sections.forEach((sec) => {
        const before = d.settings[group.key][sec.key];
        const after = draft[sec.key];
        if (before.enabled !== after.enabled) audit(d, 'settings.updated', `${group.label} → ${sec.label}: switched ${after.enabled ? 'on' : 'off'}`, { severity: sec.key === 'maintenance' ? 'critical' : 'info' });
        sec.fields.forEach((f) => {
          if (JSON.stringify(before[f.key]) !== JSON.stringify(after[f.key])) audit(d, 'settings.updated', `${group.label} → ${sec.label} → ${f.label}: ${fmt(f, before[f.key])} → ${fmt(f, after[f.key])}`, { severity: group.key === 'security' ? 'warning' : 'info' });
        });
      });
      d.settings[group.key] = draft;
    });
    toast('Settings saved. They apply immediately.');
  };

  const test = (sec) => {
    const missing = (sec.test || []).filter((k) => !String(draft[sec.key][k] || '').trim());
    if (missing.length) { toast(`Enter ${missing.map((k) => sec.fields.find((f) => f.key === k).label.toLowerCase()).join(' and ')} first.`, 'err'); return; }
    update((d) => audit(d, 'integration.tested', `${sec.label}: test passed (simulated)`));
    toast(`${sec.label}: connection test passed (simulated in the prototype).${draft[sec.key].enabled ? '' : ' Switch it on to use it.'}`);
  };

  const input = (sec, f) => {
    const v = draft[sec.key][f.key];
    switch (f.type) {
      case 'number': return <div className="num"><input type="number" min={f.min} max={f.max} value={v} onChange={(e) => set(sec.key, f.key, Number(e.target.value))} aria-label={f.label} /><span>{f.unit}</span></div>;
      case 'toggle': return <Toggle on={v} onChange={(x) => set(sec.key, f.key, x)} label={f.label} />;
      case 'select': return <select className="select" value={v} onChange={(e) => set(sec.key, f.key, e.target.value)} aria-label={f.label}>{Object.entries(f.options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>;
      case 'textarea': return <textarea className="textarea" value={v} onChange={(e) => set(sec.key, f.key, e.target.value)} aria-label={f.label} />;
      case 'date': return <input className="input" type="date" value={v} onChange={(e) => set(sec.key, f.key, e.target.value)} aria-label={f.label} />;
      case 'time': return <input className="input" type="time" value={v} onChange={(e) => set(sec.key, f.key, e.target.value)} aria-label={f.label} />;
      case 'datetime': return <input className="input" type="datetime-local" value={v} onChange={(e) => set(sec.key, f.key, e.target.value)} aria-label={f.label} />;
      case 'secret': {
        const id = `${sec.key}.${f.key}`;
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input" type={shown[id] ? 'text' : 'password'} value={v} placeholder={f.placeholder || ''} onChange={(e) => set(sec.key, f.key, e.target.value)} aria-label={f.label} autoComplete="off" />
            <button type="button" className="btn-a b-ghost" onClick={() => setShown({ ...shown, [id]: !shown[id] })} aria-label="Show or hide"><Icon name="eye" /></button>
          </div>
        );
      }
      default: return <input className="input" value={v} maxLength={f.max} placeholder={f.placeholder || ''} onChange={(e) => set(sec.key, f.key, e.target.value)} aria-label={f.label} />;
    }
  };

  return (
    <div>
      <p className="mini" style={{ marginBottom: 12 }}>{group.description}</p>
      {group.sections.map((sec) => {
        const vals = draft[sec.key];
        return (
          <div className="sect" key={sec.key}>
            <div className="sect-h">
              <h3>{sec.label}</h3>
              {sec.required && <span className="st s-good"><Icon name="check" />Required · always on</span>}
              {sec.optional && (
                <>
                  {group.key === 'integrations' && <button type="button" className="btn-a b-ghost b-xs" onClick={() => test(sec)}><Icon name="activity" />Test</button>}
                  <span className={`st ${vals.enabled ? 's-good' : 's-mute'}`}>{vals.enabled ? 'On' : 'Off'}</span>
                  <Toggle on={vals.enabled} onChange={(x) => set(sec.key, 'enabled', x)} label={`Turn ${sec.label} on or off`} />
                </>
              )}
            </div>
            {sec.description && <p className="sect-d">{sec.description}</p>}
            {sec.key === 'lockout' && (
              <div className="lockflow">
                <div style={{ background: '#F6F8FC' }}><b>Wrong tries 1–{vals.maxAttempts - 1}</b><br />"{vals.maxAttempts - 1} attempt(s) left"</div><Icon name="right" />
                <div style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}><b>Wrong try {vals.maxAttempts}</b><br />locked {vals.lockMinutes} minutes</div><Icon name="right" />
                <div style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}><b>Lock no. {vals.flagAfterLocks} within {vals.flagWindowHours} h</b><br />flagged · hard lock</div>
              </div>
            )}
            {sec.fields.map((f) => (
              <div className={`srow ${f.type === 'textarea' ? 'wide' : ''}`} key={f.key}>
                <div><b>{f.label}</b>{f.desc && <span className="d">{f.desc}</span>}</div>
                {input(sec, f)}
              </div>
            ))}
          </div>
        );
      })}
      <div className="panel" style={{ display: 'flex', gap: 10, alignItems: 'center', position: 'sticky', bottom: 10 }}>
        <span className="mini" style={{ flex: 1 }}>{dirty ? 'You have unsaved changes.' : 'Every change is recorded in the audit log with the old and new value.'}</span>
        {dirty && <button type="button" className="btn-a b-ghost" onClick={() => setDraft(structuredClone(state.settings[group.key]))}>Discard</button>}
        <button type="button" className="btn-a b-navy" disabled={!dirty} onClick={save}>Save changes</button>
      </div>
    </div>
  );
}
