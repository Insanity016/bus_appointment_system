import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { setting, useStore } from '../lib/store.jsx';
import { addDays, ymd } from '../lib/data.js';
import { createBooking, holdSeats, releaseHold, sendOtp } from '../lib/booking.js';
import { PAX_TYPES, PAY_LABEL, clsOf, fmtDate, fmtDur, fmtTime, isPriority, normMobile, paxFare, peso, randomCode, saleClosed, seatList, seatsLeft, tName, takenSeats, todayYmd, tripStatus, tripsOn } from '../lib/trips.js';
import { SeatLegend, SeatMap } from '../shared.jsx';
import TripSearch from './TripSearch.jsx';
import { searchUrl } from './util.js';

const AMENITY_ICON = { 'Air-conditioned': 'snow', 'On-board toilet': 'toilet', 'USB charging': 'plug', 'Free Wi-Fi': 'wifi', 'Power outlet & USB': 'plug', 'Reclining seats': 'seat', 'Wider reclining seats': 'seat', 'Extra-wide seats with leg rest': 'seat', 'Blanket and pillow': 'moon', 'Snack and water': 'gift', 'CCTV on board': 'eye' };
const PERIODS = [['all', 'Any time'], ['early', 'Early 12–6 AM'], ['morning', 'Morning 6–12'], ['afternoon', 'Afternoon 12–6'], ['night', 'Night 6–12']];
const inPeriod = (t, p) => { const h = Number(t.slice(0, 2)); return p === 'all' || (p === 'early' && h < 6) || (p === 'morning' && h >= 6 && h < 12) || (p === 'afternoon' && h >= 12 && h < 18) || (p === 'night' && h >= 18); };

export function TripRow({ state, trip, onSelect, selected }) {
  const c = clsOf(state, trip.cls);
  const closed = saleClosed(state, trip);
  const left = seatsLeft(state, trip);
  const nextDay = trip.eta.getDate() !== trip.departAt.getDate();
  return (
    <div className={`trip ${selected ? 'sel' : ''} ${closed || !left ? 'off' : ''}`}>
      <div className="tr-time">
        <div><b>{fmtTime(trip.time)}</b><span>{tName(state, trip.fromId)}</span></div>
        <div className="tr-dur"><span>{fmtDur(trip.mins)}</span><i /><small>via {trip.route.via}</small></div>
        <div><b>{fmtTime(trip.eta)}{nextDay && <sup>+1</sup>}</b><span>{tName(state, trip.toId)}</span></div>
      </div>
      <div className="tr-cls">
        <span className="cls-badge" style={{ '--c': c.color }}>{c.name}</span>
        <div className="amen">{c.amenities.slice(0, 4).map((a) => <span key={a} title={a}><Icon name={AMENITY_ICON[a] || 'check'} /></span>)}</div>
        {trip.ops.delay ? <span className="st s-warn"><Icon name="alert" />Delayed {trip.ops.delay} min</span> : null}
        {trip.extra && <span className="st s-info"><Icon name="plus" />Extra trip</span>}
      </div>
      <div className="tr-seats">{left ? <><b className={left <= 8 ? 'low' : ''}>{left}</b> seats left</> : <b className="low">Full</b>}</div>
      <div className="tr-buy">
        <b>{peso(paxFare(state, trip).fare)}</b>
        {closed || !left ? <span className="mini">{left ? closed : 'Sold out'}</span> : <button type="button" className="btn btn-gold btn-sm" onClick={() => onSelect(trip)}>{selected ? 'Selected' : 'Select'}</button>}
      </div>
    </div>
  );
}

