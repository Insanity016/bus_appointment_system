import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { audit, setting, sms, useStore } from '../lib/store.jsx';
import { addDays, ymd } from '../lib/data.js';
import { TRIP_STATUS, busOf, clsOf, crewOf, fmtDate, fmtTime, getTrip, peso, progress, seatList, tName, todayYmd, tripStatus, tripsOn } from '../lib/trips.js';
import { NetworkMap } from '../shared.jsx';

// ---------------------------------------------------------------- Rent a bus
export function charterEstimate(state, f) {
  const c = clsOf(state, f.cls);
  const days = Math.max(1, Math.round((new Date(f.returnDate || f.date) - new Date(f.date)) / 86400000) + 1);
  const buses = Math.max(1, Number(f.buses) || Math.ceil(Number(f.pax || 1) / seatList(c).length));
  return { days, buses, amount: c.charterDay * days * buses };
}

export function Charter() {
  const { state, update, toast } = useStore();
  const blank = { name: '', org: '', mobile: '', email: '', pickup: '', destination: '', date: ymd(addDays(new Date(), 14)), returnDate: ymd(addDays(new Date(), 14)), pax: 45, buses: '', cls: 'regular', notes: '' };
  const [f, setF] = useState(blank);
  const [done, setDone] = useState(null);
  const set = (k, v) => setF({ ...f, [k]: v });
  const est = charterEstimate(state, f);
  const submit = (e) => {
    e.preventDefault();
    const ref = update((d) => {
      const n = (d.charters.length ? Math.max(...d.charters.map((c) => c.id)) : 0) + 1;
      const r = `CH-${new Date().getFullYear()}-${String(41 + n).padStart(4, '0')}`;
      d.charters.unshift({ id: n, ref: r, ...f, buses: est.buses, status: 'new', quote: null, createdAt: new Date().toISOString() });
      sms(d, f.mobile, `Five Star: we received your bus rental request ${r}. Our charter team will send your quotation within 24 hours.`);
      audit(d, 'charter.requested', `${r} · ${f.pickup} → ${f.destination} · ${est.buses} bus(es)`, { actor: `Guest ${f.name}` });
      return r;
    });
    setDone(ref);
    toast(`Request ${ref} sent. We'll send your quotation by SMS and email.`);
  };
  return (
    <>
      <div className="page-hero charter-hero"><div className="wrap">
        <span className="kicker light">Rent a bus</span>
        <h1>Kahit anong okasyon, i-book mo na with Five Star!</h1>
        <p>Family vacations, company outings, school field trips, pilgrimages and weddings. Professional drivers, insured buses, one quotation.</p>
      </div></div>
      <div className="wrap ch-grid">
        <div>
          <div className="ch-steps">
            {[['edit', 'Tell us your trip', 'Dates, places and number of passengers.'], ['receipt', 'Get a quotation', 'Within 24 hours by SMS and email.'], ['card', 'Pay the deposit', 'Online with GCash, Maya or card to lock the buses.'], ['bus', 'Enjoy the ride', 'Driver and bus details sent the day before.']].map(([i, t, x], k) => <div key={t}><span className="n">{k + 1}</span><Icon name={i} /><b>{t}</b><span>{x}</span></div>)}
          </div>
          <h3 style={{ margin: '22px 0 10px' }}>Choose a bus</h3>
          <div className="ch-buses">
            {state.classes.filter((c) => c.on).map((c) => (
              <button type="button" key={c.id} className={`ch-bus ${f.cls === c.id ? 'on' : ''}`} onClick={() => set('cls', c.id)} style={{ '--c': c.color }}>
                <Icon name="bus" size={26} /><b>{c.name}</b><span>{seatList(c).length} seats · {c.layout}</span><small>from {peso(c.charterDay)} / bus / day</small>
              </button>
            ))}
          </div>
        </div>
        <div className="panel-s">
          {done ? (
            <div className="okbox big"><Icon name="check" /><div><b>Request {done} received</b><span>Our charter team will call or text you within 24 hours with the final quotation. <Link to="/rent-a-bus" onClick={() => { setDone(null); setF(blank); }}>Send another request</Link></span></div></div>
          ) : (
            <form onSubmit={submit}>
              <h3 style={{ marginBottom: 12 }}>Request a quotation</h3>
              <div className="row2">
                <label className="field"><span>Your name</span><input className="input" required value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
                <label className="field"><span>Company / school / group (optional)</span><input className="input" value={f.org} onChange={(e) => set('org', e.target.value)} /></label>
                <label className="field"><span>Mobile number</span><input className="input" required value={f.mobile} onChange={(e) => set('mobile', e.target.value)} /></label>
                <label className="field"><span>Email</span><input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></label>
                <label className="field"><span>Pick-up</span><input className="input" required value={f.pickup} onChange={(e) => set('pickup', e.target.value)} placeholder="City or exact address" /></label>
                <label className="field"><span>Destination</span><input className="input" required value={f.destination} onChange={(e) => set('destination', e.target.value)} placeholder="e.g. Baguio City" /></label>
                <label className="field"><span>Departure date</span><input className="input" type="date" min={todayYmd()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, returnDate: e.target.value > f.returnDate ? e.target.value : f.returnDate })} /></label>
                <label className="field"><span>Return date</span><input className="input" type="date" min={f.date} value={f.returnDate} onChange={(e) => set('returnDate', e.target.value)} /></label>
                <label className="field"><span>Passengers</span><input className="input" type="number" min="1" value={f.pax} onChange={(e) => set('pax', e.target.value)} /></label>
                <label className="field"><span>Buses (optional)</span><input className="input" type="number" min="1" value={f.buses} onChange={(e) => set('buses', e.target.value)} placeholder={`${est.buses} suggested`} /></label>
              </div>
              <label className="field"><span>Notes</span><textarea className="textarea" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Pick-up time, stops along the way, overnight stay…" /></label>
              <div className="est"><div><span>Indicative estimate</span><b>{peso(est.amount)}</b><small>{est.buses} × {clsOf(state, f.cls).name} · {est.days} day{est.days > 1 ? 's' : ''}. Tolls, fuel for long distances and driver lodging are confirmed in the quotation.</small></div></div>
              <button className="btn btn-gold btn-block" type="submit"><Icon name="send" />Send request</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Parcels
export const PARCEL_STATUS = {
  received: { label: 'Received at terminal', cls: 's-mute', icon: 'package' },
  loaded: { label: 'Loaded on bus', cls: 's-info', icon: 'bus' },
  in_transit: { label: 'On the way', cls: 's-info', icon: 'nav' },
  arrived: { label: 'Ready for pick-up', cls: 's-warn', icon: 'pin' },
  claimed: { label: 'Claimed', cls: 's-good', icon: 'check' },
  returned: { label: 'Returned to sender', cls: 's-bad', icon: 'refresh' },
};

export function parcelFee(state, { from, to, kg, declared }) {
  const r = setting(state, 'parcels.rates');
  const route = state.routes.find((x) => (x.from === from && x.to === to) || (x.from === to && x.to === from));
  const km = route ? route.km : 200;
  return Math.max(Number(r.minFee), Math.round(Number(r.minFee) + Math.max(0, Number(kg) - 3) * Number(r.perKg) + (km / 100) * Number(r.perKm) + Number(declared || 0) * Number(r.valuation) / 100));
}

export function Parcels() {
  const { state } = useStore();
  const [params] = useSearchParams();
  const [wb, setWb] = useState(params.get('wb') || '');
  const [found, setFound] = useState(null);
  const [err, setErr] = useState('');
  const [calc, setCalc] = useState({ from: 'cubao', to: 'dagupan', kg: 5, declared: 1000 });
  const track = (e) => { e?.preventDefault(); const p = state.parcels.find((x) => x.waybill.toLowerCase() === wb.trim().toLowerCase()); setFound(p || null); setErr(p ? '' : 'No parcel found with that waybill number.'); };
  const sample = state.parcels.find((p) => p.status === 'in_transit') || state.parcels[0];
  const terms = state.terminals.filter((t) => t.on && t.parcels);
  return (
    <>
      <div className="page-hero slim"><div className="wrap"><span className="kicker light">Five Star Parcel <span className="phase">Phase 2</span></span><h1>Send it with Five Star</h1><p>Boxes, documents and balikbayan boxes on our buses to {terms.length} terminals. The receiver gets an SMS when it arrives.</p></div></div>
      <div className="wrap pc-grid">
        <div className="panel-s">
          <h3>Track a parcel</h3>
          <form className="otp" onSubmit={track} style={{ marginTop: 10 }}><input className="input" value={wb} onChange={(e) => setWb(e.target.value)} placeholder="Waybill no., e.g. WB-2026-000012" aria-label="Waybill number" /><button className="btn btn-gold" type="submit">Track</button></form>
          {sample && <p className="mini" style={{ marginTop: 6 }}>Demo: <button type="button" className="linkbtn" onClick={() => { setWb(sample.waybill); setFound(sample); setErr(''); }}>{sample.waybill}</button></p>}
          {err && <div className="error" style={{ marginTop: 10 }}><Icon name="alert" />{err}</div>}
          {found && (
            <div className="pc-track">
              <div className="pc-h"><b>{found.waybill}</b><span className={`st ${PARCEL_STATUS[found.status].cls}`}><Icon name={PARCEL_STATUS[found.status].icon} />{PARCEL_STATUS[found.status].label}</span></div>
              <p className="mini">{tName(state, found.from)} → {tName(state, found.to)} · {found.pieces} pc · {found.kg} kg · receiver {found.receiver.name.replace(/\s.*/, ' •••')}</p>
              <ol className="timeline">{found.events.map((e, i) => <li key={i}><b>{PARCEL_STATUS[e.status].label}</b><span>{tName(state, e.where)} · {new Date(e.at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></li>)}</ol>
            </div>
          )}
        </div>
        <div className="panel-s">
          <h3>Rate calculator</h3>
          <div className="row2" style={{ marginTop: 10 }}>
            <label className="field"><span>From</span><select className="select" value={calc.from} onChange={(e) => setCalc({ ...calc, from: e.target.value })}>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="field"><span>To</span><select className="select" value={calc.to} onChange={(e) => setCalc({ ...calc, to: e.target.value })}>{terms.filter((t) => t.id !== calc.from).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="field"><span>Weight (kg)</span><input className="input" type="number" min="0.5" step="0.5" value={calc.kg} onChange={(e) => setCalc({ ...calc, kg: e.target.value })} /></label>
            <label className="field"><span>Declared value (₱)</span><input className="input" type="number" min="0" value={calc.declared} onChange={(e) => setCalc({ ...calc, declared: e.target.value })} /></label>
          </div>
          <div className="est"><div><span>Estimated fee</span><b>{peso(parcelFee(state, calc))}</b><small>Final fee after weighing at the terminal. Up to {setting(state, 'parcels.rates.maxKg')} kg per piece; free storage for {setting(state, 'parcels.handling.storageDays')} days at the destination.</small></div></div>
          <ul className="ticks"><li>Bring the parcel open for inspection; no prohibited items.</li><li>Pay at drop-off{setting(state, 'parcels.handling.cod') ? ', or let the receiver pay on pick-up' : ''}.</li><li>The receiver shows a valid ID to claim.</li></ul>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Track my bus
export function Track() {
  const { state } = useStore();
  const [params] = useSearchParams();
  const [ref, setRef] = useState(params.get('ref') || '');
  const [tripId, setTripId] = useState(() => state.bookings.find((b) => b.ref === params.get('ref'))?.tripId || null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(t); }, []);
  const live = useMemo(() => [...tripsOn(state, ymd(addDays(new Date(), -1))), ...tripsOn(state, todayYmd())].filter((t) => tripStatus(t, now) === 'departed'), [state, now]);
  const trip = tripId ? getTrip(state, tripId) : null;
  const find = (e) => { e.preventDefault(); const b = state.bookings.find((x) => x.ref.toLowerCase() === ref.trim().toLowerCase()); if (b) setTripId(b.tripId); };
  const st = trip ? tripStatus(trip, now) : null;
  const bus = trip && busOf(state, trip.ops.busId);
  const p = trip ? progress(trip, now) : 0;
  const stops = trip ? [tName(state, trip.fromId), ...(trip.dir === 'out' ? trip.route.stops : [...trip.route.stops].reverse()), tName(state, trip.toId)] : [];
  return (
    <>
      <div className="page-hero slim"><div className="wrap"><span className="kicker light">Live tracking <span className="phase">Phase 3</span></span><h1>Where's my bus?</h1><p>Live position from the crew app or the bus GPS, with the expected arrival time.</p>
        <form className="otp" onSubmit={find} style={{ maxWidth: 460, marginTop: 14 }}><input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Booking reference (FS-…)" aria-label="Booking reference" /><button className="btn btn-gold" type="submit">Track</button></form>
      </div></div>
      <div className="wrap trk">
        <div className="trk-map"><NetworkMap state={state} trips={trip ? [trip] : live} selected={trip?.toId} onSelect={(id) => { if (id.includes('_')) setTripId(id); }} labels="all" /></div>
        <div>
          {trip ? (
            <div className="panel-s">
              <div className="ps-h"><h3>{tName(state, trip.fromId)} → {tName(state, trip.toId)}</h3><span className={`st ${TRIP_STATUS[st].cls}`}><Icon name={TRIP_STATUS[st].icon} />{TRIP_STATUS[st].label}</span></div>
              <p className="mini">{fmtDate(trip.date)} · departed {fmtTime(trip.etd)} · bus {bus?.bodyNo || '—'} ({clsOf(state, trip.cls).name})</p>
              <div className="eta"><span>Expected arrival</span><b>{fmtTime(trip.eta)}</b>{trip.ops.delay ? <small>{trip.ops.delay} min behind schedule</small> : <small>on schedule</small>}</div>
              <div className="prog"><i style={{ width: `${Math.round(p * 100)}%` }} /></div>
              <ol className="stops">{stops.map((s, i) => { const at = i / (stops.length - 1); return <li key={s} className={p >= at ? 'done' : ''}><b>{s}</b><span>{fmtTime(new Date(trip.etd.getTime() + at * trip.mins * 60000))}</span></li>; })}</ol>
              {bus && <p className="mini">Driver {crewOf(state, trip.ops.driverId)?.name.split(' ')[0]} · Conductor {crewOf(state, trip.ops.conductorId)?.name.split(' ')[0]}</p>}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTripId(null)}>Show all buses on the road</button>
            </div>
          ) : (
            <div className="panel-s">
              <h3>{live.length} buses on the road now</h3>
              <p className="mini" style={{ margin: '4px 0 10px' }}>Tap a dot on the map, or enter your booking reference.</p>
              <div className="live-list">{live.slice(0, 12).map((t) => <button type="button" key={t.id} onClick={() => setTripId(t.id)}><b>{tName(state, t.fromId)} → {tName(state, t.toId)}</b><span>left {fmtTime(t.etd)} · ETA {fmtTime(t.eta)}</span>{t.ops.delay ? <span className="st s-warn">+{t.ops.delay}m</span> : null}</button>)}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
