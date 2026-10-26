import { useEffect, useMemo, useState } from 'react';
import Icon from '../lib/icons.jsx';
import { addDays, ymd } from '../lib/data.js';
import { audit, sms, useStore } from '../lib/store.jsx';
import { BOOKING_STATUS, PAX_TYPES, PAY_LABEL, SOURCE_LABEL, TRIP_STATUS, bookingStatus, busOf, clsOf, crewOf, fmtTime, getTrip, peso, progress, seatList, tName, takenSeats, todayYmd, tripStatus, tripsOn } from '../lib/trips.js';
import { Empty, Modal } from '../components.jsx';
import { NetworkMap } from '../shared.jsx';
import { charterEstimate } from '../site/Services.jsx';
import { TopBar } from './AdminApp.jsx';

// ---------------------------------------------------------------- charters
const CH_STATUS = { new: ['New request', 's-warn'], quoted: ['Quotation sent', 's-info'], confirmed: ['Confirmed · deposit paid', 's-good'], completed: ['Completed', 's-mute'], cancelled: ['Cancelled', 's-mute'] };

export function Charters({ menu, onSignOut }) {
  const { state, update, toast } = useStore();
  const [quote, setQuote] = useState(null);
  const [assign, setAssign] = useState(null);
  const act = (c, patch, what, text) => {
    update((d) => { Object.assign(d.charters.find((x) => x.id === c.id), patch); if (text) sms(d, c.mobile, text); audit(d, 'charter.updated', `${c.ref}: ${what}`); });
    toast(`${c.ref}: ${what}.`);
  };
  return (
    <>
      <TopBar crumb="Services" title="Bus rental (charter)" menu={menu} onSignOut={onSignOut} after={<span className="st s-mute" style={{ marginLeft: 6 }}>Requests: Phase 1 · quotations & deposits: Phase 3</span>} />
      <div className="pad">
        <div className="panel">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Ref</th><th>Customer</th><th>Trip</th><th>Dates</th><th>Pax / buses</th><th>Quotation</th><th>Status</th><th /></tr></thead>
              <tbody>{state.charters.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.ref}</b><div className="mini">{new Date(c.createdAt).toLocaleDateString('en-PH')}</div></td>
                  <td>{c.name}<div className="mini">{c.org} · {c.mobile}</div></td>
                  <td>{c.pickup} → {c.destination}<div className="mini">{c.notes}</div></td>
                  <td className="mini">{c.date}{c.returnDate !== c.date ? ` – ${c.returnDate}` : ''}</td>
                  <td>{c.pax} · {c.buses} × {clsOf(state, c.cls).short}{c.busIds && <div className="mini">{c.busIds.map((id) => busOf(state, id)?.bodyNo).join(', ')}</div>}</td>
                  <td>{c.quote ? <>{peso(c.quote.amount)}<div className="mini">deposit {peso(c.quote.deposit)}{c.quote.paid ? ' · paid' : ''}</div></> : '—'}</td>
                  <td><span className={`st ${CH_STATUS[c.status][1]}`}>{CH_STATUS[c.status][0]}</span></td>
                  <td><div className="acts">
                    {c.status === 'new' && <button type="button" className="btn-a b-navy b-xs" onClick={() => { const e = charterEstimate(state, c); setQuote({ c, amount: e.amount, deposit: Math.round(e.amount * 0.3), valid: ymd(addDays(new Date(), 5)) }); }}>Send quotation</button>}
                    {c.status === 'quoted' && <button type="button" className="btn-a b-gold b-xs" onClick={() => act(c, { status: 'confirmed', quote: { ...c.quote, paid: true } }, 'deposit received (PayMongo)', `Five Star: deposit for ${c.ref} received. Your buses are reserved for ${c.date}.`)}>Deposit paid</button>}
                    {c.status === 'confirmed' && !c.busIds && <button type="button" className="btn-a b-ghost b-xs" onClick={() => setAssign({ c, ids: [] })}>Assign buses</button>}
                    {c.status === 'confirmed' && c.date < todayYmd() && <button type="button" className="btn-a b-ghost b-xs" onClick={() => act(c, { status: 'completed' }, 'completed')}>Complete</button>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="mini" style={{ marginTop: 10 }}>Requests come from the website's Rent a bus page. The quotation is emailed as a PDF with a PayMongo link for the deposit; the signed contract is stored in Amazon S3.</p>
        </div>
      </div>
      {quote && (
        <Modal title={`Quotation for ${quote.c.ref}`} onClose={() => setQuote(null)} footer={<><button type="button" className="btn-a b-ghost" onClick={() => setQuote(null)}>Cancel</button><button type="button" className="btn-a b-navy" onClick={() => { act(quote.c, { status: 'quoted', quote: { amount: Number(quote.amount), deposit: Number(quote.deposit), valid: quote.valid } }, `quotation ${peso(quote.amount)} sent`, `Five Star: your quotation ${quote.c.ref} is ${peso(quote.amount)}. Pay the ${peso(quote.deposit)} deposit by ${quote.valid} to confirm: ${window.location.host}/q/${quote.c.ref}`); setQuote(null); }}>Send by SMS & email</button></>}>
          <p className="mini" style={{ marginBottom: 10 }}>{quote.c.pickup} → {quote.c.destination} · {quote.c.buses} × {clsOf(state, quote.c.cls).name} · {quote.c.date}{quote.c.returnDate !== quote.c.date ? ` to ${quote.c.returnDate}` : ''}. Suggested from the day rates in Bus classes.</p>
          <div className="row3">
            <label className="field"><span>Total (₱)</span><input className="input" value={quote.amount} onChange={(e) => setQuote({ ...quote, amount: e.target.value.replace(/\D/g, '') })} /></label>
            <label className="field"><span>Deposit (₱)</span><input className="input" value={quote.deposit} onChange={(e) => setQuote({ ...quote, deposit: e.target.value.replace(/\D/g, '') })} /></label>
            <label className="field"><span>Valid until</span><input className="input" type="date" value={quote.valid} onChange={(e) => setQuote({ ...quote, valid: e.target.value })} /></label>
          </div>
        </Modal>
      )}
      {assign && (
        <Modal title={`Assign buses · ${assign.c.ref}`} onClose={() => setAssign(null)} footer={<><button type="button" className="btn-a b-ghost" onClick={() => setAssign(null)}>Cancel</button><button type="button" className="btn-a b-navy" disabled={assign.ids.length !== assign.c.buses} onClick={() => { act(assign.c, { busIds: assign.ids }, `buses ${assign.ids.map((id) => busOf(state, id).bodyNo).join(', ')} assigned`); setAssign(null); }}>Save</button></>}>
          <p className="mini" style={{ marginBottom: 8 }}>Pick {assign.c.buses} {clsOf(state, assign.c.cls).name} bus(es).</p>
          <div className="chips">{state.buses.filter((b) => b.cls === assign.c.cls && b.status === 'active').slice(0, 24).map((b) => <button type="button" key={b.id} className={`chip ${assign.ids.includes(b.id) ? 'on' : ''}`} onClick={() => setAssign({ ...assign, ids: assign.ids.includes(b.id) ? assign.ids.filter((x) => x !== b.id) : [...assign.ids, b.id] })}>{b.bodyNo}</button>)}</div>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------- live map
export function LiveMap({ menu, onSignOut }) {
  const { state } = useStore();
  const [now, setNow] = useState(Date.now());
  const [sel, setSel] = useState(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(t); }, []);
  const live = useMemo(() => [...tripsOn(state, ymd(addDays(new Date(), -1))), ...tripsOn(state, todayYmd())].filter((t) => tripStatus(t, now) === 'departed'), [state, now]);
  const trip = sel && live.find((t) => t.id === sel);
  return (
    <>
      <TopBar crumb="Operations" title="Live bus map" menu={menu} onSignOut={onSignOut} after={<span className="st s-mute" style={{ marginLeft: 6 }}>Phase 3</span>}>
        <span className="st s-info"><Icon name="bus" />{live.length} buses on the road</span>
        <span className="st s-warn"><Icon name="alert" />{live.filter((t) => t.ops.delay).length} running late</span>
      </TopBar>
      <div className="pad">
        <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr', marginTop: 0 }}>
          <div className="panel" style={{ padding: 8 }}><NetworkMap state={state} trips={live} selected={trip?.toId} onSelect={(id) => id.includes('_') && setSel(id)} labels="all" /></div>
          <div className="panel">
            {trip ? (
              <>
                <div className="ph-row"><h3>{tName(state, trip.fromId)} → {tName(state, trip.toId)}</h3><span className="sp" /><button type="button" className="btn-a b-ghost b-xs" onClick={() => setSel(null)}>All buses</button></div>
                <div className="dl">
                  <div><span>Bus</span><b>{busOf(state, trip.ops.busId)?.bodyNo || '—'} · {busOf(state, trip.ops.busId)?.plate || ''} · GPS {busOf(state, trip.ops.busId)?.gps || ''}</b></div>
                  <div><span>Crew</span><b>{crewOf(state, trip.ops.driverId)?.name || '—'} / {crewOf(state, trip.ops.conductorId)?.name || '—'}</b></div>
                  <div><span>Departed</span><b>{fmtTime(trip.etd)}{trip.ops.delay ? ` (+${trip.ops.delay} min)` : ''}</b></div>
                  <div><span>ETA</span><b>{fmtTime(trip.eta)} · {Math.round(progress(trip, now) * 100)}% of the way</b></div>
                  <div><span>On board</span><b>{takenSeats(state, trip).size}/{seatList(clsOf(state, trip.cls)).length} passengers</b></div>
                </div>
                <div className="prog" style={{ marginTop: 12 }}><i style={{ width: `${progress(trip, now) * 100}%` }} /></div>
                <p className="mini">Speeding, long stops and route deviations raise an alert here in the real system (from the GPS provider or the crew app).</p>
              </>
            ) : (
              <>
                <div className="ph-row"><h3>On the road</h3><span className="sub">click a dot or a row</span></div>
                <div className="tbl-wrap" style={{ maxHeight: 560, overflowY: 'auto' }}>
                  <table className="tbl">
                    <thead><tr><th>Left</th><th>Route</th><th>Bus</th><th>ETA</th><th>Progress</th></tr></thead>
                    <tbody>{live.map((t) => <tr key={t.id} onClick={() => setSel(t.id)} style={{ cursor: 'pointer' }}><td>{fmtTime(t.etd)}</td><td>{tName(state, t.fromId)} → {tName(state, t.toId)}</td><td>{busOf(state, t.ops.busId)?.bodyNo || '—'}</td><td>{fmtTime(t.eta)}{t.ops.delay ? <span className="st s-warn" style={{ marginLeft: 4 }}>+{t.ops.delay}</span> : null}</td><td style={{ width: 90 }}><div className="meter"><i style={{ width: `${progress(t, now) * 100}%` }} /></div></td></tr>)}</tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- report builder
const DATASETS = {
  bookings: {
    label: 'Bookings & tickets',
    cols: {
      ref: ['Reference', (s, b) => b.ref], date: ['Trip date', (s, b) => b.date], time: ['Departure', (s, b, t) => t?.time], route: ['Route', (s, b, t) => (t ? `${tName(s, t.fromId)} - ${tName(s, t.toId)}` : '')],
      cls: ['Class', (s, b, t) => (t ? clsOf(s, t.cls).name : '')], seats: ['Seats', (s, b) => b.pax.map((p) => p.seat).join(' ')], pax: ['Passengers', (s, b) => b.pax.length],
      types: ['Passenger types', (s, b) => b.pax.map((p) => PAX_TYPES[p.type]).join(' ')], source: ['Channel', (s, b) => SOURCE_LABEL[b.source]], pay: ['Payment', (s, b) => PAY_LABEL[b.pay.method]],
      fare: ['Fare', (s, b) => b.fare], fee: ['Fee', (s, b) => b.fee], total: ['Total', (s, b) => b.total], status: ['Status', (s, b) => BOOKING_STATUS[bookingStatus(s, b)]?.label], sold: ['Sold on', (s, b) => b.createdAt.slice(0, 10)],
    },
    rows: (s, from, to) => s.bookings.filter((b) => b.date >= from && b.date <= to).map((b) => [b, getTrip(s, b.tripId)]),
  },
  trips: {
    label: 'Trips & load factor',
    cols: {
      date: ['Date', (s, t) => t.date], time: ['Departure', (s, t) => t.time], route: ['Route', (s, t) => `${tName(s, t.fromId)} - ${tName(s, t.toId)}`], cls: ['Class', (s, t) => clsOf(s, t.cls).name],
      bus: ['Bus', (s, t) => busOf(s, t.ops.busId)?.bodyNo || ''], driver: ['Driver', (s, t) => crewOf(s, t.ops.driverId)?.name || ''], sold: ['Seats sold', (s, t) => takenSeats(s, t).size],
      cap: ['Seats', (s, t) => seatList(clsOf(s, t.cls)).length], lf: ['Load factor %', (s, t) => Math.round((takenSeats(s, t).size / seatList(clsOf(s, t.cls)).length) * 100)], delay: ['Delay (min)', (s, t) => t.ops.delay || 0], status: ['Status', (s, t) => TRIP_STATUS[tripStatus(t)].label],
    },
    rows: (s, from, to) => { const out = []; for (let d = from; d <= to && out.length < 4000; d = ymd(addDays(new Date(`${d}T00:00`), 1))) tripsOn(s, d).forEach((t) => out.push([t])); return out; },
  },
  parcels: {
    label: 'Parcels',
    cols: { waybill: ['Waybill', (s, p) => p.waybill], date: ['Date', (s, p) => p.createdAt.slice(0, 10)], route: ['Route', (s, p) => `${tName(s, p.from)} - ${tName(s, p.to)}`], kg: ['Kg', (s, p) => p.kg], fee: ['Fee', (s, p) => p.fee], status: ['Status', (s, p) => p.status] },
    rows: (s, from, to) => s.parcels.filter((p) => p.createdAt.slice(0, 10) >= from && p.createdAt.slice(0, 10) <= to).map((p) => [p]),
  },
};

export function Reports({ menu, onSignOut }) {
  const { state, update, toast } = useStore();
  const [ds, setDs] = useState('bookings');
  const [from, setFrom] = useState(ymd(addDays(new Date(), -7)));
  const [to, setTo] = useState(todayYmd());
  const [cols, setCols] = useState(['ref', 'date', 'route', 'pax', 'source', 'total', 'status']);
  const D = DATASETS[ds];
  const rows = useMemo(() => D.rows(state, from, to), [D, state, from, to]);
  const use = cols.filter((c) => D.cols[c]);
  const table = rows.map((r) => use.map((c) => D.cols[c][1](state, ...r)));
  const templates = state.reportTemplates || [];
  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [use.map((c) => esc(D.cols[c][0])).join(','), ...table.map((r) => r.map(esc).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv' }));
    a.download = `fivestar-${ds}-${from}-to-${to}.csv`;
    a.click();
    update((d) => audit(d, 'report.exported', `${D.label} ${from}–${to}, ${table.length} rows`, { severity: 'warning' }));
  };
  return (
    <>
      <TopBar crumb="Insights" title="Report builder" menu={menu} onSignOut={onSignOut} after={<span className="st s-mute" style={{ marginLeft: 6 }}>Phase 3</span>}>
        <button type="button" className="btn-a b-ghost" onClick={() => { const n = window.prompt('Template name'); if (n) { update((d) => { d.reportTemplates = [...(d.reportTemplates || []), { name: n, ds, cols: use }]; }); toast('Template saved.'); } }}><Icon name="plus" />Save template</button>
        <button type="button" className="btn-a b-navy" onClick={exportCsv}><Icon name="download" />Export Excel (CSV)</button>
      </TopBar>
      <div className="pad">
        <div className="grid" style={{ gridTemplateColumns: '280px 1fr', marginTop: 0 }}>
          <div className="panel">
            <label className="field"><span>Data</span><select className="select" value={ds} onChange={(e) => { setDs(e.target.value); setCols(Object.keys(DATASETS[e.target.value].cols).slice(0, 7)); }}>{Object.entries(DATASETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
            <div className="row2"><label className="field"><span>From</span><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="field"><span>To</span><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></div>
            <span className="label">Columns</span>
            {Object.entries(D.cols).map(([k, [l]]) => <label key={k} className="field check" style={{ marginBottom: 6 }}><input type="checkbox" checked={cols.includes(k)} onChange={() => setCols(cols.includes(k) ? cols.filter((x) => x !== k) : [...cols, k])} /><span>{l}</span></label>)}
            {templates.length > 0 && <><span className="label" style={{ marginTop: 12 }}>Saved templates</span><div className="chips">{templates.map((t) => <button type="button" key={t.name} className="chip" onClick={() => { setDs(t.ds); setCols(t.cols); }}>{t.name}</button>)}</div></>}
          </div>
          <div className="panel">
            <div className="ph-row"><h3>Preview</h3><span className="sub">{table.length.toLocaleString()} rows · first 100 shown</span></div>
            <div className="tbl-wrap">
              <table className="tbl"><thead><tr>{use.map((c) => <th key={c}>{D.cols[c][0]}</th>)}</tr></thead><tbody>{table.slice(0, 100).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{typeof v === 'number' && ['total', 'fare', 'fee'].includes(use[j]) ? peso(v) : v}</td>)}</tr>)}</tbody></table>
              {!table.length && <Empty icon="chart">No data for this period.</Empty>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