export default function Book() {
  const { state, update, toast } = useStore();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const q = { from: params.get('from'), to: params.get('to'), date: params.get('date') || todayYmd(), pax: Number(params.get('pax')) || 1 };
  const [cls, setCls] = useState('all');
  const [period, setPeriod] = useState('all');
  const [trip, setTrip] = useState(null);
  const [step, setStep] = useState('trips');
  const holdKey = useRef(`h${Math.random().toString(36).slice(2)}`).current;
  const [seats, setSeats] = useState([]);
  const [pax, setPax] = useState([]);
  const [err, setErr] = useState('');
  const me = state.passengerSession && state.passengers.find((p) => p.id === state.passengerSession.id);
  const [contact, setContact] = useState({ name: me?.name || '', mobile: me?.mobile || '', email: me?.email || '' });
  const [otp, setOtp] = useState({ sent: null, code: '', ok: !!me });
  const [method, setMethod] = useState('gcash');
  const [paying, setPaying] = useState(false);
  const [agree, setAgree] = useState(false);

  useEffect(() => () => update((d) => releaseHold(d, holdKey)), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const trips = useMemo(() => (q.from && q.to ? tripsOn(state, q.date, { from: q.from, to: q.to }) : []), [state, q.from, q.to, q.date]);
  const shown = trips.filter((t) => (cls === 'all' || t.cls === cls) && inPeriod(t.time, period) && !['arrived', 'departed'].includes(tripStatus(t)));
  const strip = Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(`${q.date}T00:00`), i - 3))).filter((d) => d >= todayYmd());
  const minFare = (d) => { const list = tripsOn(state, d, { from: q.from, to: q.to }); return list.length ? Math.min(...list.map((t) => paxFare(state, t).fare)) : null; };
  const maxSeats = Number(setting(state, 'booking.general.maxSeats'));
  const choose = setting(state, 'booking.general.chooseSeat');
  const fee = Number(setting(state, 'booking.general.fee'));
  const pay = state.settings.integrations.paymongo;
  const reserveOn = state.settings.booking.reserve.enabled;
  const methods = ['gcash', 'maya', 'card', 'qrph'].filter((m) => pay[m]);

  // ---- step: trips
  const select = (t) => {
    setTrip(t); setSeats([]); setErr('');
    if (!choose) {
      const taken = takenSeats(state, t);
      const auto = seatList(clsOf(state, t.cls)).filter((s) => !taken.has(s) && !isPriority(state, s)).slice(0, q.pax);
      setSeats(auto);
      setPax(auto.map(() => ({ name: '', type: 'regular', idNo: '', pregnant: false })));
    } else {
      setPax([]);
    }
    setStep('seats');
  };

  const taken = trip ? takenSeats(state, trip, { ignoreRef: holdKey }) : new Set();
  const togglesSeat = (s) => {
    setErr('');
    if (seats.includes(s)) { const i = seats.indexOf(s); setSeats(seats.filter((x) => x !== s)); setPax(pax.filter((_, k) => k !== i)); return; }
    if (seats.length >= maxSeats) { setErr(`You can book up to ${maxSeats} seats at a time.`); return; }
    setSeats([...seats, s]);
    setPax([...pax, { name: pax.length === 0 && me ? me.name : '', type: 'regular', idNo: '', pregnant: false }]);
  };
  const setP = (i, k, v) => setPax(pax.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const idReq = setting(state, 'discounts.types.idRequired');
  const fares = trip ? pax.map((p) => paxFare(state, trip, p.type)) : [];
  const fareTotal = fares.reduce((s, f) => s + f.fare, 0);
  const feeTotal = fee * seats.length;

  const toContact = () => {
    if (!seats.length) { setErr('Pick at least one seat.'); return; }
    if (pax.some((p) => p.name.trim().length < 2)) { setErr('Enter the name of every passenger as it appears on an ID.'); return; }
    if (idReq && pax.some((p) => p.type !== 'regular' && !p.idNo.trim())) { setErr('Enter the ID number for each discounted passenger. Bring the same ID when boarding.'); return; }
    const pri = seats.filter((s) => isPriority(state, s)).length;
    const eligible = pax.filter((p) => ['senior', 'pwd'].includes(p.type) || p.pregnant).length;
    if (pri > eligible) { setErr('Front-row priority seats are kept for senior citizens, PWD and pregnant passengers. Please pick another seat or update the passenger type.'); return; }
    const e = update((d) => holdSeats(d, holdKey, trip, seats));
    if (e) { setErr(e); return; }
    setErr('');
    setStep('contact');
  };

  // ---- step: contact & OTP
  const sendCode = () => {
    if (normMobile(contact.mobile).length !== 11) { setErr('Enter an 11-digit mobile number (09xx xxx xxxx).'); return; }
    const code = randomCode(Number(setting(state, 'security.otp.length')));
    update((d) => sendOtp(d, contact.mobile, code));
    setOtp({ sent: code, code: '', ok: false });
    setErr('');
    toast(`SMS to ${contact.mobile}: ${code} is your Five Star code. (Shown on screen in the prototype.)`, 'code');
  };
  const toPay = () => {
    if (contact.name.trim().length < 2) { setErr('Enter the name of the person booking.'); return; }
    if (!otp.ok) {
      if (!otp.sent) { setErr('Confirm your mobile number with the SMS code first.'); return; }
      if (otp.code !== otp.sent) { setErr('The code is incorrect. Check the SMS and try again.'); return; }
      setOtp({ ...otp, ok: true });
    }
    if (!agree) { setErr('Please accept the privacy notice and terms of carriage.'); return; }
    setErr('');
    setStep('pay');
  };

  // ---- step: pay
  const finish = (m) => {
    const b = update((d) => createBooking(d, { trip, pax: pax.map((p, i) => ({ seat: seats[i], name: p.name.trim(), type: p.type, idNo: p.idNo.trim(), pregnant: p.pregnant })), contact: { ...contact, mobile: contact.mobile.trim() }, method: m, source: 'website', passengerId: me?.id || null, holdKey }));
    toast(m === 'terminal' ? `Seats reserved. Ref ${b.ref}. Pay at the ${tName(state, trip.fromId)} counter.` : `Payment received. Your e-ticket ${b.ref} was sent by SMS${contact.email ? ' and email' : ''}.`);
    nav(`/ticket/${b.ref}?new=1`);
  };

  const steps = [['trips', 'Trip'], ['seats', 'Seats & passengers'], ['contact', 'Contact'], ['pay', 'Payment']];
  const si = steps.findIndex((s) => s[0] === step);

  if (!q.from || !q.to) {
    return (
      <div className="page-hero"><div className="wrap">
        <h1>Book a trip</h1><p>Choose where you're going and when. Pick your seat on the next step.</p>
        <div className="search-card flat"><TripSearch /></div>
      </div></div>
    );
  }

  return (
    <div className="book">
      <div className="book-top">
        <div className="wrap">
          <TripSearch compact initial={q} key={`${q.from}${q.to}${q.date}${q.pax}`} onSearch={(x) => { setStep('trips'); setTrip(null); setParams({ from: x.from, to: x.to, date: x.date, pax: String(x.pax) }); }} />
        </div>
      </div>
      <div className="wrap">
        <ol className="steps">{steps.map(([k, l], i) => <li key={k} className={i < si ? 'done' : i === si ? 'on' : ''}><span>{i < si ? <Icon name="check" /> : i + 1}</span>{l}</li>)}</ol>
        {err && <div className="error"><Icon name="alert" />{err}</div>}

        {step === 'trips' && (
          <div className="results">
            <aside className="filters">
              <h4>Bus class</h4>
              <div className="chips col">
                <button type="button" className={`chip ${cls === 'all' ? 'on' : ''}`} onClick={() => setCls('all')}>All classes</button>
                {state.classes.filter((c) => c.on).map((c) => <button type="button" key={c.id} className={`chip ${cls === c.id ? 'on' : ''}`} onClick={() => setCls(c.id)}><i className="cdot" style={{ background: c.color }} />{c.name}</button>)}
              </div>
              <h4>Departure time</h4>
              <div className="chips col">{PERIODS.map(([k, l]) => <button type="button" key={k} className={`chip ${period === k ? 'on' : ''}`} onClick={() => setPeriod(k)}>{l}</button>)}</div>
              <div className="filter-note"><Icon name="shield" />Student, senior and PWD fares are 20% off. Choose the passenger type on the next step.</div>
            </aside>
            <div>
              <div className="datestrip">
                {strip.map((d) => {
                  const f = minFare(d);
                  return <button type="button" key={d} className={d === q.date ? 'on' : ''} onClick={() => setParams({ ...q, date: d, pax: String(q.pax) })}><b>{fmtDate(d)}</b><span>{f ? peso(f) : '—'}</span></button>;
                })}
              </div>
              <div className="res-h"><h2>{tName(state, q.from)} <Icon name="right" /> {tName(state, q.to)}</h2><span className="mini">{fmtDate(q.date, { weekday: 'long', month: 'long', day: 'numeric' })} · {shown.length} trips · {q.pax} passenger{q.pax > 1 ? 's' : ''}</span></div>
              {shown.map((t) => <TripRow key={t.id} state={state} trip={t} onSelect={select} selected={trip?.id === t.id} />)}
              {!shown.length && <div className="empty"><Icon name="bus" />No trips match. Try another date or time of day.</div>}
            </div>
          </div>
        )}

        {step !== 'trips' && trip && (
          <div className="checkout">
            <div>
              {step === 'seats' && (
                <div className="panel-s">
                  <div className="ps-h"><h2>{choose ? 'Choose your seats' : 'Your seats'}</h2><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStep('trips'); update((d) => releaseHold(d, holdKey)); }}><Icon name="left" />Change trip</button></div>
                  <div className="seat-step">
                    <div>
                      <SeatMap state={state} cls={trip.cls} taken={taken} picked={seats} onPick={choose ? togglesSeat : null} />
                      <SeatLegend />
                    </div>
                    <div className="paxes">
                      {!seats.length && <div className="hintbox"><Icon name="seat" />Tap a free seat on the bus to add a passenger. Seats with letters A and D are by the window.</div>}
                      {seats.map((s, i) => (
                        <div className="pax" key={s}>
                          <div className="pax-h"><span className="seatno">{s}</span><b>Passenger {i + 1}</b><span className="sp" /><span className="mini">{peso(fares[i]?.fare)}</span>{choose && <button type="button" className="btn-a b-ghost b-xs" onClick={() => togglesSeat(s)} aria-label={`Remove seat ${s}`}><Icon name="x" /></button>}</div>
                          <label className="field"><span>Full name (as on ID)</span><input className="input" value={pax[i]?.name || ''} onChange={(e) => setP(i, 'name', e.target.value)} placeholder="Juan Dela Cruz" /></label>
                          <div className="row2">
                            <label className="field"><span>Passenger type</span><select className="select" value={pax[i]?.type} onChange={(e) => setP(i, 'type', e.target.value)}>{Object.entries(PAX_TYPES).map(([k, l]) => <option key={k} value={k}>{l}{k !== 'regular' ? ` (−${state.settings.discounts.types[k]}%)` : ''}</option>)}</select></label>
                            {pax[i]?.type !== 'regular'
                              ? <label className="field"><span>{pax[i]?.type === 'student' ? 'School ID no.' : pax[i]?.type === 'senior' ? 'Senior citizen ID no.' : 'PWD ID no.'}</span><input className="input" value={pax[i]?.idNo || ''} onChange={(e) => setP(i, 'idNo', e.target.value)} /></label>
                              : <label className="field check"><input type="checkbox" checked={!!pax[i]?.pregnant} onChange={(e) => setP(i, 'pregnant', e.target.checked)} /><span>Pregnant (may use priority seats)</span></label>}
                          </div>
                        </div>
                      ))}
                      {seats.length > 0 && <button type="button" className="btn btn-gold btn-block" onClick={toContact}>Continue<Icon name="right" /></button>}
                      {me && me.saved.length > 0 && seats.length > 1 && (
                        <div className="mini" style={{ marginTop: 8 }}>Saved passengers: {me.saved.map((sp) => <button type="button" key={sp.name} className="linkbtn" onClick={() => { const i = pax.findIndex((p, k) => k > 0 && !p.name); if (i > 0) setPax(pax.map((p, k) => (k === i ? { ...p, name: sp.name, type: sp.type, idNo: sp.idNo } : p))); }}>{sp.name}</button>)}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {step === 'contact' && (
                <div className="panel-s narrow">
                  <div className="ps-h"><h2>Contact details</h2><button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('seats')}><Icon name="left" />Back</button></div>
                  <p className="mini" style={{ marginBottom: 12 }}>Your e-ticket and trip updates (delays, boarding gate) go to this mobile number.</p>
                  <label className="field"><span>Name of the person booking</span><input className="input" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></label>
                  <div className="row2">
                    <label className="field"><span>Mobile number</span><input className="input" inputMode="tel" value={contact.mobile} disabled={otp.ok && !!me} onChange={(e) => { setContact({ ...contact, mobile: e.target.value }); setOtp({ sent: null, code: '', ok: false }); }} placeholder="0917 123 4567" /></label>
                    <label className="field"><span>Email (optional, for the receipt)</span><input className="input" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></label>
                  </div>
                  {otp.ok ? <div className="okbox"><Icon name="check" />Mobile number confirmed{me ? ' (signed in)' : ''}.</div> : (
                    <div className="otp">
                      <button type="button" className="btn btn-ghost" onClick={sendCode}><Icon name="send" />{otp.sent ? 'Send a new code' : 'Send SMS code'}</button>
                      {otp.sent && <input className="input code" inputMode="numeric" maxLength={8} value={otp.code} onChange={(e) => setOtp({ ...otp, code: e.target.value.replace(/\D/g, '') })} placeholder="6-digit code" aria-label="SMS code" />}
                    </div>
                  )}
                  <label className="field check" style={{ marginTop: 12 }}><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I agree to the <Link to="/help">privacy notice</Link> and the <Link to="/help">terms of carriage</Link>, including the refund and change-trip rules.</span></label>
                  <button type="button" className="btn btn-gold btn-block" onClick={toPay}>Continue to payment<Icon name="right" /></button>
                </div>
              )}

              {step === 'pay' && (
                <div className="panel-s narrow">
                  <div className="ps-h"><h2>Payment</h2><button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('contact')}><Icon name="left" />Back</button></div>
                  <p className="mini" style={{ marginBottom: 12 }}>Your seats are held for {setting(state, 'booking.general.holdMinutes')} minutes while you pay. Card and e-wallet details are handled by PayMongo and never reach our server.</p>
                  <div className="paym">
                    {methods.map((m) => <button type="button" key={m} className={`pm ${method === m ? 'on' : ''}`} onClick={() => setMethod(m)}><span className={`pm-logo ${m}`}>{PAY_LABEL[m]}</span><small>{m === 'card' ? 'Visa, Mastercard' : m === 'qrph' ? 'Any bank or e-wallet app' : 'E-wallet'}</small></button>)}
                    {reserveOn && <button type="button" className={`pm ${method === 'terminal' ? 'on' : ''}`} onClick={() => setMethod('terminal')}><span className="pm-logo terminal">Pay at the terminal</span><small>Released {setting(state, 'booking.reserve.releaseMinutes')} min before departure if unpaid</small></button>}
                  </div>
                  {!pay.enabled && method !== 'terminal' && <p className="hint">PayMongo is not yet connected in Settings → Integrations, so the payment below is simulated.</p>}
                  <button type="button" className="btn btn-gold btn-block btn-lg" onClick={() => (method === 'terminal' ? finish('terminal') : setPaying(true))}>{method === 'terminal' ? 'Reserve seats' : `Pay ${peso(fareTotal + feeTotal)}`}</button>
                </div>
              )}
            </div>

            <aside className="summary">
              <h3>Trip summary</h3>
              <div className="sum-route"><div><b>{fmtTime(trip.time)}</b><span>{tName(state, trip.fromId)}</span></div><Icon name="bus" /><div><b>{fmtTime(trip.eta)}</b><span>{tName(state, trip.toId)}</span></div></div>
              <div className="sum-row"><span>Date</span><b>{fmtDate(trip.date, { weekday: 'short', month: 'long', day: 'numeric' })}</b></div>
              <div className="sum-row"><span>Class</span><b>{clsOf(state, trip.cls).name}</b></div>
              <div className="sum-row"><span>Seats</span><b>{seats.join(', ') || '—'}</b></div>
              <hr />
              {pax.map((p, i) => <div className="sum-row" key={i}><span>{p.name || `Passenger ${i + 1}`} · {PAX_TYPES[p.type]}</span><b>{peso(fares[i]?.fare)}</b></div>)}
              {fee > 0 && seats.length > 0 && <div className="sum-row"><span>Online convenience fee</span><b>{peso(feeTotal)}</b></div>}
              <div className="sum-total"><span>Total</span><b>{peso(fareTotal + feeTotal)}</b></div>
              <p className="mini"><Icon name="refresh" /> Change trip until {setting(state, 'booking.changes.rebookHours')} h before ({peso(setting(state, 'booking.changes.rebookFee'))}/seat). Refund {setting(state, 'booking.changes.refundPercent')}% until {setting(state, 'booking.changes.refundHours')} h before.</p>
            </aside>
          </div>
        )}
      </div>

      {paying && <PayMongo amount={fareTotal + feeTotal} method={method} onCancel={() => setPaying(false)} onPaid={() => { setPaying(false); finish(method); }} />}
    </div>
  );
}

