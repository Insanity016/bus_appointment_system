import { useState } from 'react';
import Icon from '../lib/icons.jsx';
import { audit, setting, sms, useStore } from '../lib/store.jsx';
import { LIVE, TRIP_STATUS, busOf, clsOf, crewOf, fillTemplate, fmtDur, getTrip, seatList, smsValues, tName, takenSeats, todayYmd, tripStatus, tripsOn } from '../lib/trips.js';
import { Modal, StatusPill } from '../components.jsx';
import { TopBar, useTerminalScope } from './AdminApp.jsx';

/** Why a bus may not be dispatched (null = fine). */
export function busProblem(state, bus) {
  if (!bus) return null;
  if (bus.status !== 'active') return 'In the shop';
  const today = todayYmd();
  if (setting(state, 'fleet.documents.blockExpired') && [bus.regExpiry, bus.cpcExpiry, bus.insExpiry].some((d) => d < today)) return 'Expired document';
  if (setting(state, 'fleet.maintenance.blockOverdue') && bus.odometer - bus.lastPmsKm > Number(setting(state, 'fleet.maintenance.pmsKm'))) return 'PMS overdue';
  return null;
}

function overlaps(state, trip, busId) {
  return tripsOn(state, trip.date).find((t) => t.id !== trip.id && t.ops.busId === busId && t.departAt < new Date(trip.eta.getTime() + 3600000) && t.eta > new Date(trip.departAt.getTime() - 3600000));
}

