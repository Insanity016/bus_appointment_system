import { useState } from 'react';
import Icon from '../lib/icons.jsx';
import { useStore } from '../lib/store.jsx';
import { boardTicket } from '../lib/booking.js';
import { LIVE, PAX_TYPES, SOURCE_LABEL, TRIP_STATUS, busOf, clsOf, crewOf, fmtTime, getTrip, sampleManifest, seatList, tName, takenSeats, todayYmd, tripStatus, tripsOn } from '../lib/trips.js';
import { Empty, StatusPill } from '../components.jsx';
import { SeatMap } from '../shared.jsx';
import { TopBar, useTerminalScope } from './AdminApp.jsx';

/** Manifest = online/counter bookings in the system + the sample counter sales. */
export function manifest(state, trip) {
  const sample = sampleManifest(state, trip).map((p) => ({ ...p, ref: null, boarded: p.boarded || (trip.ops.boardedSeats || []).includes(p.seat) }));
  const booked = state.bookings.filter((b) => b.tripId === trip.id && LIVE.includes(b.status)).flatMap((b) => b.pax.map((p) => ({ ...p, ref: b.ref, source: b.source, unpaid: b.status === 'reserved' })));
  return [...booked, ...sample].sort((a, b) => parseInt(a.seat, 10) - parseInt(b.seat, 10) || a.seat.localeCompare(b.seat));
}

export default function Boarding({ menu, onSignOut }) {
  const { state, update, toast } = useStore();
  const { all, hubs } = useTerminalScope();
  const terms = all ? state.terminals.filter((t) => t.on) : hubs;
  const [term, setTerm] = useState(terms[0]?.id);
  const list = tripsOn(state, todayYmd(), { from: term }).filter((t) => ['boarding', 'scheduled', 'delayed', 'departed'].includes(tripStatus(t)));
  const [tripId, setTripId] = useState(() => list.find((t) => tripStatus(t) === 'boarding')?.id || list[0]?.id);
  const [code, setCode] = useState('');
  const [last, setLast] = useState(null);
  const trip = tripId && getTrip(state, tripId);
  const rows = trip ? manifest(state, trip) : [];
  const boarded = new Set(rows.filter((p) => p.boarded).map((p) => p.seat));
  const me = state.staffSession.name;

  const scan = (value) => {
    const r = update((d) => boardTicket(d, value, trip.id, me));
    setLast(r); setCode('');
    if (!r.ok) toast(r.msg, 'err');
  };
  const simulate = () => {
    const next = state.bookings.find((b) => b.tripId === trip.id && b.status === 'confirmed');
    if (next) scan(`${next.ref}|${trip.id}`); else toast('No unscanned e-tickets left on this trip.', 'err');
  };
  const toggleSample = (seat) => update((d) => { const o = d.tripOps[trip.id] = { ...(d.tripOps[trip.id] || {}) }; const s = new Set(o.boardedSeats || []); if (s.has(seat)) s.delete(seat); else s.add(seat); o.boardedSeats = [...s]; });

  return (
    <>
      <TopBar crumb="Operations" title="Boarding & manifest" menu={menu} onSignOut={onSignOut}>
        <label className="ctl"><Icon name="building" /><select value={term} onChange={(e) => { setTerm(e.target.value); setTripId(null); }} aria-label="Terminal">{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="ctl" style={{ minWidth: 260 }}><Icon name="bus" /><select value={tripId || ''} onChange={(e) => setTripId(e.target.value)} aria-label="Trip">{list.map((t) => <option key={t.id} value={t.id}>{t.time} → {tName(state, t.toId)} · {TRIP_STATUS[tripStatus(t)].label}</option>)}</select></label>
      </TopBar>
      <div className="pad">
        {!trip ? <Empty icon="bus">No trips to board from this terminal right now.</Empty> : (
          <div className="grid" style={{ gridTemplateColumns: '1fr 1.5fr', marginTop: 0 }}>
            <div>
              <div className="panel scanbox">
                <div className="ph-row"><h3>Scan e-tickets</h3><StatusPill status={tripStatus(trip)} map={TRIP_STATUS} /></div>
                <p className="mini">{fmtTime(trip.time)} {tName(state, trip.fromId)} → {tName(state, trip.toId)} · bus {busOf(state, trip.ops.busId)?.bodyNo || '—'} · {trip.ops.gate || ''} · conductor {crewOf(state, trip.ops.conductorId)?.name || '—'}</p>
                <form className="otp" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) scan(code); }}>
                  <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Scan QR or type FS-… reference" autoFocus aria-label="Ticket code" />
                  <button className="btn-a b-navy" type="submit"><Icon name="scan" />Check</button>
                </form>
                <button type="button" className="btn-a b-ghost" style={{ marginTop: 8 }} onClick={simulate}><Icon name="qr" />Simulate a passenger's QR scan</button>
                {last && <div className={last.ok ? 'okbox' : 'error'} style={{ marginTop: 12 }}><Icon name={last.ok ? 'check' : 'alert'} />{last.msg}</div>}
                <div className="board-count"><div><b>{boarded.size}</b><span>boarded</span></div><div><b>{rows.length}</b><span>sold</span></div><div><b>{seatList(clsOf(state, trip.cls)).length - takenSeats(state, trip).size}</b><span>empty seats</span></div></div>
              </div>
              <div className="panel" style={{ marginTop: 14, display: 'grid', placeItems: 'center' }}>
                <SeatMap state={state} cls={trip.cls} taken={takenSeats(state, trip)} boarded={boarded} compact priorityOpen />
                <p className="mini" style={{ marginTop: 8 }}>Green = boarded · grey = sold, not yet on the bus.</p>
              </div>
            </div>
            <div className="panel">
              <div className="ph-row"><h3>Passenger manifest</h3><span className="sub">{rows.length} passengers</span><span className="sp" /><button type="button" className="btn-a b-ghost b-xs" onClick={() => window.print()}><Icon name="file" />Print manifest</button></div>
              <div className="tbl-wrap print-area">
                <table className="tbl">
                  <thead><tr><th>Seat</th><th>Passenger</th><th>Type</th><th>Ticket</th><th>Boarded</th></tr></thead>
                  <tbody>{rows.map((p) => (
                    <tr key={p.seat}>
                      <td><b>{p.seat}</b></td>
                      <td>{p.name}</td>
                      <td>{p.type !== 'regular' ? <span className="st s-warn"><Icon name="shield" />{PAX_TYPES[p.type]} · check ID</span> : PAX_TYPES[p.type]}</td>
                      <td className="mini">{p.ref ? <>{p.ref}<br />{SOURCE_LABEL[p.source]}{p.unpaid ? ' · UNPAID' : ''}</> : 'Counter (sample)'}</td>
                      <td>{p.ref ? (p.boarded ? <span className="st s-good"><Icon name="check" />Yes</span> : <button type="button" className="btn-a b-ghost b-xs" disabled={p.unpaid} onClick={() => scan(p.ref)}>Board</button>) : <button type="button" className={`btn-a b-xs ${p.boarded ? 'b-navy' : 'b-ghost'}`} onClick={() => toggleSample(p.seat)}>{p.boarded ? 'Yes' : 'Board'}</button>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="mini" style={{ marginTop: 10 }}>The manifest (names, seats, passenger types) is kept with the trip for LTFRB and insurance. Conductors use the same list offline in the crew app.</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
