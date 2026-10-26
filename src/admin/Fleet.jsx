import { useState } from 'react';
import Icon from '../lib/icons.jsx';
import { addDays, ymd } from '../lib/data.js';
import { audit, setting, useStore } from '../lib/store.jsx';
import { busOf, clsOf, crewOf, getTrip, peso, tName, todayYmd, tripsOn } from '../lib/trips.js';
import { Empty, Modal } from '../components.jsx';
import { busProblem } from './Dispatch.jsx';
import { TopBar } from './AdminApp.jsx';

const WO_STATUS = { open: ['Open', 's-warn'], in_progress: ['In progress', 's-info'], done: ['Done', 's-good'] };

function DocBadge({ date }) {
  const { state } = useStore();
  const soon = ymd(addDays(new Date(), Number(setting(state, 'fleet.documents.warnDays'))));
  if (date < todayYmd()) return <span className="st s-bad">Expired {date}</span>;
  if (date <= soon) return <span className="st s-warn">{date}</span>;
  return <span className="mini">{date}</span>;
}

export function Fleet({ menu, onSignOut }) {
  const { state, update, toast } = useStore();
  const [tab, setTab] = useState('buses');
  const [cls, setCls] = useState('');
  const [flt, setFlt] = useState('');
  const [q, setQ] = useState('');
  const [wo, setWo] = useState(null);
  const pms = Number(setting(state, 'fleet.maintenance.pmsKm'));
  const warn = Number(setting(state, 'fleet.maintenance.warnKm'));
  const soon = ymd(addDays(new Date(), Number(setting(state, 'fleet.documents.warnDays'))));
  const issues = (b) => ({ pms: b.odometer - b.lastPmsKm >= pms - warn, docs: [b.regExpiry, b.cpcExpiry, b.insExpiry].some((d) => d <= soon) });
  const buses = state.buses.filter((b) => (!cls || b.cls === cls) && (!q || `${b.bodyNo} ${b.plate} ${b.model}`.toLowerCase().includes(q.toLowerCase()))
    && (!flt || (flt === 'pms' && issues(b).pms) || (flt === 'docs' && issues(b).docs) || (flt === 'shop' && b.status !== 'active')));

  const saveWo = () => {
    update((d) => {
      const n = d.workOrders.length + 1;
      d.workOrders.unshift({ id: Date.now(), no: `WO-${1200 + n}`, busId: wo.busId, type: wo.type, desc: wo.desc, opened: new Date().toISOString(), status: 'open', cost: 0, mechanic: wo.mechanic, notes: '' });
      d.buses.find((b) => b.id === wo.busId).status = 'maintenance';
      audit(d, 'fleet.workorder', `Work order for bus ${busOf(d, wo.busId).bodyNo}: ${wo.type} – ${wo.desc}`);
    });
    toast('Work order opened. The bus is taken off dispatch until it is done.'); setWo(null);
  };
  const setWoStatus = (w, s, cost) => update((d) => {
    const x = d.workOrders.find((y) => y.id === w.id);
    x.status = s;
    if (cost != null) x.cost = cost;
    const b = d.buses.find((y) => y.id === x.busId);
    if (s === 'done') { if (!d.workOrders.some((y) => y.busId === b.id && y.id !== x.id && y.status !== 'done')) b.status = 'active'; if (x.type === 'PMS') b.lastPmsKm = b.odometer; }
    audit(d, 'fleet.workorder', `${x.no} → ${WO_STATUS[s][0]}${cost ? ` (${peso(cost)})` : ''}`);
  });

  return (
    <>
      <TopBar crumb="Fleet & crew" title="Buses & maintenance" menu={menu} onSignOut={onSignOut} after={<span className="st s-mute" style={{ marginLeft: 6 }}>Phase 2</span>}>
        <button type="button" className="btn-a b-navy" onClick={() => setWo({ busId: state.buses[0].id, type: 'Repair', desc: '', mechanic: 'Shop A – Cubao' })}><Icon name="plus" />Work order</button>
      </TopBar>
      <div className="pad">
        <div className="kpis">
          <div className="k"><div className="l"><Icon name="bus" />Buses</div><div className="v">{state.buses.length}</div><div className="d">{state.classes.map((c) => `${state.buses.filter((b) => b.cls === c.id).length} ${c.short}`).join(' · ')}</div></div>
          <div className="k"><div className="l"><Icon name="check" />Available</div><div className="v">{state.buses.filter((b) => !busProblem(state, b)).length}</div><div className="d">can be dispatched</div></div>
          <button type="button" className={`k ${flt === 'shop' ? 'sel' : ''}`} onClick={() => setFlt(flt === 'shop' ? '' : 'shop')} style={{ textAlign: 'left' }}><div className="l"><Icon name="tool" />In the shop</div><div className="v">{state.buses.filter((b) => b.status !== 'active').length}</div><div className="d">{state.workOrders.filter((w) => w.status !== 'done').length} open work orders</div></button>
          <button type="button" className={`k ${flt === 'pms' ? 'sel' : ''}`} onClick={() => setFlt(flt === 'pms' ? '' : 'pms')} style={{ textAlign: 'left' }}><div className="l"><Icon name="wrench" />PMS due</div><div className="v">{state.buses.filter((b) => issues(b).pms).length}</div><div className="d">every {pms.toLocaleString()} km</div></button>
          <button type="button" className={`k ${flt === 'docs' ? 'sel' : ''}`} onClick={() => setFlt(flt === 'docs' ? '' : 'docs')} style={{ textAlign: 'left' }}><div className="l"><Icon name="file" />Documents expiring</div><div className="v">{state.buses.filter((b) => issues(b).docs).length}</div><div className="d">OR/CR, LTFRB CPC, insurance</div></button>
          <div className="k"><div className="l"><Icon name="coins" />Maintenance cost</div><div className="v">{peso(Math.round(state.workOrders.reduce((s, w) => s + w.cost, 0) / 1000))}k</div><div className="d">last 30 days</div></div>
        </div>
        <div className="tabs" style={{ marginTop: 14 }}>{[['buses', 'Buses'], ['wo', 'Work orders']].map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        {tab === 'buses' ? (
          <div className="panel">
            <div className="ph-row">
              <label className="ctl"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Body no., plate, model" /></label>
              <label className="ctl"><select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Class"><option value="">All classes</option>{state.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <span className="sub">{buses.length} buses</span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Body no.</th><th>Plate</th><th>Model</th><th>Class</th><th>Home</th><th>Odometer</th><th>Next PMS</th><th>Registration</th><th>LTFRB CPC</th><th>Insurance</th><th>Status</th></tr></thead>
                <tbody>{buses.slice(0, 120).map((b) => {
                  const left = pms - (b.odometer - b.lastPmsKm);
                  const p = busProblem(state, b);
                  return (
                    <tr key={b.id}>
                      <td><b>{b.bodyNo}</b></td><td>{b.plate}</td><td className="mini">{b.model} · {b.year}</td>
                      <td><span className="cls-badge" style={{ '--c': clsOf(state, b.cls).color }}>{clsOf(state, b.cls).short}</span></td>
                      <td>{tName(state, b.home)}</td><td>{b.odometer.toLocaleString()} km</td>
                      <td>{left < 0 ? <span className="st s-bad">{Math.abs(left).toLocaleString()} km over</span> : left <= warn ? <span className="st s-warn">in {left.toLocaleString()} km</span> : <span className="mini">in {left.toLocaleString()} km</span>}</td>
                      <td><DocBadge date={b.regExpiry} /></td><td><DocBadge date={b.cpcExpiry} /></td><td><DocBadge date={b.insExpiry} /></td>
                      <td>{p ? <span className="st s-bad">{p}</span> : <span className="st s-good"><Icon name="check" />Ready</span>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="panel">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>No.</th><th>Bus</th><th>Type</th><th>Work</th><th>Shop</th><th>Opened</th><th>Cost</th><th>Status</th><th /></tr></thead>
                <tbody>{state.workOrders.map((w) => (
                  <tr key={w.id}>
                    <td><b>{w.no}</b></td><td>{busOf(state, w.busId)?.bodyNo}</td><td>{w.type}</td><td>{w.desc}</td><td className="mini">{w.mechanic}</td>
                    <td className="mini">{new Date(w.opened).toLocaleDateString('en-PH')}</td><td>{w.cost ? peso(w.cost) : '—'}</td>
                    <td><span className={`st ${WO_STATUS[w.status][1]}`}>{WO_STATUS[w.status][0]}</span></td>
                    <td><div className="acts">{w.status === 'open' && <button type="button" className="btn-a b-ghost b-xs" onClick={() => setWoStatus(w, 'in_progress')}>Start</button>}{w.status !== 'done' && <button type="button" className="btn-a b-navy b-xs" onClick={() => { const c = Number(window.prompt('Total cost (₱)', '5000')); if (!Number.isNaN(c)) { setWoStatus(w, 'done', c); toast('Work order closed. The bus is back on dispatch.'); } }}>Done</button>}</div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {wo && (
        <Modal title="New work order" onClose={() => setWo(null)} footer={<><button type="button" className="btn-a b-ghost" onClick={() => setWo(null)}>Cancel</button><button type="button" className="btn-a b-navy" disabled={wo.desc.trim().length < 3} onClick={saveWo}>Open work order</button></>}>
          <label className="field"><span>Bus</span><select className="select" value={wo.busId} onChange={(e) => setWo({ ...wo, busId: e.target.value })}>{state.buses.map((b) => <option key={b.id} value={b.id}>{b.bodyNo} · {b.plate} · {clsOf(state, b.cls).short}</option>)}</select></label>
          <div className="row2">
            <label className="field"><span>Type</span><select className="select" value={wo.type} onChange={(e) => setWo({ ...wo, type: e.target.value })}>{['PMS', 'Repair', 'Tires', 'Body', 'Electrical', 'Aircon'].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="field"><span>Shop</span><select className="select" value={wo.mechanic} onChange={(e) => setWo({ ...wo, mechanic: e.target.value })}>{['Shop A – Cubao', 'Shop B – Pasay', 'Dagupan yard', 'Outside supplier'].map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <label className="field"><span>Work to do</span><textarea className="textarea" value={wo.desc} onChange={(e) => setWo({ ...wo, desc: e.target.value })} placeholder="e.g. Aircon not cooling, check compressor" /></label>
        </Modal>
      )}
    </>
  );
}

export function Crew({ menu, onSignOut }) {
  const { state, update, toast } = useStore();
  const [role, setRole] = useState('driver');
  const [q, setQ] = useState('');
  const soon = ymd(addDays(new Date(), Number(setting(state, 'fleet.documents.warnDays'))));
  const today = tripsOn(state, todayYmd());
  const dutyOf = (id) => today.filter((t) => [t.ops.driverId, t.ops.driver2Id, t.ops.conductorId].includes(id));
  const rows = state.crew.filter((c) => c.role === role && (!q || `${c.name} ${c.empNo}`.toLowerCase().includes(q.toLowerCase())));
  const max = Number(setting(state, 'fleet.duty.maxDriveHours'));
  return (
    <>
      <TopBar crumb="Fleet & crew" title="Drivers & conductors" menu={menu} onSignOut={onSignOut} after={<span className="st s-mute" style={{ marginLeft: 6 }}>Phase 2</span>}>
        <div className="seg"><button type="button" className={role === 'driver' ? 'on' : ''} onClick={() => setRole('driver')}>Drivers</button><button type="button" className={role === 'conductor' ? 'on' : ''} onClick={() => setRole('conductor')}>Conductors</button></div>
        <label className="ctl"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or employee no." /></label>
      </TopBar>
      <div className="pad">
        <div className="panel">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Emp. no.</th><th>Name</th><th>Home</th>{role === 'driver' && <th>License</th>}{role === 'driver' && <th>Expiry</th>}<th>Duty today</th><th>Rating</th><th>Status</th><th /></tr></thead>
              <tbody>{rows.slice(0, 150).map((c) => {
                const duty = dutyOf(c.id);
                const hrs = Math.round(duty.reduce((s, t) => s + t.mins, 0) / 6) / 10;
                return (
                  <tr key={c.id}>
                    <td><b>{c.empNo}</b></td><td>{c.name}<div className="mini">{c.mobile}</div></td><td>{tName(state, c.home)}</td>
                    {role === 'driver' && <td className="mini">{c.license}</td>}
                    {role === 'driver' && <td>{c.licenseExpiry < todayYmd() ? <span className="st s-bad">Expired</span> : c.licenseExpiry <= soon ? <span className="st s-warn">{c.licenseExpiry}</span> : <span className="mini">{c.licenseExpiry}</span>}</td>}
                    <td>{duty.length ? <>{duty.map((t) => t.time).join(', ')}<div className={`mini ${hrs > max ? 'dn' : ''}`}>{hrs} h{hrs > max ? ` · over ${max} h limit` : ''}</div></> : <span className="mini">Off</span>}</td>
                    <td>★ {c.rating}</td>
                    <td>{c.status === 'active' ? <span className="st s-good">Active</span> : <span className="st s-mute">On leave</span>}</td>
                    <td><button type="button" className="btn-a b-ghost b-xs" onClick={() => { update((d) => { const x = d.crew.find((y) => y.id === c.id); x.status = x.status === 'active' ? 'leave' : 'active'; audit(d, 'crew.status', `${x.empNo} ${x.name}: ${x.status}`); }); toast('Saved.'); }}>{c.status === 'active' ? 'Set on leave' : 'Back to work'}</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <p className="mini" style={{ marginTop: 10 }}>Duty limits from Settings → Fleet & crew: at most {max} hours driving per duty, {setting(state, 'fleet.duty.restHours')} hours rest between duties. Expired licenses cannot be assigned on the dispatch board.</p>
        </div>
      </div>
    </>
  );
}

export function Remittance({ menu, onSignOut }) {
  const { state, update, toast } = useStore();
  const [recv, setRecv] = useState(null);
  const sales = {};
  state.bookings.filter((b) => b.source === 'counter' && b.createdAt.slice(0, 10) === todayYmd() && b.pay.method === 'cash' && b.pay.status === 'paid').forEach((b) => { sales[b.by] = (sales[b.by] || 0) + b.total; });
  return (
    <>
      <TopBar crumb="Fleet & crew" title="Cash remittance" menu={menu} onSignOut={onSignOut} after={<span className="st s-mute" style={{ marginLeft: 6 }}>Phase 2</span>} />
      <div className="pad">
        <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', marginTop: 0 }}>
          <div className="panel">
            <div className="ph-row"><h3>Conductor remittances</h3><span className="sub">cash from roadside passengers, per trip</span></div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Trip</th><th>Conductor</th><th>Roadside tickets</th><th>Expected</th><th>Counted</th><th>Variance</th><th /></tr></thead>
                <tbody>{state.remittances.map((r) => {
                  const t = getTrip(state, r.tripId);
                  const v = r.counted == null ? null : r.counted - r.expected;
                  return (
                    <tr key={r.id}>
                      <td>{t ? <><b>{t.time}</b> {tName(state, t.fromId)} → {tName(state, t.toId)}</> : r.tripId}</td>
                      <td>{crewOf(state, r.conductorId)?.name || '—'}</td><td>{r.roadside}</td><td>{peso(r.expected)}</td>
                      <td>{r.counted == null ? '—' : peso(r.counted)}</td>
                      <td>{v == null ? '—' : v === 0 ? <span className="st s-good">OK</span> : <span className="st s-bad">{peso(v)}</span>}</td>
                      <td>{r.status === 'pending' ? <button type="button" className="btn-a b-navy b-xs" onClick={() => setRecv({ ...r, amount: String(r.expected) })}>Receive</button> : <span className="mini">Received</span>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
              {!state.remittances.length && <Empty icon="coins">No remittances yet today.</Empty>}
            </div>
          </div>
          <div className="panel">
            <div className="ph-row"><h3>Counter cash today</h3><span className="sub">for end-of-shift closing</span></div>
            {Object.entries(sales).map(([by, amt]) => <div className="sum-row" key={by}><span>{by}</span><b>{peso(amt)}</b></div>)}
            {!Object.keys(sales).length && <p className="mini">No cash sales at the counters yet today. Sell a ticket in Ticket counter to see it here.</p>}
            <p className="mini" style={{ marginTop: 10 }}>The cashier counts each clerk's drawer at the end of the shift; differences are recorded with a reason and need a Terminal Manager's approval.</p>
          </div>
        </div>
      </div>
      {recv && (
        <Modal title="Receive remittance" onClose={() => setRecv(null)} footer={<><button type="button" className="btn-a b-ghost" onClick={() => setRecv(null)}>Cancel</button><button type="button" className="btn-a b-navy" onClick={() => {
          update((d) => { const x = d.remittances.find((y) => y.id === recv.id); x.counted = Number(recv.amount); x.status = 'received'; x.at = new Date().toISOString(); audit(d, 'remittance.received', `Remittance ${peso(x.counted)} (expected ${peso(x.expected)}) from ${crewOf(d, x.conductorId)?.name}`, { severity: x.counted !== x.expected ? 'warning' : 'info' }); });
          toast('Remittance received.'); setRecv(null);
        }}>Confirm</button></>}>
          <p>Expected from the crew app: <b>{peso(recv.expected)}</b> ({recv.roadside} roadside tickets).</p>
          <label className="field" style={{ marginTop: 10 }}><span>Amount counted</span><input className="input" inputMode="numeric" value={recv.amount} onChange={(e) => setRecv({ ...recv, amount: e.target.value.replace(/\D/g, '') })} /></label>
        </Modal>
      )}
    </>
  );
}
