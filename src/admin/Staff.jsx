import { useState } from 'react';
import Icon from '../lib/icons.jsx';
import { DEMO_PASSWORD, ROLES } from '../lib/data.js';
import { audit, useStore } from '../lib/store.jsx';
import { canUnlock, lockState, minutesLeft } from '../lib/auth.js';
import { Modal } from '../components.jsx';
import { TopBar } from './AdminApp.jsx';

const ACCESS = {
  super_admin: 'Everything, including security settings, integrations, maintenance mode and unlocking Company Admins and other Super Admins.',
  company_admin: 'All modules and terminals; ticketing, fares, fleet, parcels and message settings. Cannot manage Super Admins.',
  terminal_manager: 'Own terminal(s): dispatch, bookings, counter, boarding, parcels, remittances, charters, reports; refunds and voids; unlocks lower staff of the terminal.',
  dispatcher: 'Dispatch board (assign buses and crew, delays, cancellations, extra trips), boarding, fleet status, crew, live map.',
  fleet_manager: 'Fleet: buses, documents, maintenance and work orders; crew records; live map; fleet reports.',
  ticketing: 'Ticket counter (sell, reserve, rebook), bookings, boarding and passenger look-up at the assigned terminal.',
  cashier: 'Counter sales, payments and conductor cash remittances; end-of-shift cash closing.',
  customer_service: 'Bookings (rebook, refund requests, resend tickets), passengers, parcels look-up, charter requests, inquiries.',
  parcel_clerk: 'Parcels: accept, weigh, load on a trip, release to the receiver.',
  content_editor: 'Website CMS and inquiries only.',
  conductor: 'Crew app: manifest of assigned trips, QR boarding, roadside tickets, trip status and GPS.',
  driver: 'Crew app: assigned trips, pre-trip checklist, incident reports.',
};

