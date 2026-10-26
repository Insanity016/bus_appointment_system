import { useState } from 'react';
import Icon from '../lib/icons.jsx';
import { ROLES } from '../lib/data.js';
import { audit, setting, sms, useStore } from '../lib/store.jsx';
import { cancelBooking, payReservation } from '../lib/booking.js';
import { BOOKING_STATUS, PAX_TYPES, PAY_LABEL, SOURCE_LABEL, bookingStatus, canRebook, fillTemplate, getTrip, maskMobile, normMobile, peso, smsValues, tName, todayYmd } from '../lib/trips.js';
import { Empty, Modal, StatusPill } from '../components.jsx';
import { TicketCard, Rebook } from '../site/Ticket.jsx';
import { TopBar } from './AdminApp.jsx';

export default function Bookings({ menu, onSignOut }) {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState('');
  const [open, setOpen] = useState(null);
  const [limit, setLimit] = useState(60);
  const full = ROLES[state.staffSession.role].rank >= 70;
  // Digits-only searches match mobile numbers however they were typed (0917-…, 0917 …).
  const needle = /^[\d\s-]+$/.test(q) ? normMobile(q) : q.toLowerCase();
  const rows = [...state.bookings].reverse().filter((b) => {
    const st = bookingStatus(state, b);
    return (!status || st === status) && (!source || b.source === source) && (!date || b.date === date)
      && (!q || `${b.ref} ${b.contact.name} ${normMobile(b.contact.mobile)} ${b.pax.map((p) => p.name).join(' ')}`.toLowerCase().includes(needle));
  });
  const b = open && state.bookings.find((x) => x.ref === open);
  return (
    <>
      <TopBar crumb="Ticketing" title="Bookings" menu={menu} onSignOut={onSignOut}>
        <label className="ctl" style={{ minWidth: 240 }}><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference, name or mobile" style={{ width: '100%' }} /></label>
        <label className="ctl"><Icon name="calendar" /><input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Trip date" /></label>
        <label className="ctl"><select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option>{Object.entries(BOOKING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <label className="ctl"><select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Channel"><option value="">All channels</option>{Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </TopBar>
      <div className="pad">
        <div className="panel">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Reference</th><th>Trip</th><th>Passenger(s)</th><th>Contact</th><th>Seats</th><th>Channel</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {rows.slice(0, limit).map((x) => {
                  const t = getTrip(state, x.tripId);
                  return (
                    <tr key={x.ref} onClick={() => setOpen(x.ref)} style={{ cursor: 'pointer' }}>
                      <td><b>{x.ref}</b><div className="mini">{new Date(x.createdAt).toLocaleDateString('en-PH')}</div></td>
                      <td>{t ? <>{t.date} <b>{t.time}</b><div className="mini">{tName(state, t.fromId)} → {tName(state, t.toId)}</div></> : '—'}</td>
                      <td>{x.pax[0]?.name}{x.pax.length > 1 && <span className="mini"> +{x.pax.length - 1}</span>}</td>
                      <td className="mini">{full ? x.contact.mobile : maskMobile(x.contact.mobile)}</td>
                      <td>{x.pax.map((p) => p.seat).join(', ')}</td>
                      <td className="mini">{SOURCE_LABEL[x.source]}</td>
                      <td>{peso(x.total)}</td>
                      <td><StatusPill status={bookingStatus(state, x)} map={BOOKING_STATUS} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && <Empty icon="ticket">No bookings match.</Empty>}
          </div>
          {rows.length > limit && <button type="button" className="btn-a b-ghost" style={{ marginTop: 10 }} onClick={() => setLimit(limit + 100)}>Show more ({rows.length - limit} left)</button>}
          <p className="mini" style={{ marginTop: 10 }}>{rows.length.toLocaleString()} bookings. Mobile numbers are masked for roles below Terminal Manager (Data Privacy Act). Every export and refund is recorded in the audit log.</p>
        </div>
      </div>
      {b && <BookingDrawer b={b} onClose={() => setOpen(null)} />}
    </>
  );
}

export function BookingDrawer({ b, onClose }) {
  const { state, update, toast } = useStore();
  const [modal, setModal] = useState(null);
  const [reason, setReason] = useState('');
  const trip = getTrip(state, b.tripId);
  const st = bookingStatus(state, b);
  const me = state.staffSession;
  const senior = ROLES[me.role].rank >= 70;
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <div className="drawer wide">
        <div className="modal-h"><h3>{b.ref}</h3><StatusPill status={st} map={BOOKING_STATUS} /><button type="button" className="btn-a b-ghost b-xs" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        <div className="modal-b">
          {trip && <TicketCard state={state} b={b} trip={trip} />}
          <div className="dr-acts">
            {st === 'reserved' && <button type="button" className="btn-a b-gold" onClick={() => { update((d) => payReservation(d, b.ref, 'cash', me.name)); toast('Paid in cash. Ticket confirmed and SMS sent.'); }}><Icon name="coins" />Receive cash payment</button>}
            {['confirmed', 'reserved'].includes(st) && <button type="button" className="btn-a b-ghost" onClick={() => { update((d) => { sms(d, b.contact.mobile, fillTemplate(setting(d, 'notifications.sms.booked'), smsValues(d, b))); audit(d, 'booking.resent', `${b.ref} e-ticket resent`); }); toast('E-ticket SMS resent.'); }}><Icon name="send" />Resend ticket</button>}
            {trip && canRebook(state, b, trip) && <button type="button" className="btn-a b-ghost" onClick={() => setModal('rebook')}><Icon name="refresh" />Change trip</button>}
            {['confirmed', 'reserved'].includes(st) && <button type="button" className="btn-a b-ghost" onClick={() => setModal('cancel')}><Icon name="x" />{b.pay.status === 'paid' ? 'Refund' : 'Cancel'}</button>}
            <button type="button" className="btn-a b-ghost" onClick={() => window.print()}><Icon name="file" />Print</button>
          </div>
          <div className="dl">
            <div><span>Booked by</span><b>{b.contact.name} · {b.contact.mobile}{b.contact.email ? ` · ${b.contact.email}` : ''}</b></div>
            <div><span>Channel</span><b>{SOURCE_LABEL[b.source]}{b.by ? ` · ${b.by}` : ''}</b></div>
            <div><span>Payment</span><b>{PAY_LABEL[b.pay.method]} · {b.pay.status}{b.refund ? ` · refunded ${peso(b.refund)}` : ''}</b></div>
            <div><span>Fare + fee</span><b>{peso(b.fare)} + {peso(b.fee)} = {peso(b.total)}</b></div>
            <div><span>Passengers</span><b>{b.pax.map((p) => `${p.seat} ${p.name} (${PAX_TYPES[p.type]}${p.idNo ? ` · ${p.idNo}` : ''})${p.boarded ? ' ✓ boarded' : ''}`).join(' · ')}</b></div>
          </div>
          <h4 style={{ margin: '14px 0 8px' }}>History</h4>
          {b.history.map((h, i) => <div className="hist" key={i}><b>{h.what}</b><span>{new Date(h.at).toLocaleString('en-PH')} · {h.by}</span></div>)}
        </div>
      </div>
      {modal === 'rebook' && <Rebook b={b} trip={trip} by={me.name} onClose={() => setModal(null)} />}
      {modal === 'cancel' && (
        <Modal title={b.pay.status === 'paid' ? `Refund ${b.ref}` : `Cancel ${b.ref}`} onClose={() => setModal(null)} footer={<>
          <button type="button" className="btn-a b-ghost" onClick={() => setModal(null)}>Close</button>
          {b.pay.status === 'paid' && senior && <button type="button" className="btn-a b-ghost" disabled={reason.trim().length < 5} onClick={() => { const a = update((d) => cancelBooking(d, b.ref, { by: me.name, full: true, reason })); toast(`Full refund ${peso(a)} started.`); setModal(null); }}>Full refund (override)</button>}
          <button type="button" className="btn-a b-red" disabled={reason.trim().length < 5} onClick={() => { const a = update((d) => cancelBooking(d, b.ref, { by: me.name, reason })); toast(a ? `Refund ${peso(a)} started.` : 'Cancelled.'); setModal(null); }}>{b.pay.status === 'paid' ? `Refund ${setting(state, 'booking.changes.refundPercent')}%` : 'Cancel'}</button>
        </>}>
          <label className="field"><span>Reason (kept in the audit log)</span><textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Passenger called, family emergency" /></label>
          <p className="mini">{senior ? 'As Terminal Manager or higher you may override the refund policy with a full refund.' : 'Only a Terminal Manager or higher can override the refund policy.'}</p>
        </Modal>
      )}
    </>
  );
}

export function Passengers({ menu, onSignOut }) {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const by = {};
  state.bookings.forEach((b) => {
    const k = normMobile(b.contact.mobile);
    by[k] = by[k] || { name: b.contact.name, mobile: b.contact.mobile, trips: 0, spent: 0, last: '', noShow: 0, acct: state.passengers.find((p) => normMobile(p.mobile) === k) };
    by[k].trips += 1;
    if (b.pay.status === 'paid') by[k].spent += b.total;
    if (b.date > by[k].last) by[k].last = b.date;
    if (bookingStatus(state, b) === 'no_show') by[k].noShow += 1;
  });
  const rows = Object.values(by).filter((r) => !q || `${r.name} ${normMobile(r.mobile)}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.trips - a.trips);
  const full = ROLES[state.staffSession.role].rank >= 70;
  return (
    <>
      <TopBar crumb="Ticketing" title="Passengers" menu={menu} onSignOut={onSignOut}>
        <label className="ctl" style={{ minWidth: 240 }}><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or mobile" style={{ width: '100%' }} /></label>
      </TopBar>
      <div className="pad">
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="k"><div className="l"><Icon name="users" />Passengers</div><div className="v">{rows.length.toLocaleString()}</div><div className="d">unique mobile numbers</div></div>
          <div className="k"><div className="l"><Icon name="user" />With an account</div><div className="v">{state.passengers.length}</div><div className="d">website / app sign-in</div></div>
          <div className="k"><div className="l"><Icon name="refresh" />Repeat travellers</div><div className="v">{rows.filter((r) => r.trips > 1).length}</div><div className="d">2 or more bookings</div></div>
          <div className="k"><div className="l"><Icon name="calendar" />Today</div><div className="v">{state.bookings.filter((b) => b.date === todayYmd()).reduce((s, b) => s + b.pax.length, 0)}</div><div className="d">passengers booked for today</div></div>
        </div>
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Mobile</th><th>Bookings</th><th>Spent</th><th>Last trip</th><th>No-shows</th><th>Account</th></tr></thead>
              <tbody>{rows.slice(0, 120).map((r) => <tr key={r.mobile}><td><b>{r.name}</b></td><td className="mini">{full ? r.mobile : maskMobile(r.mobile)}</td><td>{r.trips}</td><td>{peso(r.spent)}</td><td>{r.last}</td><td>{r.noShow ? <span className="st s-bad">{r.noShow}</span> : 0}</td><td>{r.acct ? <span className="st s-good"><Icon name="check" />{r.acct.points} pts</span> : <span className="mini">Guest</span>}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mini" style={{ marginTop: 10 }}>Guests and account holders are matched by mobile number, so one passenger has one history. Privacy requests (copy, correction, deletion) appear in the audit log.</p>
        </div>
      </div>
    </>
  );
}
