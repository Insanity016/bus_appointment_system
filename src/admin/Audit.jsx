import { useState } from 'react';
import Icon from '../lib/icons.jsx';
import { useStore } from '../lib/store.jsx';
import { Empty } from '../components.jsx';
import { TopBar } from './AdminApp.jsx';

const SEV = { info: ['Info', 's-mute'], warning: ['Warning', 's-warn'], critical: ['Critical', 's-bad'] };

export default function Audit({ menu, onSignOut }) {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [sev, setSev] = useState('');
  const rows = state.audit.filter((e) => (!sev || e.severity === sev) && (!q || `${e.event} ${e.description} ${e.actor}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <TopBar crumb="Administration" title="Audit logs" menu={menu} onSignOut={onSignOut}>
        <label className="ctl"><Icon name="alert" /><select value={sev} onChange={(e) => setSev(e.target.value)} aria-label="Severity"><option value="">All severities</option>{Object.entries(SEV).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="ctl" style={{ minWidth: 240 }}><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events" style={{ width: '100%' }} /></label>
      </TopBar>
      <div className="pad">
        <div className="panel">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>When</th><th>Who</th><th>Event</th><th>What happened</th><th>Severity</th></tr></thead>
              <tbody>
                {rows.map((e, i) => (
                  <tr key={i}>
                    <td className="mini" style={{ whiteSpace: 'nowrap' }}>{new Date(e.at).toLocaleString('en-PH')}</td>
                    <td>{e.actor}</td>
                    <td><code style={{ fontSize: 11.5 }}>{e.event}</code></td>
                    <td>{e.description}</td>
                    <td><span className={`st ${SEV[e.severity][1]}`}>{SEV[e.severity][0]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <Empty icon="history">No events yet. Sign-ins, bookings, setting changes and CMS publishing appear here.</Empty>}
          </div>
          <p className="mini" style={{ marginTop: 10 }}>In the real system audit logs are never deleted and cannot be edited, even by a Super Admin. They also record the device and network address.</p>
        </div>
      </div>
    </>
  );
}