export default function Staff({ menu, onSignOut }) {
  const { state, update, toast } = useStore();
  const me = state.accounts.find((a) => a.email === state.staffSession.email);
  const [unlock, setUnlock] = useState(null);
  const [reason, setReason] = useState('');
  const [invite, setInvite] = useState(null);

  const doUnlock = () => {
    update((d) => {
      const x = d.accounts.find((y) => y.id === unlock.id);
      const was = lockState(x);
      Object.assign(x, { status: 'active', failed: 0, lastFailedAt: null, lockedUntil: null, lockCount: 0, flaggedAt: null });
      audit(d, 'auth.account.unlocked', `${x.email} unlocked (${was}). Reason: ${reason}`, { severity: 'critical' });
    });
    toast(`${unlock.name} unlocked.`);
    setUnlock(null); setReason('');
  };

  return (
    <>
      <TopBar crumb="Administration" title="Staff & roles" menu={menu} onSignOut={onSignOut}>
        {ROLES[me.role].rank >= 90 && <button type="button" className="btn-a b-navy" onClick={() => setInvite({ name: '', email: '', role: 'ticketing', branches: ['cubao'] })}><Icon name="plus" />Add staff</button>}
      </TopBar>
      <div className="pad">
        <div className="panel">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Terminals</th><th>Sign-in status</th><th>Last sign-in</th><th /></tr></thead>
              <tbody>
                {state.accounts.map((a) => {
                  const ls = lockState(a);
                  const allowed = canUnlock(me, a);
                  return (
                    <tr key={a.id}>
                      <td><b>{a.name}</b>{a.id === me.id && <span className="mini"> (you)</span>}</td>
                      <td>{a.email}</td>
                      <td>{ROLES[a.role].label}</td>
                      <td>{a.branches === 'all' ? 'All' : a.branches.map((b) => state.terminals.find((x) => x.id === b)?.name).join(', ')}</td>
                      <td>
                        {ls === 'active' && (a.failed ? <span className="st s-warn"><Icon name="alert" />{a.failed} failed attempt(s)</span> : <span className="st s-good"><Icon name="check" />Active</span>)}
                        {ls === 'locked' && <span className="st s-warn"><Icon name="lock" />Locked · {minutesLeft(a)} min left</span>}
                        {ls === 'flagged' && <span className="st s-bad"><Icon name="shield" />Flagged (suspicious)</span>}
                      </td>
                      <td className="mini">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('en-PH') : 'Never'}</td>
                      <td>{ls !== 'active' && (allowed
                        ? <button type="button" className="btn-a b-navy b-xs" onClick={() => setUnlock(a)}><Icon name="unlock" />Unlock</button>
                        : <span className="mini" title="Only a higher-ranking officer can unlock this account.">Needs a higher rank</span>)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mini" style={{ marginTop: 10 }}>Unlocking follows rank: nobody unlocks their own account; Terminal Managers unlock lower staff of their terminal; Company Admins unlock everyone below them; only a Super Admin unlocks a Company Admin or another Super Admin. A reason is required and kept in the audit log.</p>
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="ph-row"><h3>Roles</h3><span className="sub">Starting list; in the real system the Super Admin can rename roles and tick permissions per module.</span></div>
          <table className="tbl">
            <thead><tr><th>Role</th><th>Rank</th><th>Access</th></tr></thead>
            <tbody>{Object.entries(ROLES).map(([k, r]) => <tr key={k}><td><b>{r.label}</b></td><td>{r.rank}</td><td>{ACCESS[k]}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      {unlock && (
        <Modal title={`Unlock ${unlock.name}`} onClose={() => setUnlock(null)}
          footer={<><button type="button" className="btn-a b-ghost" onClick={() => setUnlock(null)}>Cancel</button><button type="button" className="btn-a b-navy" disabled={reason.trim().length < 5} onClick={doUnlock}><Icon name="unlock" />Unlock</button></>}>
          <p style={{ marginBottom: 12 }}>{lockState(unlock) === 'flagged' ? 'This account was flagged for repeated failed sign-ins. Confirm with the staff member that it was them before unlocking.' : 'This account is temporarily locked after failed sign-ins.'}</p>
          <label className="field"><span>Reason (required, kept in the audit log)</span><textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Confirmed by phone that the staff member forgot the password." /></label>
        </Modal>
      )}
      {invite && (
        <Modal title="Add staff" onClose={() => setInvite(null)}
          footer={<><button type="button" className="btn-a b-ghost" onClick={() => setInvite(null)}>Cancel</button><button type="button" className="btn-a b-navy" disabled={!invite.name.trim() || !/@/.test(invite.email) || state.accounts.some((a) => a.email === invite.email)} onClick={() => {
            update((d) => {
              d.accounts.push({ id: Date.now(), ...invite, branches: ROLES[invite.role].rank >= 90 ? 'all' : invite.branches, password: DEMO_PASSWORD, status: 'active', failed: 0, lastFailedAt: null, lockedUntil: null, lockCount: 0, lastLockAt: null, flaggedAt: null, lastLoginAt: null });
              audit(d, 'staff.created', `Staff ${invite.email} added as ${ROLES[invite.role].label}`, { severity: 'warning' });
            });
            toast(`Invitation sent to ${invite.email} (simulated). In this prototype the password is ${DEMO_PASSWORD}.`); setInvite(null);
          }}>Add</button></>}>
          <label className="field"><span>Name</span><input className="input" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} /></label>
          <label className="field"><span>Work email</span><input className="input" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value.trim() })} /></label>
          <label className="field"><span>Role</span><select className="select" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>{Object.entries(ROLES).filter(([, r]) => r.rank < ROLES[me.role].rank || me.role === 'super_admin').map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select></label>
          <span className="label">Terminals</span>
          <div className="chips">{state.terminals.filter((t) => t.hub).map((b) => <button type="button" key={b.id} className={`chip ${invite.branches.includes(b.id) ? 'on' : ''}`} onClick={() => setInvite({ ...invite, branches: invite.branches.includes(b.id) ? invite.branches.filter((x) => x !== b.id) : [...invite.branches, b.id] })}>{b.name}</button>)}</div>
          <p className="hint">The new staff member receives a "set your password" link and sets up the authenticator app at first sign-in.</p>
        </Modal>
      )}
    </>
  );
}