/** Simulated PayMongo checkout. */
export function PayMongo({ amount, method, onCancel, onPaid }) {
  const [stage, setStage] = useState('auth');
  return (
    <div className="modal-bg">
      <div className="modal paymongo" role="dialog" aria-modal="true" aria-label="Payment">
        <div className="pmg-h"><span className={`pm-logo ${method}`}>{PAY_LABEL[method]}</span><span className="mini">Secured by PayMongo · test mode</span></div>
        <div className="modal-b" style={{ textAlign: 'center' }}>
          {stage === 'auth' ? (
            <>
              <p className="mini">Merchant</p><b>Five Star Bus Co., Inc.</b>
              <div className="pmg-amt">{peso(amount)}</div>
              <p className="mini" style={{ marginBottom: 14 }}>{method === 'card' ? 'Card number 4343 4343 4343 4345 · 12/30 · 123 (test card)' : method === 'qrph' ? 'Scan the QR Ph code with any banking or e-wallet app.' : `You will be asked to log in to ${PAY_LABEL[method]} and approve the payment.`}</p>
              <button type="button" className="btn btn-blue btn-block" onClick={() => { setStage('wait'); setTimeout(onPaid, 1100); }}>Authorize payment</button>
              <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={onCancel}>Cancel</button>
            </>
          ) : (
            <div style={{ padding: '30px 0' }}><div className="spinner" /><p style={{ marginTop: 14 }}>Confirming payment…</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

export { searchUrl };
