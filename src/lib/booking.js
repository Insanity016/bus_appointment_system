// Ticketing actions shared by the website, the app and the staff portal.
// Each function runs inside update((d) => ...) and changes the draft state.
import { audit, setting, sms } from './store.jsx';
import { clsOf, fillTemplate, fmtTime, getTrip, isPriority, nextRef, paxFare, routeName, seatList, smsValues, takenSeats } from './trips.js';

export const ONLINE = ['website', 'app'];

/** Hold seats while the passenger fills in details and pays. Returns an error or null. */
export function holdSeats(d, key, trip, seats) {
  d.holds = (d.holds || []).filter((h) => h.key !== key && new Date(h.until).getTime() > Date.now());
  const taken = takenSeats(d, trip);
  const clash = seats.filter((s) => taken.has(s));
  if (clash.length) return `Seat ${clash.join(', ')} was just taken by another passenger. Please pick another seat.`;
  d.holds.push({ key, tripId: trip.id, seats, until: new Date(Date.now() + Number(setting(d, 'booking.general.holdMinutes')) * 60000).toISOString() });
  return null;
}

export function releaseHold(d, key) { d.holds = (d.holds || []).filter((h) => h.key !== key); }

/** First free seats from the front (when passengers do not choose, or when rebooking). */
export function autoSeats(d, trip, n, { ignoreRef } = {}) {
  const taken = takenSeats(d, trip, { ignoreRef });
  return seatList(clsOf(d, trip.cls)).filter((s) => !taken.has(s) && !isPriority(d, s)).slice(0, n);
}

/** Create a booking. pax: [{ seat, name, type, idNo }]. method: gcash|maya|card|qrph|cash|terminal */
export function createBooking(d, { trip, pax, contact, method, source, by = null, passengerId = null, holdKey }) {
  const online = ONLINE.includes(source);
  const priced = pax.map((p) => ({ ...p, ...paxFare(d, trip, p.type), boarded: false }));
  const fare = priced.reduce((s, p) => s + p.fare, 0);
  const fee = online ? Number(setting(d, 'booking.general.fee')) * pax.length : 0;
  const reserve = method === 'terminal';
  const now = new Date().toISOString();
  const b = {
    id: d.seq,
    ref: nextRef(d),
    tripId: trip.id,
    date: trip.date,
    pax: priced,
    contact,
    passengerId,
    fare,
    fee,
    total: fare + fee,
    pay: { method, status: reserve ? 'unpaid' : 'paid', at: reserve ? null : now },
    status: reserve ? 'reserved' : 'confirmed',
    source,
    createdAt: now,
    by,
    history: [{ at: now, what: reserve ? 'Reserved (pay at the terminal)' : `Paid ${method === 'cash' ? 'in cash' : 'online'} and confirmed`, by: by || contact.name }],
  };
  d.seq += 1;
  d.bookings.push(b);
  if (holdKey) releaseHold(d, holdKey);
  const release = new Date(trip.departAt.getTime() - Number(setting(d, 'booking.reserve.releaseMinutes')) * 60000);
  if (contact.mobile) sms(d, contact.mobile, fillTemplate(setting(d, reserve ? 'notifications.sms.reserved' : 'notifications.sms.booked'), smsValues(d, b, { release: fmtTime(release) })));
  audit(d, 'booking.created', `${b.ref} · ${routeName(d, trip)} ${trip.date} ${trip.time} · seats ${pax.map((p) => p.seat).join(', ')} · ${source}`, { actor: by || `Passenger ${contact.name}` });
  if (passengerId) {
    const acct = d.passengers.find((p) => p.id === passengerId);
    if (acct && !reserve) acct.points += Math.floor(fare / 10);
  }
  return b;
}

export function payReservation(d, ref, method, by) {
  const b = d.bookings.find((x) => x.ref === ref);
  b.pay = { method, status: 'paid', at: new Date().toISOString() };
  b.status = 'confirmed';
  b.history.push({ at: new Date().toISOString(), what: `Paid (${method})`, by: by || b.contact.name });
  sms(d, b.contact.mobile, fillTemplate(setting(d, 'notifications.sms.booked'), smsValues(d, b)));
  audit(d, 'booking.paid', `${ref} paid (${method})`, { actor: by || `Passenger ${b.contact.name}` });
}