export default function Dispatch({ menu, onSignOut }) {
  const { state, update, toast } = useStore();
  const { all, hubs } = useTerminalScope();
  const [term, setTerm] = useState(hubs[0]?.id || 'cubao');
  const [date, setDate] = useState(todayYmd());
  const [show, setShow] = useState('open');
  const [edit, setEdit] = useState(null);
  const [act, setAct] = useState(null);
  const [extra, setExtra] = useState(null);
  const trips = tripsOn(state, date, { from: term }).filter((t) => show === 'all' || !['arrived', 'cancelled'].includes(tripStatus(t)));
  const terms = all ? state.terminals.filter((t) => t.on) : hubs;

  const setOps = (id, patch, what) => update((d) => {
    d.tripOps[id] = { ...(d.tripOps[id] || {}), ...patch };
    const t = getTrip(d, id);
    audit(d, 'dispatch.updated', `${t.date} ${t.time} ${tName(d, t.fromId)}→${tName(d, t.toId)}: ${what}`);
  });
  const notify = (d, trip, tplKey, extraVals = {}) => {
    const list = d.bookings.filter((b) => b.tripId === trip.id && LIVE.includes(b.status));
    list.forEach((b) => sms(d, b.contact.mobile, fillTemplate(setting(d, `notifications.sms.${tplKey}`), smsValues(d, b, extraVals))));
    return list.length;
  };

  const status = (trip, s) => {
    const n = update((d) => {
      d.tripOps[trip.id] = { ...(d.tripOps[trip.id] || {}), status: s, [`${s}At`]: new Date().toISOString() };
      audit(d, 'trip.status', `${trip.time} ${tName(d, trip.fromId)}→${tName(d, trip.toId)}: ${TRIP_STATUS[s].label}`);
      return s === 'boarding' && setting(d, 'booking.reminders.gate') ? notify(d, getTrip(d, trip.id), 'gate') : 0;
    });
    toast(`${TRIP_STATUS[s].label}.${n ? ` Boarding SMS sent to ${n} booking(s).` : ''}`);
  };

  return (
    <>
      <TopBar crumb="Operations" title="Dispatch board" menu={menu} onSignOut={onSignOut}>
        <label className="ctl"><Icon name="building" /><select value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Departing from">{terms.map((t) => <option key={t.id} value={t.id}>From {t.name}</option>)}</select></label>
        <label className="ctl"><Icon name="calendar" /><input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" /></label>
        <div className="seg"><button type="button" className={show === 'open' ? 'on' : ''} onClick={() => setShow('open')}>Upcoming</button><button type="button" className={show === 'all' ? 'on' : ''} onClick={() => setShow('all')}>All</button></div>
        <button type="button" className="btn-a b-navy" onClick={() => setExtra({ routeId: state.routes.find((r) => r.from === term || r.to === term)?.id, t: '22:00', c: 'regular' })}><Icon name="plus" />Extra trip</button>
      </TopBar>
      <div className="pad">
        <div className="panel">
          <div className="tbl-wrap">
            <table className="tbl disp">
              <thead><tr><th>Departure</th><th>Route</th><th>Class</th><th>Bus</th><th>Crew</th><th>Gate</th><th>Seats</th><th>Status</th><th /></tr></thead>
              <tbody>
                {trips.map((t) => {
                  const st = tripStatus(t);
                  const bus = busOf(state, t.ops.busId);
                  const c = clsOf(state, t.cls);
                  const sold = takenSeats(state, t).size;
                  const prob = busProblem(state, bus);
                  const two = t.mins / 60 > Number(setting(state, 'fleet.duty.twoDriversOver'));
                  return (
                    <tr key={t.id} className={st === 'cancelled' ? 'dim' : ''}>
                      <td><b style={{ fontSize: 14 }}>{t.time}</b>{t.ops.delay ? <div className="st s-warn">+{t.ops.delay} min</div> : null}{t.extra && <div className="st s-info">extra</div>}</td>
                      <td><b>{tName(state, t.toId)}</b><div className="mini">via {t.route.via} · {fmtDur(t.mins)}</div></td>
                      <td><span className="cls-badge" style={{ '--c': c.color }}>{c.short}</span></td>
                      <td>{bus ? <><b>{bus.bodyNo}</b><div className="mini">{bus.plate}</div>{prob && <span className="st s-bad"><Icon name="alert" />{prob}</span>}</> : <span className="st s-warn"><Icon name="alert" />Not assigned</span>}</td>
                      <td className="mini">{t.ops.driverId ? <>{crewOf(state, t.ops.driverId)?.name}{t.ops.driver2Id ? ` + ${crewOf(state, t.ops.driver2Id)?.name.split(' ')[0]}` : ''}<br />{crewOf(state, t.ops.conductorId)?.name}</> : '—'}{two && !t.ops.driver2Id && t.ops.driverId ? <div className="st s-warn">2nd driver needed</div> : null}</td>
                      <td>{t.ops.gate || '—'}</td>
                      <td><b>{sold}</b>/{seatList(c).length}<div className="meter"><i style={{ width: `${(sold / seatList(c).length) * 100}%` }} /></div></td>
                      <td><StatusPill status={st} map={TRIP_STATUS} /></td>
                      <td>
                        <div className="acts">
                          {['scheduled', 'delayed'].includes(st) && <button type="button" className="btn-a b-ghost b-xs" onClick={() => setEdit(t)}><Icon name="edit" />Assign</button>}
                          {['scheduled', 'delayed'].includes(st) && <button type="button" className="btn-a b-navy b-xs" disabled={!bus || !!prob} onClick={() => status(t, 'boarding')}>Board</button>}
                          {st === 'boarding' && <button type="button" className="btn-a b-gold b-xs" onClick={() => status(t, 'departed')}>Depart</button>}
                          {st === 'departed' && <button type="button" className="btn-a b-ghost b-xs" onClick={() => status(t, 'arrived')}>Arrived</button>}
                          {!['arrived', 'cancelled', 'departed'].includes(st) && <button type="button" className="btn-a b-ghost b-xs" onClick={() => setAct({ trip: t, kind: 'delay', minutes: 20, note: '' })}>Delay</button>}
                          {!['arrived', 'cancelled', 'departed'].includes(st) && <button type="button" className="btn-a b-ghost b-xs" onClick={() => setAct({ trip: t, kind: 'cancel', note: '' })} aria-label="Cancel trip"><Icon name="x" /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mini" style={{ marginTop: 10 }}>Buses with overdue maintenance or expired documents cannot board (Settings → Fleet & crew). Delays and cancellations send an SMS to every passenger with the message in Settings → Notifications. Trips more than {setting(state, 'fleet.duty.twoDriversOver')} hours need a second driver.</p>
        </div>
      </div>

      {edit && <AssignModal trip={edit} onClose={() => setEdit(null)} onSave={(patch, what) => { setOps(edit.id, patch, what); setEdit(null); toast('Trip assignment saved.'); }} />}
      {act && (
        <Modal title={act.kind === 'delay' ? 'Delay trip' : 'Cancel trip'} onClose={() => setAct(null)} footer={<><button type="button" className="btn-a b-ghost" onClick={() => setAct(null)}>Close</button><button type="button" className={`btn-a ${act.kind === 'delay' ? 'b-navy' : 'b-red'}`} disabled={act.note.trim().length < 3} onClick={() => {
          const n = update((d) => {
            const o = d.tripOps[act.trip.id] = { ...(d.tripOps[act.trip.id] || {}) };
            if (act.kind === 'delay') { o.delay = Number(act.minutes); o.note = act.note; } else { o.status = 'cancelled'; o.note = act.note; }
            audit(d, act.kind === 'delay' ? 'trip.delayed' : 'trip.cancelled', `${act.trip.time} ${tName(d, act.trip.fromId)}→${tName(d, act.trip.toId)} ${act.kind === 'delay' ? `delayed ${act.minutes} min` : 'cancelled'}: ${act.note}`, { severity: act.kind === 'delay' ? 'info' : 'warning' });
            return notify(d, getTrip(d, act.trip.id), act.kind === 'delay' ? 'delayed' : 'cancelled', { minutes: act.minutes });
          });
          toast(`${act.kind === 'delay' ? 'Delay' : 'Cancellation'} saved. SMS sent to ${n} booking(s).`);
          setAct(null);
        }}>{act.kind === 'delay' ? 'Save and notify' : 'Cancel trip and notify'}</button></>}>
          <p style={{ marginBottom: 12 }}><b>{act.trip.time} {tName(state, act.trip.fromId)} → {tName(state, act.trip.toId)}</b> · {state.bookings.filter((b) => b.tripId === act.trip.id && LIVE.includes(b.status)).length} bookings in the system</p>
          {act.kind === 'delay' && <label className="field"><span>Delay</span><div className="num"><input type="number" min="5" max="600" value={act.minutes} onChange={(e) => setAct({ ...act, minutes: e.target.value })} /><span>minutes</span></div></label>}
          <label className="field"><span>Reason (internal, kept in the audit log)</span><textarea className="textarea" value={act.note} onChange={(e) => setAct({ ...act, note: e.target.value })} placeholder={act.kind === 'delay' ? 'e.g. Heavy traffic on NLEX' : 'e.g. Bus breakdown, no spare available'} /></label>
          <p className="mini">{act.kind === 'cancel' ? 'Passengers get an SMS with a link to choose another trip or a full refund.' : 'Passengers get the delay SMS; the website, app and departure screens show the new time.'}</p>
        </Modal>
      )}
      {extra && (
        <Modal title="Add an extra trip" onClose={() => setExtra(null)} footer={<><button type="button" className="btn-a b-ghost" onClick={() => setExtra(null)}>Cancel</button><button type="button" className="btn-a b-navy" onClick={() => {
          update((d) => {
            const r = d.routes.find((x) => x.id === extra.routeId);
            d.extraTrips.push({ routeId: r.id, dir: r.from === term ? 'out' : 'back', date, t: extra.t, c: extra.c, note: 'Extra trip' });
            audit(d, 'trip.extra', `Extra trip ${date} ${extra.t} ${tName(d, term)}→${tName(d, r.from === term ? r.to : r.from)} (${extra.c})`);
          });
          toast('Extra trip added. It is on sale on the website and app right away.'); setExtra(null);
        }}>Add trip</button></>}>
          <label className="field"><span>Route from {tName(state, term)}</span><select className="select" value={extra.routeId} onChange={(e) => setExtra({ ...extra, routeId: e.target.value })}>{state.routes.filter((r) => r.from === term || r.to === term).map((r) => <option key={r.id} value={r.id}>{tName(state, term)} → {tName(state, r.from === term ? r.to : r.from)} (via {r.via})</option>)}</select></label>
          <div className="row2">
            <label className="field"><span>Departure time</span><input className="input" type="time" value={extra.t} onChange={(e) => setExtra({ ...extra, t: e.target.value })} /></label>
            <label className="field"><span>Bus class</span><select className="select" value={extra.c} onChange={(e) => setExtra({ ...extra, c: e.target.value })}>{state.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          </div>
          <p className="mini">For a permanent new departure, edit the route in Website CMS → Routes, fares & schedules.</p>
        </Modal>
      )}
    </>
  );
}

function AssignModal({ trip, onClose, onSave }) {
  const { state } = useStore();
  const [f, setF] = useState({ busId: trip.ops.busId || '', driverId: trip.ops.driverId || '', driver2Id: trip.ops.driver2Id || '', conductorId: trip.ops.conductorId || '', gate: trip.ops.gate || 'Gate 1' });
  const buses = state.buses.filter((b) => b.cls === trip.cls).sort((a, b) => (a.home === trip.fromId ? -1 : 0) - (b.home === trip.fromId ? -1 : 0));
  const bus = busOf(state, f.busId);
  const prob = busProblem(state, bus);
  const clash = f.busId && overlaps(state, trip, f.busId);
  const drivers = state.crew.filter((c) => c.role === 'driver' && c.status === 'active');
  const conductors = state.crew.filter((c) => c.role === 'conductor' && c.status === 'active');
  const lic = (id) => { const c = crewOf(state, id); return c?.licenseExpiry && c.licenseExpiry < todayYmd() ? 'License expired' : null; };
  const pickBus = (id) => { const b = busOf(state, id); setF({ ...f, busId: id, driverId: b?.driverId || f.driverId, conductorId: b?.conductorId || f.conductorId }); };
  const err = prob || (clash ? `Bus ${bus.bodyNo} is on the ${clash.time} trip to ${tName(state, clash.toId)}` : null) || lic(f.driverId) || lic(f.driver2Id);
  return (
    <Modal title={`Assign · ${trip.time} ${tName(state, trip.fromId)} → ${tName(state, trip.toId)}`} width={560} onClose={onClose} footer={<><button type="button" className="btn-a b-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn-a b-navy" disabled={!f.busId || !!prob || !!lic(f.driverId)} onClick={() => onSave(f, `bus ${bus?.bodyNo}, gate ${f.gate}`)}>Save</button></>}>
      <label className="field"><span>Bus ({clsOf(state, trip.cls).name})</span><select className="select" value={f.busId} onChange={(e) => pickBus(e.target.value)}><option value="">Choose a bus…</option>{buses.map((b) => { const p = busProblem(state, b); return <option key={b.id} value={b.id} disabled={!!p}>{b.bodyNo} · {b.plate} · {tName(state, b.home)}{p ? ` — ${p}` : ''}</option>; })}</select><small>The bus's regular driver and conductor are filled in; change them if needed.</small></label>
      {err && <div className={`error ${clash && !prob ? 'warnbox' : ''}`}><Icon name="alert" />{err}</div>}
      <div className="row2">
        <label className="field"><span>Driver</span><select className="select" value={f.driverId} onChange={(e) => setF({ ...f, driverId: e.target.value })}><option value="">—</option>{drivers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.empNo})</option>)}</select></label>
        <label className="field"><span>Second driver {trip.mins / 60 > Number(setting(state, 'fleet.duty.twoDriversOver')) ? '(required)' : '(optional)'}</span><select className="select" value={f.driver2Id} onChange={(e) => setF({ ...f, driver2Id: e.target.value })}><option value="">—</option>{drivers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.empNo})</option>)}</select></label>
        <label className="field"><span>Conductor</span><select className="select" value={f.conductorId} onChange={(e) => setF({ ...f, conductorId: e.target.value })}><option value="">—</option>{conductors.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.empNo})</option>)}</select></label>
        <label className="field"><span>Gate / bay</span><select className="select" value={f.gate} onChange={(e) => setF({ ...f, gate: e.target.value })}>{Array.from({ length: 8 }, (_, i) => `Gate ${i + 1}`).map((g) => <option key={g}>{g}</option>)}</select></label>
      </div>
    </Modal>
  );
}
