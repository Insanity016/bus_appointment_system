// Trips are not stored one by one: they are expanded from each route's departure list
// (set in the CMS) for the requested date. Only what changes a trip is stored:
// state.tripOps[tripId] = { busId, driverId, conductorId, gate, status, delay, note }
// and state.extraTrips (added by dispatch, e.g. holiday trips).
import { addDays, hash, pad, rng, ymd } from './data.js';
import { setting } from './store.jsx';

// ---------------------------------------------------------------- formatting
export const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const toTime = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
export function fmtTime(t) {
  if (!t) return '';
  if (t instanceof Date) t = `${pad(t.getHours())}:${pad(t.getMinutes())}`;
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}
export function fmtDate(d, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  if (!d) return '';
  return new Date(`${d}T00:00`).toLocaleDateString('en-PH', opts);
}
export const fmtDur = (mins) => `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`;
export const peso = (n) => { const v = Number(n || 0); const d = Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2; return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: 2 })}`; };
export const maskMobile = (m) => (m ? m.replace(/^(\d{4})[-\s]?(\d{3})[-\s]?(\d{0,4})$/, (_, a, b, c) => `${a}•••${c}`) : '');
export const normMobile = (m) => (m || '').replace(/\D/g, '').replace(/^63/, '0');
export const randomCode = (len = 6) => Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
export const tel = (n) => `tel:${(n || '').replace(/\(.*?\)\s*$/, '').replace(/[^\d+]/g, '')}`;
export const todayYmd = () => ymd(new Date());

export function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// ---------------------------------------------------------------- lookups
export const term = (state, id) => state.terminals.find((t) => t.id === id);
export const tName = (state, id) => term(state, id)?.name || id;
export const clsOf = (state, id) => state.classes.find((c) => c.id === id) || state.classes[0];
export const routeName = (state, trip) => `${tName(state, trip.fromId)} → ${tName(state, trip.toId)}`;
export const busOf = (state, id) => state.buses.find((b) => b.id === id);
export const crewOf = (state, id) => state.crew.find((c) => c.id === id);

/** Terminals that appear on at least one active route, hubs first. */
export function servedTerminals(state) {
  const ids = new Set(state.routes.filter((r) => r.on).flatMap((r) => [r.from, r.to]));
  return state.terminals.filter((t) => t.on && ids.has(t.id)).sort((a, b) => (b.hub - a.hub) || a.name.localeCompare(b.name));
}
/** Where you can go from a terminal (direct routes). */
export function destinationsFrom(state, fromId) {
  const ids = new Set();
  state.routes.filter((r) => r.on).forEach((r) => { if (r.from === fromId) ids.add(r.to); if (r.to === fromId) ids.add(r.from); });
  return state.terminals.filter((t) => ids.has(t.id) && t.on);
}

// ---------------------------------------------------------------- seats
/** Seat rows of a bus class: ids like 3C; null = aisle. */
export function seatRows(c) {
  const letters = c.layout === '2-1' ? ['A', null, 'B', 'C'] : ['A', 'B', null, 'C', 'D'];
  const rows = [];
  for (let r = 1; r <= c.rows; r++) rows.push(letters.map((l) => (l ? `${r}${l}` : null)));
  if (c.back) rows.push(Array.from({ length: c.back }, (_, i) => `${c.rows + 1}${'ABCDE'[i]}`));
  return rows;
}
export const seatList = (c) => seatRows(c).flat().filter(Boolean);
export const isWindow = (c, seat) => { const l = seat.replace(/\d+/, ''); return c.layout === '2-1' ? ['A', 'C'].includes(l) : ['A', 'D'].includes(l) || (Number(seat.match(/\d+/)[0]) > c.rows && ['A', 'E'].includes(l)); };
export const isPriority = (state, seat) => Number(seat.match(/\d+/)[0]) <= Number(setting(state, 'booking.priority.rows') || 0);

// ---------------------------------------------------------------- trips
export const tripId = (routeId, dir, date, time) => `${routeId}_${dir}_${date}_${time.replace(':', '')}`;

function build(state, route, dir, date, dep, extra = false) {
  const id = tripId(route.id, dir, date, dep.t);
  const ops = state.tripOps?.[id] || {};
  const cls = ops.cls || dep.c;
  const departAt = new Date(`${date}T${dep.t}`);
  const delay = Number(ops.delay || 0);
  return {
    id, route, routeId: route.id, dir, date, time: dep.t, cls, extra,
    fromId: dir === 'out' ? route.from : route.to,
    toId: dir === 'out' ? route.to : route.from,
    departAt,
    etd: new Date(departAt.getTime() + delay * 60000),
    eta: new Date(departAt.getTime() + (route.mins + delay) * 60000),
    mins: route.mins,
    ops,
  };
}

/** Every trip on a date (optionally from/to a terminal), in departure order. */
export function tripsOn(state, date, { from, to, terminal } = {}) {
  const out = [];
  state.routes.filter((r) => r.on).forEach((r) => {
    ['out', 'back'].forEach((dir) => {
      const f = dir === 'out' ? r.from : r.to;
      const t = dir === 'out' ? r.to : r.from;
      if (from && f !== from) return;
      if (to && t !== to) return;
      if (terminal && f !== terminal && t !== terminal) return;
      r[dir].forEach((dep) => out.push(build(state, r, dir, date, dep)));
    });
  });
  (state.extraTrips || []).filter((x) => x.date === date).forEach((x) => {
    const r = state.routes.find((y) => y.id === x.routeId);
    if (!r) return;
    const trip = build(state, r, x.dir, date, { t: x.t, c: x.c }, true);
    if (from && trip.fromId !== from) return;
    if (to && trip.toId !== to) return;
    if (terminal && trip.fromId !== terminal && trip.toId !== terminal) return;
    out.push(trip);
  });
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.routeId.localeCompare(b.routeId));
}

export function getTrip(state, id) {
  if (!id) return null;
  const [routeId, dir, date, hm] = id.split('_');
  const r = state.routes.find((x) => x.id === routeId);
  if (!r || !hm) return null;
  const t = `${hm.slice(0, 2)}:${hm.slice(2)}`;
  const dep = r[dir]?.find((d) => d.t === t) || (state.extraTrips || []).find((x) => x.routeId === routeId && x.dir === dir && x.date === date && x.t === t);
  if (!dep) return null;
  return build(state, r, dir, date, { t, c: dep.c }, !r[dir]?.some((d) => d.t === t));
}

export const TRIP_STATUS = {
  scheduled: { label: 'Scheduled', cls: 's-mute', icon: 'clock' },
  delayed: { label: 'Delayed', cls: 's-warn', icon: 'alert' },
  boarding: { label: 'Boarding', cls: 's-info', icon: 'ticket' },
  departed: { label: 'On the road', cls: 's-info', icon: 'bus' },
  arrived: { label: 'Arrived', cls: 's-good', icon: 'check' },
  cancelled: { label: 'Cancelled', cls: 's-bad', icon: 'x' },
};

export function tripStatus(trip, now = Date.now()) {
  const o = trip.ops;
  if (o.status === 'cancelled') return 'cancelled';
  if (o.status === 'arrived' || now >= trip.eta.getTime()) return 'arrived';
  if (o.status === 'departed' || now >= trip.etd.getTime()) return 'departed';
  if (o.status === 'boarding' || now >= trip.etd.getTime() - 30 * 60000) return 'boarding';
  if (o.delay) return 'delayed';
  return 'scheduled';
}

/** 0–1 how far along the road the bus is. */
export function progress(trip, now = Date.now()) {
  return Math.max(0, Math.min(1, (now - trip.etd.getTime()) / (trip.eta.getTime() - trip.etd.getTime())));
}

/** Is online sale still open for this trip? Returns null or the reason. */
export function saleClosed(state, trip, now = Date.now()) {
  if (trip.ops.status === 'cancelled') return 'Cancelled';
  if (!trip.route.online) return 'Counter only';
  const cut = Number(setting(state, 'booking.general.cutoffMinutes')) || 0;
  if (trip.departAt.getTime() - cut * 60000 <= now) return 'Online sales closed';
  return null;
}

// ---------------------------------------------------------------- seat sales
const daysFromToday = (date) => Math.round((new Date(`${date}T00:00`) - new Date(`${todayYmd()}T00:00`)) / 86400000);

/**
 * Seats already sold before the prototype's own bookings (terminal counters, other channels).
 * Deterministic per trip so every visitor sees the same bus.
 */
export function baseTaken(state, trip) {
  const c = clsOf(state, trip.cls);
  const d = daysFromToday(trip.date);
  const r = rng(hash(trip.id));
  const [lo, hi] = d < 0 ? [0.7, 0.97] : d === 0 ? [0.4, 0.88] : d === 1 ? [0.25, 0.65] : d <= 3 ? [0.1, 0.42] : d <= 7 ? [0.02, 0.22] : [0, 0.08];
  const md = trip.date.slice(5);
  const peak = md >= '10-29' && md <= '11-03' ? 0.18 : 0;
  const frac = Math.min(0.98, lo + r() * (hi - lo) + peak);
  const seats = seatList(c).filter((s) => !isPriority(state, s) || d < 0);
  for (let i = seats.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [seats[i], seats[j]] = [seats[j], seats[i]]; }
  return new Set(seats.slice(0, Math.round(frac * seatList(c).length)));
}

export const LIVE = ['reserved', 'confirmed', 'boarded'];

/** Seats not available: earlier sales + bookings + seats on hold while someone pays. */
export function takenSeats(state, trip, { ignoreRef, now = Date.now() } = {}) {
  const s = baseTaken(state, trip);
  state.bookings.forEach((b) => { if (b.tripId === trip.id && b.ref !== ignoreRef && LIVE.includes(b.status)) b.pax.forEach((p) => s.add(p.seat)); });
  (state.holds || []).forEach((h) => { if (h.tripId === trip.id && new Date(h.until).getTime() > now && h.ref !== ignoreRef) h.seats.forEach((x) => s.add(x)); });
  return s;
}

export function seatsLeft(state, trip) {
  const c = clsOf(state, trip.cls);
  return seatList(c).length - takenSeats(state, trip).size;
}

// ---------------------------------------------------------------- fares
export const PAX_TYPES = { regular: 'Regular', student: 'Student', senior: 'Senior citizen', pwd: 'PWD' };

export function peakPercent(state, date) {
  const p = state.settings.discounts.peak;
  if (!p.enabled || !p.percent) return 0;
  if (p.from && date < p.from) return 0;
  if (p.to && date > p.to) return 0;
  return Number(p.percent);
}

/** Fare of one seat for a passenger type. */
export function paxFare(state, trip, type = 'regular') {
  const base = Math.round(trip.route.fares[trip.cls] * (1 + peakPercent(state, trip.date) / 100));
  const pct = type === 'regular' ? 0 : Number(state.settings.discounts.types[type]) || 0;
  const discount = Math.round(base * pct) / 100;
  return { base, discount, fare: base - discount };
}

export const lowestFare = (route) => Math.min(...Object.values(route.fares));

// ---------------------------------------------------------------- bookings
export const BOOKING_STATUS = {
  reserved: { label: 'Reserved · unpaid', cls: 's-warn', icon: 'clock' },
  confirmed: { label: 'Confirmed', cls: 's-info', icon: 'check' },
  boarded: { label: 'Boarded', cls: 's-good', icon: 'bus' },
  completed: { label: 'Completed', cls: 's-good', icon: 'check' },
  cancelled: { label: 'Cancelled', cls: 's-mute', icon: 'x' },
  refunded: { label: 'Refunded', cls: 's-mute', icon: 'refresh' },
  no_show: { label: 'No-show', cls: 's-bad', icon: 'x' },
};
export const SOURCE_LABEL = { website: 'Website', app: 'Mobile app', counter: 'Terminal counter', phone: 'Phone', facebook: 'Facebook / Messenger', conductor: 'On board (conductor)' };
export const PAY_LABEL = { gcash: 'GCash', maya: 'Maya', card: 'Visa / Mastercard', qrph: 'QR Ph', cash: 'Cash', terminal: 'Pay at the terminal' };

export const nextRef = (state, prefix = 'FS') => `${prefix}-${new Date().getFullYear()}-${String(state.seq).padStart(6, '0')}`;

/** Status as the passenger sees it (a confirmed ticket becomes completed or no-show after the trip). */
export function bookingStatus(state, b, now = Date.now()) {
  if (!['confirmed', 'boarded', 'reserved'].includes(b.status)) return b.status;
  const trip = getTrip(state, b.tripId);
  if (!trip) return b.status;
  const st = tripStatus(trip, now);
  if (st === 'cancelled') return b.status;
  if (st === 'arrived') return b.status === 'boarded' || b.pax.some((p) => p.boarded) ? 'completed' : b.status === 'reserved' ? 'cancelled' : 'no_show';
  return b.status;
}

export function hoursBefore(trip, now = Date.now()) { return (trip.departAt.getTime() - now) / 3600000; }
export function canRebook(state, b, trip) { return ['confirmed', 'reserved'].includes(b.status) && trip && hoursBefore(trip) > Number(setting(state, 'booking.changes.rebookHours')); }
export function canRefund(state, b, trip) {
  if (!trip) return false;
  if (trip.ops.status === 'cancelled' && b.status === 'confirmed') return true;
  return b.status === 'confirmed' && b.pay.status === 'paid' && hoursBefore(trip) > Number(setting(state, 'booking.changes.refundHours'));
}

/** Fill an SMS template. */
export function fillTemplate(tpl, values) {
  return (tpl || '').replace(/\{(\w+)\}/g, (m, k) => values[k] ?? m);
}
export function smsValues(state, b, extra = {}) {
  const trip = getTrip(state, b.tripId);
  const bus = trip && busOf(state, trip.ops.busId);
  return {
    name: b.contact.name.split(' ')[0],
    ref: b.ref,
    route: trip ? `${tName(state, trip.fromId)}-${tName(state, trip.toId)}` : '',
    date: trip ? fmtDate(trip.date, { month: 'short', day: 'numeric' }) : '',
    time: trip ? fmtTime(trip.time) : '',
    seats: b.pax.map((p) => p.seat).join(','),
    terminal: trip ? tName(state, trip.fromId) : '',
    bus: bus ? bus.bodyNo : '',
    gate: trip?.ops.gate || 'the gate',
    link: `${window.location.host}/ticket/${b.ref}`,
    ...extra,
  };
}

// ---------------------------------------------------------------- manifest for the sample seats
const NAMES = ['M. Santos', 'J. Reyes', 'A. Cruz', 'R. Bautista', 'L. Garcia', 'K. Mendoza', 'P. Ramos', 'D. Aquino', 'C. Villanueva', 'E. Castillo', 'G. Flores', 'H. Torres', 'I. Navarro', 'N. Domingo', 'T. Soriano', 'V. Lopez'];
/** Passengers for the seats in baseTaken (counter sales before the prototype), for the manifest. */
export function sampleManifest(state, trip) {
  const r = rng(hash(`${trip.id}m`));
  return [...baseTaken(state, trip)].map((seat) => {
    const x = r();
    return { seat, name: `${NAMES[Math.floor(r() * NAMES.length)]}-Test`, type: x < 0.82 ? 'regular' : x < 0.9 ? 'student' : x < 0.97 ? 'senior' : 'pwd', source: 'counter', boarded: tripStatus(trip) === 'departed' || tripStatus(trip) === 'arrived' ? r() < 0.97 : r() < 0.4 };
  });
}

// ---------------------------------------------------------------- map
/** Project a lat/lng on the schematic Luzon map (viewBox 0 0 400 520). */
export const MAP = { minLng: 119.55, maxLng: 122.45, minLat: 14.0, maxLat: 18.75, w: 400, h: 520 };
export const project = (p) => [((p.lng - MAP.minLng) / (MAP.maxLng - MAP.minLng)) * MAP.w, ((MAP.maxLat - p.lat) / (MAP.maxLat - MAP.minLat)) * MAP.h];
// Rough outline of Central & Northern Luzon (schematic, not to scale).
const COAST = [[120.95, 14.55], [120.6, 14.42], [120.45, 14.6], [120.25, 14.85], [120.05, 15.3], [119.92, 15.8], [119.78, 16.15], [119.85, 16.42], [120.05, 16.35], [120.2, 16.08], [120.35, 16.05], [120.42, 16.3], [120.33, 16.65], [120.42, 17.1], [120.45, 17.6], [120.55, 18.2], [120.85, 18.6], [121.25, 18.62], [121.9, 18.3], [122.25, 18.52], [122.22, 17.6], [122.12, 17.0], [121.62, 16.25], [121.55, 15.75], [121.62, 15.3], [121.45, 14.75], [121.62, 14.2], [121.3, 14.1], [121.0, 14.25]];
export const COAST_PATH = `${COAST.map(([lng, lat], i) => `${i ? 'L' : 'M'}${project({ lng, lat }).map((v) => v.toFixed(1)).join(',')}`).join('')}Z`;

/** Position of a bus along its route (straight line between the two terminals, slightly curved). */
export function busPoint(state, trip, now = Date.now()) {
  const a = term(state, trip.fromId);
  const b = term(state, trip.toId);
  const t = progress(trip, now);
  const bend = Math.sin(t * Math.PI) * 0.12;
  return { lat: a.lat + (b.lat - a.lat) * t + bend * (b.lng - a.lng) * 0.3, lng: a.lng + (b.lng - a.lng) * t - bend * (b.lat - a.lat) * 0.3 };
}

export const dateList = (state) => {
  const days = Number(setting(state, 'booking.general.maxDays')) || 30;
  return Array.from({ length: days + 1 }, (_, i) => ymd(addDays(new Date(), i)));
};
