import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { setting, useStore } from '../lib/store.jsx';
import { autoSeats, cancelBooking, payReservation, rebook } from '../lib/booking.js';
import { BOOKING_STATUS, PAX_TYPES, PAY_LABEL, TRIP_STATUS, bookingStatus, busOf, canRebook, canRefund, clsOf, fmtDate, fmtTime, getTrip, hoursBefore, normMobile, paxFare, peso, saleClosed, seatsLeft, tName, todayYmd, tripStatus, tripsOn } from '../lib/trips.js';
import { Modal, StatusPill } from '../components.jsx';
import { BrandLockup, Countdown, QrCode } from '../shared.jsx';
import { PayMongo } from './Book.jsx';

export function ManageLookup() {
  const { state } = useStore();
  const nav = useNavigate();
  const [ref, setRef] = useState('');
  const [mobile, setMobile] = useState('');
  const [err, setErr] = useState('');
  const go = (e) => {
    e.preventDefault();
    const b = state.bookings.find((x) => x.ref.toLowerCase() === ref.trim().toLowerCase());
    if (!b || normMobile(b.contact.mobile) !== normMobile(mobile)) { setErr('We could not find a booking with that reference and mobile number.'); return; }
    nav(`/ticket/${b.ref}`);
  };
  const sample = state.bookings.find((b) => b.passengerId === 'p1' && b.status === 'confirmed');
  return (
    <div className="page-hero"><div className="wrap">
      <h1>Manage your booking</h1>
      <p>View your e-ticket, change your trip, pay a reservation or ask for a refund.</p>
      <form className="search-card flat lookup" onSubmit={go}>
        {err && <div className="error"><Icon name="alert" />{err}</div>}
        <div className="row2">
          <label className="field"><span>Booking reference</span><input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="FS-2026-000123" /></label>
          <label className="field"><span>Mobile number used to book</span><input className="input" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="0917 123 4567" /></label>
        </div>
        <button className="btn btn-gold" type="submit"><Icon name="search" />Find my booking</button>
        {sample && <p className="mini" style={{ marginTop: 10 }}>Demo: <button type="button" className="linkbtn" onClick={() => { setRef(sample.ref); setMobile(sample.contact.mobile); }}>{sample.ref} · {sample.contact.mobile}</button></p>}
      </form>
    </div></div>
  );
}

export function TicketCard({ state, b, trip }) {
  const c = clsOf(state, trip.cls);
  const bus = busOf(state, trip.ops.busId);
  const st = bookingStatus(state, b);
  return (
    <div className="eticket">
      <div className="et-h"><BrandLockup brand={state.brand} light small /><span className="et-ref">{b.ref}</span></div>
      <div className="et-route">
        <div><small>{fmtDate(trip.date, { weekday: 'short', month: 'short', day: 'numeric' })}</small><b>{fmtTime(trip.time)}</b><span>{tName(state, trip.fromId)}</span></div>
        <div className="et-mid"><Icon name="bus" /><small>{c.name}</small></div>
        <div className="r"><small>Arrives about</small><b>{fmtTime(trip.eta)}</b><span>{tName(state, trip.toId)}</span></div>
      </div>
      <div className="et-body">
        <div className="et-qr">{['confirmed', 'boarded'].includes(st) ? <QrCode text={`${b.ref}|${trip.id}`} size={150} /> : <div className="et-noqr"><Icon name={st === 'reserved' ? 'clock' : 'x'} />{st === 'reserved' ? 'Pay to get the boarding QR' : BOOKING_STATUS[st]?.label}</div>}<small>Show this at the gate</small></div>
        <div className="et-info">
          <div><span>Status</span><StatusPill status={st} map={BOOKING_STATUS} /></div>
          <div><span>Seats</span><b>{b.pax.map((p) => p.seat).join(', ')}</b></div>
          <div><span>Bus no.</span><b>{bus ? bus.bodyNo : 'Assigned on the day'}</b></div>
          <div><span>Gate</span><b>{trip.ops.gate || '—'}</b></div>
          <div className="wide"><span>Passengers</span>{b.pax.map((p) => <b key={p.seat} className="et-pax">{p.seat} · {p.name} <small>{PAX_TYPES[p.type]}{p.type !== 'regular' ? ' · bring ID' : ''}</small></b>)}</div>
        </div>
      </div>
      <div className="et-f"><span>Be at {tName(state, trip.fromId)} terminal 30 minutes before departure.</span><b>{peso(b.total)}</b></div>
    </div>
  );
}

