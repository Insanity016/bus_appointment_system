import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { audit, setting, useStore } from '../lib/store.jsx';
import { sendOtp } from '../lib/booking.js';
import { BOOKING_STATUS, PAX_TYPES, bookingStatus, fmtDate, fmtTime, getTrip, normMobile, peso, randomCode, tName } from '../lib/trips.js';
import { StatusPill, Toggle } from '../components.jsx';
import { DEMO_PASSENGER } from '../lib/seed.js';

/** Passenger sign-in with mobile number + SMS code (used by the website and the app). */
export function PassengerLogin({ onDone, compact }) {
  const { state, update, toast } = useStore();
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const known = state.passengers.find((p) => normMobile(p.mobile) === normMobile(mobile));
  const send = (e) => {
    e.preventDefault();
    if (normMobile(mobile).length !== 11) { setErr('Enter an 11-digit mobile number.'); return; }
    const c = randomCode(Number(setting(state, 'security.otp.length')));
    update((d) => sendOtp(d, mobile, c));
    setSent(c); setErr('');
    toast(`SMS to ${mobile}: ${c} is your Five Star code. (Shown on screen in the prototype.)`, 'code');
  };
  const verify = (e) => {
    e.preventDefault();
    if (code !== sent) { setErr('The code is incorrect.'); return; }
    if (!known && name.trim().length < 2) { setErr('Enter your name to create your account.'); return; }
    update((d) => {
      let p = d.passengers.find((x) => normMobile(x.mobile) === normMobile(mobile));
      if (!p) {
        p = { id: `p${d.passengers.length + 1}`, name: name.trim(), mobile, email: '', points: 0, createdAt: new Date().toISOString(), saved: [], prefs: { sms: true, email: true, promos: false } };
        d.passengers.push(p);
        audit(d, 'passenger.registered', `Passenger account created for ${mobile}`, { actor: name.trim() });
      }
      d.bookings.forEach((b) => { if (!b.passengerId && normMobile(b.contact.mobile) === normMobile(mobile)) b.passengerId = p.id; });
      d.passengerSession = { id: p.id, name: p.name, at: new Date().toISOString() };
    });
    onDone?.();
  };
  return (
    <div className={compact ? '' : 'panel-s narrow'}>
      {!compact && <><h2>Sign in</h2><p className="mini" style={{ marginBottom: 14 }}>No password needed: we text you a one-time code. New here? The same steps create your account.</p></>}
      {err && <div className="error"><Icon name="alert" />{err}</div>}
      {!sent ? (
        <form onSubmit={send}>
          <label className="field"><span>Mobile number</span><input className="input" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="0917 123 4567" /></label>
          <button className="btn btn-gold btn-block" type="submit"><Icon name="send" />Send code</button>
          <p className="mini" style={{ marginTop: 10 }}>Demo passenger: <button type="button" className="linkbtn" onClick={() => setMobile(DEMO_PASSENGER.mobile)}>{DEMO_PASSENGER.mobile}</button></p>
        </form>
      ) : (
        <form onSubmit={verify}>
          {!known && <label className="field"><span>Your name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>}
          <label className="field"><span>Code sent to {mobile}</span><input className="input code" inputMode="numeric" autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></label>
          <button className="btn btn-gold btn-block" type="submit">Verify and sign in</button>
          <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => { setSent(null); setCode(''); }}>Use another number</button>
        </form>
      )}
    </div>
  );
}