/** Move a booking to another trip (same number of seats). Returns the fee charged. */
export function rebook(d, ref, newTrip, seats, by) {
  const b = d.bookings.find((x) => x.ref === ref);
  const old = getTrip(d, b.tripId);
  const fee = Number(setting(d, 'booking.changes.rebookFee')) * b.pax.length;
  const before = b.fare;
  b.pax = b.pax.map((p, i) => ({ ...p, seat: seats[i], ...paxFare(d, newTrip, p.type) }));
  b.fare = b.pax.reduce((s, p) => s + p.fare, 0);
  const diff = Math.max(0, b.fare - before);
  b.fee += fee;
  b.total = b.fare + b.fee;
  b.tripId = newTrip.id;
  b.date = newTrip.date;
  b.history.push({ at: new Date().toISOString(), what: `Changed from ${old?.date} ${old?.time} to ${newTrip.date} ${newTrip.time}, seats ${seats.join(', ')} (fee ₱${fee}${diff ? ` + fare difference ₱${diff}` : ''})`, by: by || b.contact.name });
  sms(d, b.contact.mobile, fillTemplate(setting(d, 'notifications.sms.booked'), smsValues(d, b)));
  audit(d, 'booking.changed', `${ref} moved to ${newTrip.date} ${newTrip.time}`, { actor: by || `Passenger ${b.contact.name}` });
  return fee + diff;
}

/** Cancel (reserved) or refund (paid). full = trip cancelled by Five Star. Returns the refund amount. */
export function cancelBooking(d, ref, { by, full = false, reason = '' } = {}) {
  const b = d.bookings.find((x) => x.ref === ref);
  let amount = 0;
  if (b.pay.status === 'paid') {
    amount = full ? b.total : Math.round(b.fare * Number(setting(d, 'booking.changes.refundPercent'))) / 100;
    b.pay.status = 'refunded';
    b.status = 'refunded';
  } else {
    b.status = 'cancelled';
  }
  b.refund = amount;
  b.history.push({ at: new Date().toISOString(), what: amount ? `Refunded ₱${amount}${reason ? ` (${reason})` : ''}` : `Cancelled${reason ? ` (${reason})` : ''}`, by: by || b.contact.name });
  audit(d, amount ? 'booking.refunded' : 'booking.cancelled', `${ref} ${amount ? `refunded ₱${amount}` : 'cancelled'}${reason ? ` · ${reason}` : ''}`, { actor: by || `Passenger ${b.contact.name}`, severity: amount ? 'warning' : 'info' });
  return amount;
}

/**
 * Board a ticket on a trip (QR scan or typed reference). Returns { ok, msg }.
 * Refuses tickets for another trip, unpaid reservations, cancelled or already-used tickets.
 */
export function boardTicket(d, code, tripId, by) {
  const ref = String(code).split('|')[0].trim().toUpperCase();
  const b = d.bookings.find((x) => x.ref.toUpperCase() === ref);
  if (!b) return { ok: false, msg: `No ticket ${ref}.` };
  if (b.tripId !== tripId) { const t = getTrip(d, b.tripId); return { ok: false, msg: `Wrong bus: ${ref} is for ${t ? `${t.date} ${t.time} ${routeName(d, t)}` : 'another trip'}.` }; }
  if (b.status === 'reserved') return { ok: false, msg: `${ref} is not paid yet. Collect payment at the counter first.` };
  if (!['confirmed', 'boarded'].includes(b.status)) return { ok: false, msg: `${ref} is ${b.status}.` };
  if (b.status === 'boarded') return { ok: false, msg: `${ref} was already scanned (seats ${b.pax.map((p) => p.seat).join(', ')}).` };
  b.status = 'boarded';
  b.pax.forEach((p) => { p.boarded = true; });
  b.history.push({ at: new Date().toISOString(), what: 'Boarded (ticket scanned)', by });
  audit(d, 'boarding.scanned', `${ref} boarded · seats ${b.pax.map((p) => p.seat).join(', ')}`, { actor: by });
  const disc = b.pax.filter((p) => p.type !== 'regular');
  return { ok: true, msg: `${ref} OK · seat ${b.pax.map((p) => p.seat).join(', ')} · ${b.pax[0].name}${disc.length ? ` · CHECK ID: ${disc.map((p) => `${p.seat} ${p.type}`).join(', ')}` : ''}` };
}

/** Send an OTP (simulated): logs the SMS and returns the code. */
export function sendOtp(d, mobile, code) {
  sms(d, mobile, fillTemplate(setting(d, 'notifications.sms.otp'), { code }), 'otp');
}