export function Ticket() {
  const { ref } = useParams();
  const [params] = useSearchParams();
  const { state, update, toast } = useStore();
  const [modal, setModal] = useState(null);
  const b = state.bookings.find((x) => x.ref === ref);
  if (!b) return <div className="wrap" style={{ padding: '60px 0' }}><div className="empty"><Icon name="ticket" />Booking not found. <Link to="/manage">Look it up again</Link></div></div>;
  const trip = getTrip(state, b.tripId);
  const st = bookingStatus(state, b);
  const tst = tripStatus(trip);
  const isNew = params.get('new') === '1';

  const cal = () => {
    const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Five Star bus ${tName(state, trip.fromId)} → ${tName(state, trip.toId)} (${b.ref})`)}&dates=${f(trip.departAt)}/${f(trip.eta)}&details=${encodeURIComponent(`Seats ${b.pax.map((p) => p.seat).join(', ')}. Be at the terminal 30 minutes early.`)}`;
    window.open(url, '_blank', 'noreferrer');
  };

  return (
    <div className="ticket-page">
      <div className="wrap tp">
        <div>
          {isNew && <div className="okbox big"><Icon name="check" /><div><b>{b.status === 'reserved' ? 'Seats reserved!' : 'You\'re booked!'}</b><span>{b.status === 'reserved' ? `Pay at the ${tName(state, trip.fromId)} counter to get your boarding QR.` : `We sent the e-ticket to ${b.contact.mobile}${b.contact.email ? ` and ${b.contact.email}` : ''}.`}</span></div></div>}
          <TicketCard state={state} b={b} trip={trip} />
          <div className="tp-acts">
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}><Icon name="download" />Save as PDF</button>
            <button type="button" className="btn btn-ghost" onClick={cal}><Icon name="calendar" />Add to calendar</button>
            <Link className="btn btn-ghost" to={`/track?ref=${b.ref}`}><Icon name="nav" />Track bus</Link>
            <Link className="btn btn-ghost" to="/app"><Icon name="smartphone" />Open in the app</Link>
          </div>
        </div>
        <aside className="tp-side">
          <div className="panel-s">
            <h3>Trip status</h3>
            <div className={`tstat ${tst}`}><Icon name={TRIP_STATUS[tst].icon} /><div><b>{tst === 'scheduled' ? 'On schedule' : TRIP_STATUS[tst].label}{trip.ops.delay && tst !== 'arrived' ? ` · ${trip.ops.delay} min late` : ''}</b><span>{tst === 'scheduled' || tst === 'delayed' ? <>Departs <Countdown to={trip.etd} /></> : tst === 'boarding' ? `Boarding at ${trip.ops.gate || 'the gate'}` : tst === 'departed' ? `Arrives about ${fmtTime(trip.eta)}` : 'Trip finished'}</span></div></div>
            {trip.ops.note && <p className="mini">{trip.ops.note}</p>}
          </div>
          <div className="panel-s">
            <h3>Manage</h3>
            {st === 'reserved' && <button type="button" className="btn btn-gold btn-block" onClick={() => setModal('pay')}><Icon name="card" />Pay now · {peso(b.total)}</button>}
            {canRebook(state, b, trip) && <button type="button" className="btn btn-ghost btn-block" onClick={() => setModal('rebook')}><Icon name="refresh" />Change trip</button>}
            {(canRefund(state, b, trip) || st === 'reserved') && <button type="button" className="btn btn-ghost btn-block" onClick={() => setModal('cancel')}><Icon name="x" />{st === 'reserved' ? 'Cancel reservation' : 'Cancel & refund'}</button>}
            {!canRebook(state, b, trip) && !canRefund(state, b, trip) && st !== 'reserved' && <p className="mini">{['confirmed'].includes(st) ? `Changes close ${setting(state, 'booking.changes.rebookHours')} hours before departure. Please go to the terminal counter.` : 'This booking can no longer be changed.'}</p>}
            <div className="sum-row" style={{ marginTop: 10 }}><span>Paid with</span><b>{PAY_LABEL[b.pay.method]}{b.pay.status === 'refunded' ? ' · refunded' : b.pay.status === 'unpaid' ? ' · unpaid' : ''}</b></div>
            {b.refund ? <div className="sum-row"><span>Refund</span><b>{peso(b.refund)}</b></div> : null}
          </div>
          <div className="panel-s">
            <h3>History</h3>
            {b.history.length ? b.history.map((h, i) => <div className="hist" key={i}><b>{h.what}</b><span>{new Date(h.at).toLocaleString('en-PH')} · {h.by}</span></div>) : <p className="mini">Booked {new Date(b.createdAt).toLocaleString('en-PH')}.</p>}
          </div>
        </aside>
      </div>

      {modal === 'pay' && <PayMongo amount={b.total} method="gcash" onCancel={() => setModal(null)} onPaid={() => { update((d) => payReservation(d, b.ref, 'gcash')); setModal(null); toast('Paid. Your boarding QR is ready.'); }} />}
      {modal === 'rebook' && <Rebook b={b} trip={trip} onClose={() => setModal(null)} />}
      {modal === 'cancel' && (
        <Modal title={st === 'reserved' ? 'Cancel reservation' : 'Cancel and refund'} onClose={() => setModal(null)} footer={<><button type="button" className="btn-a b-ghost" onClick={() => setModal(null)}>Keep my booking</button><button type="button" className="btn-a b-red" onClick={() => { const amt = update((d) => cancelBooking(d, b.ref, { full: trip.ops.status === 'cancelled' })); setModal(null); toast(amt ? `Refund of ${peso(amt)} started. It reaches your ${PAY_LABEL[b.pay.method]} account in 3–7 banking days.` : 'Reservation cancelled. The seats are free again.'); }}>Confirm</button></>}>
          {st === 'reserved' ? <p>The seats go back on sale right away.</p> : <p>You will get back <b>{trip.ops.status === 'cancelled' ? peso(b.total) : peso(Math.round(b.fare * Number(setting(state, 'booking.changes.refundPercent'))) / 100)}</b> ({trip.ops.status === 'cancelled' ? 'full refund, trip cancelled by Five Star' : `${setting(state, 'booking.changes.refundPercent')}% of the fare; the convenience fee is not refunded`}). Refunds go back to the same {PAY_LABEL[b.pay.method]} account through PayMongo.</p>}
          <p className="mini">{hoursBefore(trip) > 0 ? `Departure in ${Math.floor(hoursBefore(trip))} hours.` : ''}</p>
        </Modal>
      )}
    </div>
  );
}

