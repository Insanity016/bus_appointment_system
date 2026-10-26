import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { DEMO_PIN, addDays, ymd } from '../lib/data.js';
import { audit, setting, useStore } from '../lib/store.jsx';
import { autoSeats, boardTicket, createBooking } from '../lib/booking.js';
import { BOOKING_STATUS, PAX_TYPES, PAY_LABEL, TRIP_STATUS, bookingStatus, busOf, clsOf, destinationsFrom, fmtDate, fmtDur, fmtTime, getTrip, paxFare, peso, progress, saleClosed, seatList, seatsLeft, servedTerminals, tName, takenSeats, todayYmd, tripStatus, tripsOn } from '../lib/trips.js';
import { StatusPill, Toggle } from '../components.jsx';
import { Countdown, Mark, NetworkMap, QrCode, SeatMap } from '../shared.jsx';
import { PassengerLogin } from '../site/Account.jsx';
import { manifest } from '../admin/Boarding.jsx';

export default function MobileApp() {
  const { pathname } = useLocation();
  const crew = pathname.startsWith('/app/crew');
  const [install, setInstall] = useState(null);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstall(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  return (
    <div className="mapp-page">
      <div className="mapp-side">
        <Link to="/" className="mini"><Icon name="left" />Back to the website</Link>
        <h1>{crew ? 'Crew app' : 'Five Star app'}</h1>
        <p>{crew ? 'For conductors and drivers, on the phone assigned to the bus: the trip manifest, QR boarding, roadside tickets, trip status and GPS. Works offline and syncs when there is signal.' : 'For passengers: book in seconds, keep e-tickets offline, track the bus, get delay and boarding alerts, earn Star Points.'}</p>
        <div className="seg-app">
          <Link to="/app" className={!crew ? 'on' : ''}><Icon name="user" />Passenger</Link>
          <Link to="/app/crew" className={crew ? 'on' : ''}><Icon name="steering" />Crew</Link>
        </div>
        <div className="mapp-notes">
          <div><Icon name="smartphone" /><span><b>Phase 1:</b> installable web app (PWA) from the website: home-screen icon, full screen, offline tickets. No app store needed.</span></div>
          <div><Icon name="download" /><span><b>Phase 2:</b> the same app published on Google Play and the App Store, with push notifications and background GPS for crew.</span></div>
          {install && <button type="button" className="btn btn-gold btn-sm" onClick={() => install.prompt()}><Icon name="download" />Install on this device</button>}
        </div>
        <p className="mini">On a phone, this page opens full screen. Demo: passenger <b>0917-555-0101</b> (code on screen) · crew <b>E-2002</b>, PIN <b>{DEMO_PIN}</b>.</p>
      </div>
      <div className="device"><div className="device-notch" /><div className="device-screen">{crew ? <CrewApp /> : <PassengerApp />}</div></div>
    </div>
  );
}

// ================================================================ passenger
function PassengerApp() {
  const { state } = useStore();
  const [tab, setTab] = useState('home');
  const [flow, setFlow] = useState(null);
  const [ticket, setTicket] = useState(null);
  const me = state.passengerSession && state.passengers.find((p) => p.id === state.passengerSession.id);
  if (flow) return <BookFlow q={flow} onClose={(ref) => { setFlow(null); if (ref) { setTicket(ref); setTab('tickets'); } }} />;
  if (ticket) return <TicketView refNo={ticket} onBack={() => setTicket(null)} />;
  return (
    <div className="ma">
      <div className="ma-body">
        {tab === 'home' && <AppHome me={me} onSearch={setFlow} onTicket={setTicket} go={setTab} />}
        {tab === 'tickets' && (me ? <MyTickets me={me} onOpen={setTicket} /> : <SignIn />)}
        {tab === 'track' && <AppTrack me={me} />}
        {tab === 'me' && (me ? <Me me={me} /> : <SignIn />)}
      </div>
      <nav className="ma-tabs">
        {[['home', 'home', 'Home'], ['tickets', 'ticket', 'Tickets'], ['track', 'nav', 'Track'], ['me', 'user', 'Me']].map(([k, i, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon name={i} />{l}</button>)}
      </nav>
    </div>
  );
}

function SignIn() {
  return <div className="ma-pad"><h2 className="ma-h">Sign in</h2><p className="mini" style={{ marginBottom: 12 }}>Your tickets, Star Points and saved passengers, on every device.</p><PassengerLogin compact /></div>;
}

function upcomingOf(state, me) {
  if (!me) return [];
  return state.bookings.filter((b) => b.passengerId === me.id && ['confirmed', 'reserved', 'boarded'].includes(b.status)).map((b) => ({ b, t: getTrip(state, b.tripId) })).filter((x) => x.t && x.t.eta > new Date()).sort((a, b) => a.t.departAt - b.t.departAt);
}

function AppHome({ me, onSearch, onTicket, go }) {
  const { state } = useStore();
  const all = servedTerminals(state);
  const [from, setFrom] = useState('cubao');
  const dests = destinationsFrom(state, from);
  const [to, setTo] = useState('dagupan');
  const [date, setDate] = useState(todayYmd());
  const [pax, setPax] = useState(1);
  const next = upcomingOf(state, me)[0];
  const advisory = state.posts.find((p) => p.type === 'advisory' && p.pinned);
  return (
    <>
      <div className="ma-hero">
        <div className="ma-top"><Mark brand={state.brand} size={32} /><span>{me ? `Hi, ${me.name.split(' ')[0]}!` : 'Magandang araw!'}</span><Icon name="bell" /></div>
        <h2>Where to today?</h2>
        <div className="ma-search">
          <label><small>From</small><select value={from} onChange={(e) => { setFrom(e.target.value); const d = destinationsFrom(state, e.target.value); if (!d.some((x) => x.id === to)) setTo(d[0]?.id); }}>{all.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <button type="button" className="ma-swap" onClick={() => { if (destinationsFrom(state, to).some((x) => x.id === from)) { setFrom(to); setTo(from); } }} aria-label="Swap"><Icon name="swap" /></button>
          <label><small>To</small><select value={to} onChange={(e) => setTo(e.target.value)}>{dests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <div className="ma-row">
            <label><small>Date</small><input type="date" min={todayYmd()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label><small>Pax</small><select value={pax} onChange={(e) => setPax(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select></label>
          </div>
          <button type="button" className="btn btn-gold btn-block" onClick={() => onSearch({ from, to, date, pax })}><Icon name="search" />Search buses</button>
        </div>
      </div>
      <div className="ma-pad">
        {next && (
          <button type="button" className="ma-next" onClick={() => onTicket(next.b.ref)}>
            <div className="mn-h"><span>Next trip · leaves <Countdown to={next.t.etd} /></span><StatusPill status={tripStatus(next.t)} map={TRIP_STATUS} /></div>
            <div className="mn-r"><div><b>{fmtTime(next.t.time)}</b><span>{tName(state, next.t.fromId)}</span></div><Icon name="bus" /><div><b>{fmtTime(next.t.eta)}</b><span>{tName(state, next.t.toId)}</span></div></div>
            <div className="mn-f"><span>{fmtDate(next.t.date)} · seats {next.b.pax.map((p) => p.seat).join(', ')}</span><span className="mn-qr"><Icon name="qr" />Show QR</span></div>
          </button>
        )}
        {advisory && <div className="ma-adv"><Icon name="megaphone" /><span>{advisory.title}</span></div>}
        <div className="ma-quick">
          {[['nav', 'Track bus', () => go('track')], ['ticket', 'My tickets', () => go('tickets')], ['package', 'Parcels', null, '/parcels'], ['users', 'Rent a bus', null, '/rent-a-bus']].map(([i, l, fn, href]) => (fn ? <button type="button" key={l} onClick={fn}><span><Icon name={i} /></span>{l}</button> : <a key={l} href={href} target="_blank" rel="noreferrer"><span><Icon name={i} /></span>{l}</a>))}
        </div>
        <h3 className="ma-sub">Popular</h3>
        <div className="ma-pop">{state.routes.filter((r) => r.featured).slice(0, 4).map((r) => <button type="button" key={r.id} onClick={() => onSearch({ from: r.from, to: r.to, date: todayYmd(), pax: 1 })}><b>{tName(state, r.from)} → {tName(state, r.to)}</b><span>{fmtDur(r.mins)} · from {peso(Math.min(...Object.values(r.fares)))}</span></button>)}</div>
      </div>
    </>
  );
}

function BookFlow({ q, onClose }) {
  const { state, update, toast } = useStore();
  const me = state.passengerSession && state.passengers.find((p) => p.id === state.passengerSession.id);
  const [step, setStep] = useState('list');
  const [trip, setTrip] = useState(null);
  const [seats, setSeats] = useState([]);
  const [pax, setPax] = useState([]);
  const [method, setMethod] = useState('gcash');
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(q.date);
  const trips = tripsOn(state, date, { from: q.from, to: q.to }).filter((t) => !['arrived', 'departed'].includes(tripStatus(t)));
  const taken = trip ? takenSeats(state, trip) : new Set();
  const pick = (s) => { if (seats.includes(s)) { const i = seats.indexOf(s); setSeats(seats.filter((x) => x !== s)); setPax(pax.filter((_, k) => k !== i)); } else if (seats.length < Number(setting(state, 'booking.general.maxSeats'))) { setSeats([...seats, s]); setPax([...pax, { name: seats.length === 0 && me ? me.name : '', type: 'regular', idNo: '' }]); } };
  const total = trip ? pax.reduce((s, p) => s + paxFare(state, trip, p.type).fare, 0) + Number(setting(state, 'booking.general.fee')) * seats.length : 0;
  const pay = () => {
    setBusy(true);
    setTimeout(() => {
      const b = update((d) => createBooking(d, { trip, pax: pax.map((p, i) => ({ seat: seats[i], name: p.name || me.name, type: p.type, idNo: p.idNo })), contact: { name: me.name, mobile: me.mobile, email: me.email }, method, source: 'app', passengerId: me.id }));
      toast(`Paid with ${PAY_LABEL[method]}. Ticket ${b.ref} saved in the app.`);
      onClose(b.ref);
    }, 900);
  };
  const back = () => (step === 'list' ? onClose() : setStep(step === 'pay' ? 'pax' : step === 'pax' ? 'seats' : 'list'));
  return (
    <div className="ma">
      <div className="ma-bar"><button type="button" onClick={back} aria-label="Back"><Icon name="left" /></button><div><b>{tName(state, q.from)} → {tName(state, q.to)}</b><small>{fmtDate(date)} · {q.pax} pax</small></div></div>
      <div className="ma-body ma-pad">
        {step === 'list' && (
          <>
            <div className="ma-dates">{Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(), i))).map((d) => <button type="button" key={d} className={d === date ? 'on' : ''} onClick={() => setDate(d)}><small>{fmtDate(d, { weekday: 'short' })}</small><b>{fmtDate(d, { day: 'numeric' })}</b></button>)}</div>
            {trips.map((t) => {
              const closed = saleClosed(state, t); const left = seatsLeft(state, t); const c = clsOf(state, t.cls);
              return (
                <button type="button" key={t.id} className="ma-trip" disabled={!!closed || !left} onClick={() => { setTrip(t); setSeats([]); setPax([]); setStep('seats'); }}>
                  <div><b>{fmtTime(t.time)}</b><span>{fmtDur(t.mins)} · arr. {fmtTime(t.eta)}</span></div>
                  <div><span className="cls-badge" style={{ '--c': c.color }}>{c.short}</span><span className={left < 9 ? 'low' : ''}>{closed || `${left} seats`}</span></div>
                  <b className="fare">{peso(paxFare(state, t).fare)}</b>
                </button>
              );
            })}
            {!trips.length && <p className="mini">No more trips on this date.</p>}
          </>
        )}
        {step === 'seats' && trip && (
          <>
            <p className="mini" style={{ marginBottom: 8 }}>Tap seats ({seats.length} selected). Front row is for senior, PWD and pregnant passengers.</p>
            <div style={{ display: 'grid', placeItems: 'center' }}><SeatMap state={state} cls={trip.cls} taken={taken} picked={seats} onPick={pick} compact /></div>
          </>
        )}
        {step === 'pax' && (!me ? <SignIn /> : (
          <>
            {seats.map((s, i) => (
              <div className="pax" key={s} style={{ marginBottom: 8 }}>
                <div className="pax-h"><span className="seatno">{s}</span><input className="input" value={pax[i].name} placeholder="Full name" onChange={(e) => setPax(pax.map((p, k) => (k === i ? { ...p, name: e.target.value } : p)))} /></div>
                <div className="row2"><select className="select" value={pax[i].type} onChange={(e) => setPax(pax.map((p, k) => (k === i ? { ...p, type: e.target.value } : p)))}>{Object.entries(PAX_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>{pax[i].type !== 'regular' && <input className="input" placeholder="ID no." value={pax[i].idNo} onChange={(e) => setPax(pax.map((p, k) => (k === i ? { ...p, idNo: e.target.value } : p)))} />}</div>
              </div>
            ))}
            {me.saved.length > 0 && <p className="mini">Saved: {me.saved.map((sp) => <button type="button" key={sp.name} className="linkbtn" onClick={() => { const i = pax.findIndex((p) => !p.name); if (i >= 0) setPax(pax.map((p, k) => (k === i ? { ...p, ...sp } : p))); }}>{sp.name} </button>)}</p>}
          </>
        ))}
        {step === 'pay' && (
          <>
            <div className="ma-sum"><div className="sum-row"><span>{fmtTime(trip.time)} · {clsOf(state, trip.cls).name}</span><b>{seats.join(', ')}</b></div><div className="sum-total"><span>Total</span><b>{peso(total)}</b></div></div>
            <div className="paym">{['gcash', 'maya', 'card', 'qrph'].map((m) => <button type="button" key={m} className={`pm ${method === m ? 'on' : ''}`} onClick={() => setMethod(m)}><span className={`pm-logo ${m}`}>{PAY_LABEL[m]}</span></button>)}</div>
          </>
        )}
      </div>
      {step !== 'list' && (
        <div className="ma-cta">
          {step === 'seats' && <button type="button" className="btn btn-gold btn-block" disabled={!seats.length} onClick={() => setStep('pax')}>Continue · {seats.length} seat{seats.length === 1 ? '' : 's'}</button>}
          {step === 'pax' && me && <button type="button" className="btn btn-gold btn-block" disabled={pax.some((p) => !p.name.trim() || (p.type !== 'regular' && !p.idNo.trim()))} onClick={() => setStep('pay')}>Continue to payment</button>}
          {step === 'pay' && <button type="button" className="btn btn-gold btn-block" disabled={busy} onClick={pay}>{busy ? 'Confirming payment…' : `Pay ${peso(total)}`}</button>}
        </div>
      )}
    </div>
  );
}

function MyTickets({ me, onOpen }) {
  const { state } = useStore();
  const list = state.bookings.filter((b) => b.passengerId === me.id).map((b) => ({ b, t: getTrip(state, b.tripId) })).filter((x) => x.t).sort((a, b) => b.t.departAt - a.t.departAt);
  const up = list.filter((x) => x.t.eta > new Date() && ['confirmed', 'reserved', 'boarded'].includes(x.b.status)).reverse();
  const past = list.filter((x) => !up.includes(x));
  const Row = ({ b, t }) => <button type="button" className="ma-tk" onClick={() => onOpen(b.ref)}><div className="mt-date"><b>{fmtDate(t.date, { day: 'numeric' })}</b><span>{fmtDate(t.date, { month: 'short' })}</span></div><div><b>{tName(state, t.fromId)} → {tName(state, t.toId)}</b><span>{fmtTime(t.time)} · {b.pax.map((p) => p.seat).join(', ')}</span></div><StatusPill status={bookingStatus(state, b)} map={BOOKING_STATUS} /></button>;
  return (
    <div className="ma-pad">
      <h2 className="ma-h">My tickets</h2>
      <div className="ma-off"><Icon name="check" />Saved on this phone · works without signal</div>
      <h3 className="ma-sub">Upcoming</h3>
      {up.length ? up.map((x) => <Row key={x.b.ref} {...x} />) : <p className="mini">No upcoming trips.</p>}
      <h3 className="ma-sub">Past</h3>
      {past.map((x) => <Row key={x.b.ref} {...x} />)}
    </div>
  );
}

function TicketView({ refNo, onBack }) {
  const { state } = useStore();
  const b = state.bookings.find((x) => x.ref === refNo);
  const t = b && getTrip(state, b.tripId);
  if (!t) return null;
  const st = bookingStatus(state, b);
  const bus = busOf(state, t.ops.busId);
  return (
    <div className="ma ma-dark">
      <div className="ma-bar dark"><button type="button" onClick={onBack} aria-label="Back"><Icon name="left" /></button><div><b>E-ticket</b><small>{b.ref}</small></div></div>
      <div className="ma-body ma-pad">
        <div className="ma-ticket">
          <div className="mtk-r"><div><small>{fmtDate(t.date)}</small><b>{fmtTime(t.time)}</b><span>{tName(state, t.fromId)}</span></div><Icon name="bus" /><div className="r"><small>{fmtDur(t.mins)}</small><b>{fmtTime(t.eta)}</b><span>{tName(state, t.toId)}</span></div></div>
          <div className="mtk-qr">{['confirmed', 'boarded'].includes(st) ? <QrCode text={`${b.ref}|${t.id}`} size={190} /> : <div className="et-noqr">{BOOKING_STATUS[st].label}</div>}<small>Turn up the screen brightness at the gate</small></div>
          <div className="mtk-g"><div><span>Seat</span><b>{b.pax.map((p) => p.seat).join(', ')}</b></div><div><span>Bus</span><b>{bus?.bodyNo || '—'}</b></div><div><span>Gate</span><b>{(t.ops.gate || '—').replace('Gate ', '')}</b></div><div><span>Class</span><b>{clsOf(state, t.cls).short}</b></div></div>
          <div className="mtk-st"><StatusPill status={tripStatus(t)} map={TRIP_STATUS} />{t.ops.delay ? <span className="st s-warn">{t.ops.delay} min late</span> : null}</div>
          {b.pax.map((p) => <div className="sum-row" key={p.seat}><span>{p.seat} · {p.name}</span><b>{PAX_TYPES[p.type]}</b></div>)}
        </div>
      </div>
    </div>
  );
}

function AppTrack({ me }) {
  const { state } = useStore();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(i); }, []);
  const mine = upcomingOf(state, me).map((x) => x.t);
  const live = useMemo(() => tripsOn(state, todayYmd()).filter((t) => tripStatus(t, now) === 'departed'), [state, now]);
  const t = mine.find((x) => tripStatus(x, now) === 'departed') || mine[0];
  return (
    <div className="ma-pad">
      <h2 className="ma-h">Track</h2>
      <div className="ma-map"><NetworkMap state={state} trips={t && tripStatus(t, now) === 'departed' ? [t] : live} selected={t?.toId} labels="hubs+sel" /></div>
      {t ? (
        <div className="ma-card">
          <b>{tName(state, t.fromId)} → {tName(state, t.toId)}</b>
          <span className="mini">{tripStatus(t, now) === 'departed' ? `On the road · ETA ${fmtTime(t.eta)}` : <>Your bus leaves <Countdown to={t.etd} /></>}</span>
          <div className="prog" style={{ marginTop: 8 }}><i style={{ width: `${progress(t, now) * 100}%` }} /></div>
          <span className="phase" style={{ color: 'var(--blue)' }}>Live GPS · Phase 3</span>
        </div>
      ) : <p className="mini">{live.length} Five Star buses on the road now. Sign in to follow your own trip.</p>}
    </div>
  );
}

function Me({ me }) {
  const { state, update } = useStore();
  const set = (fn) => update((d) => fn(d.passengers.find((p) => p.id === me.id)));
  return (
    <div className="ma-pad">
      <h2 className="ma-h">{me.name}</h2>
      <p className="mini">{me.mobile}</p>
      <div className="ma-points"><div><small>Star Points <span className="phase">P3</span></small><b>{me.points.toLocaleString()}</b><span>≈ {peso(Math.floor(me.points / 10))} off your next trip</span></div><Icon name="gift" size={34} /></div>
      <h3 className="ma-sub">Notifications</h3>
      {[['sms', 'Trip alerts (delay, gate, boarding)'], ['email', 'E-mail receipts'], ['promos', 'Promos and new routes']].map(([k, l]) => <div className="srow" key={k} style={{ gridTemplateColumns: '1fr auto' }}><div><b>{l}</b></div><Toggle on={me.prefs[k]} onChange={(v) => set((m) => { m.prefs[k] = v; })} label={l} /></div>)}
      <h3 className="ma-sub">Saved passengers</h3>
      {me.saved.map((p) => <div className="sum-row" key={p.name}><span>{p.name}</span><b>{PAX_TYPES[p.type]}</b></div>)}
      <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 16 }} onClick={() => update((d) => { d.passengerSession = null; })}><Icon name="logout" />Sign out</button>
      <p className="mini" style={{ marginTop: 8 }}>Privacy requests and account deletion: website → My account.</p>
    </div>
  );
}

// ================================================================ crew
const CHECKS = ['Tires and wheel nuts', 'Brakes and air pressure', 'Lights and signals', 'Aircon working', 'First-aid kit and fire extinguisher', 'CCTV recording', 'Clean cabin and toilet'];

function CrewApp() {
  const { state, update, toast } = useStore();
  const nav = useNavigate();
  const [empNo, setEmpNo] = useState('E-2002');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [tripId, setTripId] = useState(null);
  const session = state.crewSession;
  const me = session && state.crew.find((c) => c.id === session.id);

  if (!me) {
    return (
      <div className="ma ma-crew">
        <div className="ma-body ma-pad" style={{ paddingTop: 50 }}>
          <Mark brand={state.brand} size={56} />
          <h2 className="ma-h" style={{ marginTop: 14 }}>Crew sign-in</h2>
          <p className="mini" style={{ marginBottom: 14 }}>Employee number and 6-digit PIN. The phone is registered to the bus; lockout rules apply.</p>
          {err && <div className="error"><Icon name="alert" />{err}</div>}
          <label className="field"><span>Employee no.</span><input className="input" value={empNo} onChange={(e) => setEmpNo(e.target.value.toUpperCase())} /></label>
          <label className="field"><span>PIN</span><input className="input code" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></label>
          <button type="button" className="btn btn-gold btn-block" onClick={() => {
            const c = state.crew.find((x) => x.empNo === empNo.trim());
            if (!c || pin !== DEMO_PIN) { setErr('Employee number or PIN is incorrect.'); update((d) => audit(d, 'crew.login.failed', `Crew app sign-in failed for ${empNo}`, { actor: 'Crew app', severity: 'warning' })); return; }
            update((d) => { d.crewSession = { id: c.id, at: new Date().toISOString() }; audit(d, 'crew.login', `${c.empNo} ${c.name} signed in to the crew app`, { actor: c.name }); });
          }}>Sign in</button>
          <p className="mini" style={{ marginTop: 10 }}>Demo: E-2002 (conductor) or E-2001 (driver), PIN {DEMO_PIN}.</p>
          <button type="button" className="linkbtn" style={{ marginTop: 14 }} onClick={() => nav('/app')}>Passenger app</button>
        </div>
      </div>
    );
  }

  const assigned = [...tripsOn(state, todayYmd()), ...tripsOn(state, ymd(addDays(new Date(), 1)))].filter((t) => [t.ops.driverId, t.ops.driver2Id, t.ops.conductorId].includes(me.id));
  const trip = tripId && getTrip(state, tripId);
  if (trip) return <CrewTrip me={me} trip={trip} onBack={() => setTripId(null)} />;
  const others = tripsOn(state, todayYmd(), { from: 'cubao' }).filter((t) => ['scheduled', 'boarding', 'delayed'].includes(tripStatus(t))).slice(0, 4);
  return (
    <div className="ma ma-crew">
      <div className="ma-hero crew"><div className="ma-top"><Mark brand={state.brand} size={30} /><span>{me.name.split(' ')[0]} · {me.role === 'driver' ? 'Driver' : 'Conductor'} {me.empNo}</span><button type="button" onClick={() => update((d) => { d.crewSession = null; })} aria-label="Sign out"><Icon name="logout" /></button></div><h2>My trips</h2><p className="mini" style={{ color: '#C9D5F0' }}>{assigned.length} assigned today and tomorrow</p></div>
      <div className="ma-body ma-pad">
        {assigned.map((t) => <CrewTripRow key={t.id} t={t} onClick={() => setTripId(t.id)} />)}
        {!assigned.length && <p className="mini">No trips assigned to you yet.</p>}
        <h3 className="ma-sub">Demo: open another trip from Cubao</h3>
        {others.map((t) => <CrewTripRow key={t.id} t={t} onClick={() => { update((d) => { d.tripOps[t.id] = { ...(d.tripOps[t.id] || {}), [me.role === 'driver' ? 'driverId' : 'conductorId']: me.id }; }); toast('Assigned to you for the demo.'); setTripId(t.id); }} />)}
      </div>
    </div>
  );
}

function CrewTripRow({ t, onClick }) {
  const { state } = useStore();
  return <button type="button" className="ma-trip" onClick={onClick}><div><b>{fmtTime(t.time)}</b><span>{fmtDate(t.date)}</span></div><div><b style={{ fontSize: 13 }}>{tName(state, t.fromId)} → {tName(state, t.toId)}</b><span>bus {busOf(state, t.ops.busId)?.bodyNo || '—'} · {t.ops.gate || ''}</span></div><StatusPill status={tripStatus(t)} map={TRIP_STATUS} /></button>;
}

function CrewTrip({ me, trip, onBack }) {
  const { state, update, toast } = useStore();
  const [tab, setTab] = useState(me.role === 'driver' ? 'check' : 'scan');
  const [code, setCode] = useState('');
  const [last, setLast] = useState(null);
  const [road, setRoad] = useState({ to: trip.route.stops[0] || tName(state, trip.toId), type: 'regular', name: '' });
  const [incident, setIncident] = useState('');
  const st = tripStatus(trip);
  const rows = manifest(state, trip);
  const boarded = rows.filter((p) => p.boarded).length;
  const c = clsOf(state, trip.cls);
  const stops = [...(trip.dir === 'out' ? trip.route.stops : [...trip.route.stops].reverse()), tName(state, trip.toId)];
  const roadFare = Math.round((paxFare(state, trip, road.type).fare * (stops.indexOf(road.to) + 1)) / stops.length / 5) * 5;
  const checks = trip.ops.checklist || [];

  const setStatus = (s) => { update((d) => { d.tripOps[trip.id] = { ...(d.tripOps[trip.id] || {}), status: s }; audit(d, 'trip.status', `Crew app: ${trip.time} ${tName(d, trip.fromId)}→${tName(d, trip.toId)} ${TRIP_STATUS[s].label}`, { actor: me.name }); }); toast(TRIP_STATUS[s].label); };
  const scan = (v) => { const r = update((d) => boardTicket(d, v, trip.id, me.name)); setLast(r); setCode(''); };
  const sell = () => {
    const seat = update((d) => autoSeats(d, trip, 1))[0];
    if (!seat) { toast('The bus is full.', 'err'); return; }
    const b = update((d) => {
      const x = createBooking(d, { trip, pax: [{ seat, name: road.name || 'Roadside passenger', type: road.type, idNo: road.type !== 'regular' ? 'checked on board' : '' }], contact: { name: road.name || 'Roadside passenger', mobile: '', email: '' }, method: 'cash', source: 'conductor', by: me.name });
      x.fare = roadFare; x.pax[0].fare = roadFare; x.total = roadFare; x.status = 'boarded'; x.pax[0].boarded = true; x.dropOff = road.to;
      let r = d.remittances.find((y) => y.tripId === trip.id && y.status === 'pending');
      if (!r) { r = { id: Date.now(), tripId: trip.id, conductorId: me.id, roadside: 0, expected: 0, counted: null, status: 'pending', at: null }; d.remittances.unshift(r); }
      r.roadside += 1; r.expected += roadFare;
      return x;
    });
    toast(`Ticket ${b.ref} · seat ${seat} · ${peso(roadFare)} cash`);
    setRoad({ ...road, name: '' });
  };
  return (
    <div className="ma ma-crew">
      <div className="ma-bar dark"><button type="button" onClick={onBack} aria-label="Back"><Icon name="left" /></button><div><b>{fmtTime(trip.time)} {tName(state, trip.fromId)} → {tName(state, trip.toId)}</b><small>bus {busOf(state, trip.ops.busId)?.bodyNo || '—'} · {boarded}/{rows.length} boarded · {seatList(c).length - takenSeats(state, trip).size} empty</small></div></div>
      <div className="crew-status">
        <StatusPill status={st} map={TRIP_STATUS} />
        {['scheduled', 'delayed'].includes(st) && <button type="button" className="btn btn-sm btn-blue" onClick={() => setStatus('boarding')}>Start boarding</button>}
        {st === 'boarding' && <button type="button" className="btn btn-sm btn-gold" onClick={() => setStatus('departed')}>Depart</button>}
        {st === 'departed' && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setStatus('arrived')}>Arrived</button>}
      </div>
      <div className="ma-seg">{[['scan', 'Scan'], ['list', 'Manifest'], ['road', 'Roadside'], ['check', 'Checklist'], ['more', 'More']].map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="ma-body ma-pad">
        {tab === 'scan' && (
          <>
            <div className="scanner"><Icon name="scan" size={60} /><span>Point the camera at the passenger's QR</span></div>
            <button type="button" className="btn btn-gold btn-block" onClick={() => { const n = state.bookings.find((b) => b.tripId === trip.id && b.status === 'confirmed'); if (n) scan(`${n.ref}|${trip.id}`); else toast('No unscanned e-tickets on this trip.', 'err'); }}><Icon name="qr" />Simulate scan</button>
            <div className="otp" style={{ marginTop: 8 }}><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="or type FS-… ref" /><button type="button" className="btn btn-ghost btn-sm" onClick={() => code && scan(code)}>Check</button></div>
            {last && <div className={last.ok ? 'okbox' : 'error'} style={{ marginTop: 10 }}><Icon name={last.ok ? 'check' : 'alert'} />{last.msg}</div>}
            <p className="mini" style={{ marginTop: 8 }}>Works offline: tickets are checked against the manifest downloaded before the trip and synced later.</p>
          </>
        )}
        {tab === 'list' && rows.map((p) => <div className="sum-row" key={p.seat}><span><b>{p.seat}</b> {p.name}{p.type !== 'regular' ? ` · ${PAX_TYPES[p.type]} (ID)` : ''}</span>{p.boarded ? <span className="st s-good"><Icon name="check" /></span> : <span className="st s-mute">—</span>}</div>)}
        {tab === 'road' && (
          <>
            <p className="mini" style={{ marginBottom: 8 }}>Passengers who flag the bus along the way. Fare by drop-off point; cash goes to the remittance for this trip.</p>
            <label className="field"><span>Drop-off</span><select className="select" value={road.to} onChange={(e) => setRoad({ ...road, to: e.target.value })}>{stops.map((s) => <option key={s}>{s}</option>)}</select></label>
            <div className="row2"><label className="field"><span>Type</span><select className="select" value={road.type} onChange={(e) => setRoad({ ...road, type: e.target.value })}>{Object.entries(PAX_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label><label className="field"><span>Name (optional)</span><input className="input" value={road.name} onChange={(e) => setRoad({ ...road, name: e.target.value })} /></label></div>
            <div className="est"><div><span>Fare</span><b>{peso(roadFare)}</b></div></div>
            <button type="button" className="btn btn-gold btn-block" disabled={st !== 'departed' && st !== 'boarding'} onClick={sell}><Icon name="ticket" />Issue ticket (cash)</button>
            {st !== 'departed' && st !== 'boarding' && <p className="mini" style={{ marginTop: 6 }}>Available once boarding starts.</p>}
          </>
        )}
        {tab === 'check' && (
          <>
            <p className="mini" style={{ marginBottom: 8 }}>Pre-trip inspection by the driver. Saved with the trip.</p>
            {CHECKS.map((x) => <label key={x} className="field check"><input type="checkbox" checked={checks.includes(x)} onChange={() => update((d) => { const o = d.tripOps[trip.id] = { ...(d.tripOps[trip.id] || {}) }; const s = new Set(o.checklist || []); if (s.has(x)) s.delete(x); else s.add(x); o.checklist = [...s]; })} /><span>{x}</span></label>)}
            <div className={checks.length === CHECKS.length ? 'okbox' : 'hintbox'}><Icon name={checks.length === CHECKS.length ? 'check' : 'alert'} />{checks.length}/{CHECKS.length} done</div>
          </>
        )}
        {tab === 'more' && (
          <>
            <div className="srow" style={{ gridTemplateColumns: '1fr auto' }}><div><b>Share GPS location</b><span className="d">Every {setting(state, 'integrations.gps.interval')} s while the trip is on the road (Phase 3)</span></div><Toggle on={!!trip.ops.gpsOn} onChange={(v) => update((d) => { d.tripOps[trip.id] = { ...(d.tripOps[trip.id] || {}), gpsOn: v }; })} label="GPS" /></div>
            <label className="field" style={{ marginTop: 12 }}><span>Report an incident</span><textarea className="textarea" value={incident} onChange={(e) => setIncident(e.target.value)} placeholder="e.g. Flat tire near Tarlac, 20 min stop" /></label>
            <button type="button" className="btn btn-ghost btn-block" disabled={incident.trim().length < 5} onClick={() => { update((d) => audit(d, 'trip.incident', `${trip.time} ${tName(d, trip.fromId)}→${tName(d, trip.toId)}: ${incident}`, { actor: me.name, severity: 'warning' })); setIncident(''); toast('Incident sent to dispatch.'); }}><Icon name="send" />Send to dispatch</button>
            <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => { update((d) => { const o = d.tripOps[trip.id] = { ...(d.tripOps[trip.id] || {}) }; o.delay = (o.delay || 0) + 15; audit(d, 'trip.delayed', `Crew reported +15 min on ${trip.time} ${tName(d, trip.fromId)}→${tName(d, trip.toId)}`, { actor: me.name }); }); toast('Dispatch informed: +15 minutes. Passengers see the new ETA.'); }}><Icon name="clock" />Running late +15 min</button>
          </>
        )}
      </div>
    </div>
  );
}