export default function Account() {
  const { state, update, toast } = useStore();
  const [tab, setTab] = useState('trips');
  const s = state.passengerSession;
  const me = s && state.passengers.find((p) => p.id === s.id);
  if (!me) return <div className="page-hero"><div className="wrap"><PassengerLogin /></div></div>;
  const mine = state.bookings.filter((b) => b.passengerId === me.id).map((b) => ({ b, trip: getTrip(state, b.tripId) })).filter((x) => x.trip);
  const upcoming = mine.filter(({ b, trip }) => trip.eta > new Date() && ['confirmed', 'reserved', 'boarded'].includes(b.status)).sort((a, b) => a.trip.departAt - b.trip.departAt);
  const past = mine.filter((x) => !upcoming.includes(x)).sort((a, b) => b.trip.departAt - a.trip.departAt);
  const set = (fn) => update((d) => fn(d.passengers.find((p) => p.id === me.id)));
  const Row = ({ b, trip }) => (
    <Link to={`/ticket/${b.ref}`} className="my-trip">
      <div className="mt-date"><b>{fmtDate(trip.date, { day: 'numeric' })}</b><span>{fmtDate(trip.date, { month: 'short' })}</span></div>
      <div className="mt-main"><b>{tName(state, trip.fromId)} → {tName(state, trip.toId)}</b><span>{fmtTime(trip.time)} · seats {b.pax.map((p) => p.seat).join(', ')} · {b.ref}</span></div>
      <StatusPill status={bookingStatus(state, b)} map={BOOKING_STATUS} />
      <Icon name="next" />
    </Link>
  );
  return (
    <div className="wrap acct">
      <div className="acct-h">
        <div><span className="kicker">My account</span><h1>Hi, {me.name.split(' ')[0]}!</h1><span className="mini">{me.mobile}</span></div>
        <div className="points"><Icon name="gift" /><div><b>{me.points.toLocaleString()}</b><span>Star Points <span className="phase">P3</span></span></div></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => update((d) => { d.passengerSession = null; })}><Icon name="logout" />Sign out</button>
      </div>
      <div className="tabs">{[['trips', 'My trips'], ['saved', 'Saved passengers'], ['profile', 'Profile & privacy']].map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'trips' && (
        <>
          <h3 className="acct-sub">Upcoming</h3>
          {upcoming.length ? upcoming.map((x) => <Row key={x.b.ref} {...x} />) : <div className="empty"><Icon name="ticket" />No upcoming trips. <Link to="/book">Book one</Link></div>}
          <h3 className="acct-sub">Past trips</h3>
          {past.map((x) => <Row key={x.b.ref} {...x} />)}
        </>
      )}
      {tab === 'saved' && (
        <div className="panel-s narrow">
          <p className="mini" style={{ marginBottom: 10 }}>Family members you often travel with. Pick them when booking instead of typing again.</p>
          {me.saved.map((p, i) => <div className="al" key={i}><Icon name="user" /><div style={{ flex: 1 }}><b>{p.name}</b><span>{PAX_TYPES[p.type]}{p.idNo ? ` · ${p.idNo}` : ''}</span></div><button type="button" className="btn-a b-ghost b-xs" onClick={() => set((m) => { m.saved.splice(i, 1); })}><Icon name="trash" /></button></div>)}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { const n = window.prompt('Name of the passenger'); if (n) set((m) => { m.saved.push({ name: n, type: 'regular', idNo: '' }); }); }}><Icon name="plus" />Add passenger</button>
        </div>
      )}
      {tab === 'profile' && (
        <div className="panel-s narrow">
          <label className="field"><span>Name</span><input className="input" value={me.name} onChange={(e) => set((m) => { m.name = e.target.value; })} /></label>
          <label className="field"><span>Email</span><input className="input" value={me.email} onChange={(e) => set((m) => { m.email = e.target.value; })} /></label>
          {[['sms', 'Trip updates by SMS (tickets, delays, boarding)'], ['email', 'E-tickets and receipts by email'], ['promos', 'Promos and new routes (you can stop anytime)']].map(([k, l]) => <div className="srow" key={k}><div><b>{l}</b></div><Toggle on={me.prefs[k]} onChange={(v) => set((m) => { m.prefs[k] = v; })} label={l} /></div>)}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { update((d) => audit(d, 'privacy.request', `Data copy requested by ${me.mobile}`, { actor: me.name })); toast('Request received. We will email a copy of your data within 15 days.'); }}><Icon name="download" />Request a copy of my data</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { update((d) => audit(d, 'privacy.request', `Account deletion requested by ${me.mobile}`, { actor: me.name, severity: 'warning' })); toast('Deletion request received. Trip and payment records required by law are kept; everything else is removed.'); }}><Icon name="trash" />Delete my account</button>
          </div>
          <p className="mini" style={{ marginTop: 10 }}>Total spent on tickets: {peso(mine.reduce((s, x) => s + (x.b.pay.status === 'paid' ? x.b.total : 0), 0))}</p>
        </div>
      )}
    </div>
  );
}