export function Rebook({ b, trip, onClose, by }) {
  const { state, update, toast } = useStore();
  const [date, setDate] = useState(trip.date >= todayYmd() ? trip.date : todayYmd());
  const [sel, setSel] = useState(null);
  const options = tripsOn(state, date, { from: trip.fromId, to: trip.toId }).filter((t) => t.id !== trip.id && !saleClosed(state, t) && seatsLeft(state, t) >= b.pax.length);
  const fee = Number(setting(state, 'booking.changes.rebookFee')) * b.pax.length;
  const newFare = sel ? b.pax.reduce((s, p) => s + paxFare(state, sel, p.type).fare, 0) : 0;
  const due = fee + Math.max(0, newFare - b.fare);
  const go = () => {
    const seats = update((d) => autoSeats(d, sel, b.pax.length, { ignoreRef: b.ref }));
    update((d) => rebook(d, b.ref, sel, seats, by));
    toast(`Trip changed to ${fmtDate(sel.date)} ${fmtTime(sel.time)}, seats ${seats.join(', ')}. ${peso(due)} paid (simulated).`);
    onClose();
  };
  return (
    <Modal title="Change trip" width={620} onClose={onClose} footer={<><button type="button" className="btn-a b-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn-a b-navy" disabled={!sel} onClick={go}>Change and pay {peso(due)}</button></>}>
      <label className="field" style={{ maxWidth: 220 }}><span>New date</span><input className="input" type="date" min={todayYmd()} value={date} onChange={(e) => { setDate(e.target.value); setSel(null); }} /></label>
      <div className="rb-list">
        {options.map((t) => <button type="button" key={t.id} className={`rb ${sel?.id === t.id ? 'on' : ''}`} onClick={() => setSel(t)}><b>{fmtTime(t.time)}</b><span>{clsOf(state, t.cls).name}</span><span className="mini">{seatsLeft(state, t)} seats</span></button>)}
        {!options.length && <p className="mini">No trips with enough free seats on this date.</p>}
      </div>
      <p className="mini" style={{ marginTop: 10 }}>Change fee {peso(fee)} ({peso(setting(state, 'booking.changes.rebookFee'))} per seat){sel && newFare > b.fare ? ` + fare difference ${peso(newFare - b.fare)}` : ''}. Seats are assigned from the front; you can ask the counter to move you.</p>
    </Modal>
  );
}
