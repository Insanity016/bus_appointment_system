import { useState } from 'react';
import Icon from '../lib/icons.jsx';
import { useStore } from '../lib/store.jsx';
import { createBooking } from '../lib/booking.js';
import { PAX_TYPES, PAY_LABEL, clsOf, destinationsFrom, fmtTime, getTrip, isPriority, paxFare, peso, seatList, tName, takenSeats, todayYmd, tripStatus, tripsOn } from '../lib/trips.js';
import { Modal } from '../components.jsx';
import { QrCode, SeatLegend, SeatMap } from '../shared.jsx';
import { TopBar, useTerminalScope } from './AdminApp.jsx';

export default function Counter({ menu, onSignOut }) {
  const { state, update, toast } = useStore();
  const { hubs, all } = useTerminalScope();
  const origins = all ? state.terminals.filter((t) => t.on) : hubs;
  const [from, setFrom] = useState(origins[0]?.id || 'cubao');
  const dests = destinationsFrom(state, from);
  const [to, setTo] = useState(dests[0]?.id);
  const [date, setDate] = useState(todayYmd());
  const [tripId, setTripId] = useState(null);
  const [seats, setSeats] = useState([]);
  const [pax, setPax] = useState([]);
  const [mobile, setMobile] = useState('');
  const [method, setMethod] = useState('cash');
  const [tendered, setTendered] = useState('');
  const [err, setErr] = useState('');
  const [printed, setPrinted] = useState(null);
  const me = state.staffSession;

  const trips = tripsOn(state, date, { from, to }).filter((t) => ['scheduled', 'delayed', 'boarding'].includes(tripStatus(t)));
  const trip = tripId && getTrip(state, tripId);
  const taken = trip ? takenSeats(state, trip) : new Set();
  const fares = trip ? pax.map((p) => paxFare(state, trip, p.type)) : [];
  const total = fares.reduce((s, f) => s + f.fare, 0);
  const change = Number(tendered || 0) - total;
  const mySales = state.bookings.filter((b) => b.by === me.name && b.createdAt.slice(0, 10) === todayYmd() && b.pay.status === 'paid');

  const pick = (s) => {
    setErr('');
    if (seats.includes(s)) { const i = seats.indexOf(s); setSeats(seats.filter((x) => x !== s)); setPax(pax.filter((_, k) => k !== i)); return; }
    setSeats([...seats, s]); setPax([...pax, { name: '', type: isPriority(state, s) ? 'senior' : 'regular', idNo: '' }]);
  };
  const reset = () => { setSeats([]); setPax([]); setMobile(''); setTendered(''); setErr(''); };
  const sell = () => {
    if (!seats.length) { setErr('Pick at least one seat.'); return; }
    if (pax.some((p) => p.name.trim().length < 2)) { setErr('Enter each passenger\'s name for the manifest.'); return; }
    if (pax.some((p) => p.type !== 'regular' && !p.idNo.trim())) { setErr('Check and type the ID number of each discounted passenger.'); return; }
    if (method === 'cash' && change < 0) { setErr('Amount received is less than the total.'); return; }
    const b = update((d) => createBooking(d, { trip, pax: pax.map((p, i) => ({ seat: seats[i], name: p.name.trim(), type: p.type, idNo: p.idNo.trim() })), contact: { name: pax[0].name.trim(), mobile: mobile.trim(), email: '' }, method, source: 'counter', by: me.name }));
    setPrinted({ b, change: method === 'cash' ? change : 0 });
    toast(`Sold ${b.ref}. ${method === 'cash' && change > 0 ? `Change: ${peso(change)}.` : ''}`);
    reset();
  };

  return (
    <>
      <TopBar crumb="Ticketing" title="Ticket counter" menu={menu} onSignOut={onSignOut}>
        <span className="st s-info"><Icon name="ticket" />My sales today: {mySales.reduce((s, b) => s + b.pax.length, 0)} tickets · {peso(mySales.reduce((s, b) => s + b.total, 0))}</span>
      </TopBar>
      <div className="pad pos">
        <div className="panel">
          <div className="row3">
            <label className="field"><span>From</span><select className="select" value={from} onChange={(e) => { setFrom(e.target.value); const d = destinationsFrom(state, e.target.value); setTo(d[0]?.id); setTripId(null); reset(); }}>{origins.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="field"><span>To</span><select className="select" value={to} onChange={(e) => { setTo(e.target.value); setTripId(null); reset(); }}>{dests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="field"><span>Date</span><input className="input" type="date" min={todayYmd()} value={date} onChange={(e) => { setDate(e.target.value); setTripId(null); reset(); }} /></label>
          </div>
          <div className="pos-trips">
            {trips.map((t) => {
              const c = clsOf(state, t.cls);
              const left = seatList(c).length - takenSeats(state, t).size;
              return (
                <button type="button" key={t.id} className={`pt ${tripId === t.id ? 'on' : ''}`} disabled={!left} onClick={() => { setTripId(t.id); reset(); }}>
                  <b>{fmtTime(t.time)}</b><span className="cls-badge" style={{ '--c': c.color }}>{c.short}</span><span>{left} left</span><span className="mini">{peso(t.route.fares[t.cls])}</span>
                  {tripStatus(t) === 'boarding' && <span className="st s-info">Boarding</span>}
                </button>
              );
            })}
            {!trips.length && <p className="mini">No more trips on this date.</p>}
          </div>
          {trip && (
            <div className="pos-seat">
              <div><SeatMap state={state} cls={trip.cls} taken={taken} picked={seats} onPick={pick} compact priorityOpen /><SeatLegend /></div>
              <div className="paxes">
                {seats.map((s, i) => (
                  <div className="pax" key={s}>
                    <div className="pax-h"><span className="seatno">{s}</span><input className="input" value={pax[i].name} onChange={(e) => setPax(pax.map((p, k) => (k === i ? { ...p, name: e.target.value } : p)))} placeholder="Passenger name" aria-label={`Name for seat ${s}`} /></div>
                    <div className="row2">
                      <select className="select" value={pax[i].type} onChange={(e) => setPax(pax.map((p, k) => (k === i ? { ...p, type: e.target.value } : p)))} aria-label="Type">{Object.entries(PAX_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                      {pax[i].type !== 'regular' ? <input className="input" value={pax[i].idNo} onChange={(e) => setPax(pax.map((p, k) => (k === i ? { ...p, idNo: e.target.value } : p)))} placeholder="ID no. (checked)" aria-label="ID number" /> : <span className="mini" style={{ alignSelf: 'center' }}>{peso(fares[i]?.fare)}</span>}
                    </div>
                  </div>
                ))}
                {!seats.length && <div className="hintbox"><Icon name="seat" />Click seats for the passengers at the window. Priority seats (purple) are open at the counter for senior, PWD and pregnant passengers.</div>}
              </div>
            </div>
          )}
        </div>
        <div className="panel pos-pay">
          <h3>Payment</h3>
          {trip ? <p className="mini">{fmtTime(trip.time)} {tName(state, trip.fromId)} → {tName(state, trip.toId)} · {clsOf(state, trip.cls).name}</p> : <p className="mini">Choose a trip.</p>}
          {pax.map((p, i) => <div className="sum-row" key={i}><span>{seats[i]} · {PAX_TYPES[p.type]}</span><b>{peso(fares[i]?.fare)}</b></div>)}
          <div className="sum-total"><span>Total</span><b>{peso(total)}</b></div>
          <div className="chips" style={{ margin: '12px 0' }}>{['cash', 'qrph', 'gcash', 'card'].map((m) => <button type="button" key={m} className={`chip ${method === m ? 'on' : ''}`} onClick={() => setMethod(m)}>{PAY_LABEL[m]}</button>)}</div>
          {method === 'cash' ? (
            <>
              <label className="field"><span>Amount received</span><input className="input" inputMode="numeric" value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^\d.]/g, ''))} style={{ fontSize: 20, fontWeight: 800 }} /></label>
              <div className="chips">{[total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => <button type="button" key={v} className="chip" onClick={() => setTendered(String(v))}>{peso(v)}</button>)}</div>
              <div className="sum-row" style={{ marginTop: 8 }}><span>Change</span><b style={{ fontSize: 18, color: change < 0 ? 'var(--bad)' : 'var(--good)' }}>{tendered ? peso(Math.max(0, change)) : '—'}</b></div>
            </>
          ) : <p className="mini">The passenger scans the QR Ph / GCash code on the counter display, or taps the card on the terminal. Confirmation comes from PayMongo.</p>}
          <label className="field" style={{ marginTop: 10 }}><span>Mobile (optional, for SMS ticket and delay alerts)</span><input className="input" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="09xx xxx xxxx" /></label>
          {err && <div className="error"><Icon name="alert" />{err}</div>}
          <button type="button" className="btn-a b-gold" style={{ width: '100%', justifyContent: 'center', padding: 12, fontSize: 14 }} disabled={!trip || !seats.length} onClick={sell}><Icon name="ticket" />Sell & print</button>
          <p className="mini" style={{ marginTop: 10 }}>Counter and online sales use the same seats, so a seat can never be sold twice. No convenience fee at the counter.</p>
        </div>
      </div>
      {printed && (
        <Modal title="Ticket printed" width={380} onClose={() => setPrinted(null)} footer={<><button type="button" className="btn-a b-ghost" onClick={() => setPrinted(null)}>Done</button><button type="button" className="btn-a b-navy" onClick={() => window.print()}><Icon name="file" />Print again</button></>}>
          <div className="print-area receipt">
            <b>{state.brand.name} BUS</b>
            <div>{printed.b.ref}</div>
            <QrCode text={`${printed.b.ref}|${printed.b.tripId}`} size={120} />
            {(() => { const t = getTrip(state, printed.b.tripId); return <div><b>{tName(state, t.fromId)} → {tName(state, t.toId)}</b><br />{t.date} · {fmtTime(t.time)} · {t.ops.gate || ''}</div>; })()}
            {printed.b.pax.map((p) => <div key={p.seat} className="r"><span>{p.seat} {p.name} ({PAX_TYPES[p.type]})</span><span>{peso(p.fare)}</span></div>)}
            <div className="r"><b>Total</b><b>{peso(printed.b.total)}</b></div>
            {printed.change > 0 && <div className="r"><span>Change</span><span>{peso(printed.change)}</span></div>}
            <small>Sold by {printed.b.by} · {new Date(printed.b.createdAt).toLocaleString('en-PH')}</small>
          </div>
        </Modal>
      )}
    </>
  );
}
