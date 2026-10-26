// Sample operations data: dispatch, bookings, passengers and the Phase 2–3 modules.
// Everything is generated with a fixed seed, around "today", so every visitor sees the same data.
import { addDays, pad, rng, ymd } from './data.js';
import { baseTaken, clsOf, getTrip, paxFare, seatList, tripStatus, tripsOn } from './trips.js';

// A bus may be dispatched only with PMS done and papers valid (same rule as the dispatch board).
const roadworthy = (b, today) => b.status === 'active' && b.odometer - b.lastPmsKm <= 5000 && [b.regExpiry, b.cpcExpiry, b.insExpiry].every((d) => d >= today);

const OWNERS = ['A. Santos-Test', 'R. Cruz-Test', 'J. Dela Cruz-Test', 'M. Reyes-Test', 'L. Garcia-Test', 'P. Lim-Test', 'K. Bautista-Test', 'D. Mendoza-Test', 'C. Ramos-Test', 'E. Navarro-Test', 'G. Torres-Test', 'H. Aquino-Test', 'I. Villanueva-Test', 'N. Castillo-Test', 'T. Flores-Test', 'V. Gonzales-Test', 'B. Soriano-Test', 'F. Domingo-Test', 'S. Manalo-Test', 'O. Fernandez-Test'];
const PAX = ['Ana', 'Ben', 'Carlo', 'Dina', 'Eli', 'Faye', 'Gino', 'Hazel', 'Ivy', 'Jun', 'Kat', 'Leo', 'Mia', 'Nico', 'Olive', 'Paolo'];
const GATES = ['Gate 1', 'Gate 2', 'Gate 3', 'Gate 4', 'Gate 5', 'Gate 6'];

export const DEMO_PASSENGER = { mobile: '0917-555-0101', name: 'Juan Dela Cruz-Test' };

/** Assign buses (and their regular crew) to today's and tomorrow's trips, greedily by time. */
function dispatch(state, r) {
  const ops = {};
  const freeAt = {};
  const now = Date.now();
  [0, 1].forEach((d) => {
    const date = ymd(addDays(new Date(), d));
    tripsOn(state, date).forEach((trip, i) => {
      const pool = state.buses.filter((b) => b.cls === trip.cls && roadworthy(b, ymd(new Date())));
      const bus = pool.find((b) => !freeAt[b.id] || freeAt[b.id] <= trip.departAt.getTime());
      const o = { gate: GATES[i % GATES.length] };
      if (bus) {
        o.busId = bus.id; o.driverId = bus.driverId; o.conductorId = bus.conductorId;
        freeAt[bus.id] = trip.departAt.getTime() + (trip.mins + 75) * 60000;
      }
      // A few delays so the boards and SMS advisories have something to show.
      const soon = trip.departAt.getTime() - now;
      if (soon > -60 * 60000 && soon < 5 * 3600000 && r() < 0.07) o.delay = [15, 20, 30, 45][Math.floor(r() * 4)];
      ops[trip.id] = o;
    });
  });
  return ops;
}

function extraTrips() {
  // Undas 2026 additional departures (Oct 29 – Nov 2), as announced on the homepage.
  const list = [];
  ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'].forEach((date) => {
    [['cub-dag', 'out', '22:30', 'regular'], ['cub-dag', 'out', '23:30', 'regular'], ['cub-sca', 'out', '22:15', 'regular'], ['cub-tug', 'out', '21:30', 'premium'], ['pas-ala', 'out', '23:00', 'deluxe'], ['cub-cab', 'out', '22:30', 'regular']]
      .forEach(([routeId, dir, t, c]) => list.push({ routeId, dir, date, t, c, note: 'Undas extra trip' }));
  });
  return list;
}

function seedBookings(state, r) {
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const now = Date.now();
  const used = {};
  const bookings = [];
  let seq = 1;
  const year = new Date().getFullYear();
  for (let day = -60; day <= 10; day++) {
    const date = ymd(addDays(new Date(), day));
    const trips = tripsOn(state, date);
    const weekend = [0, 5, 6].includes(new Date(`${date}T00:00`).getDay());
    const perDay = day < 0 ? Math.round((weekend ? 21 : 14) + r() * 7 + (60 + day) * 0.12) : day === 0 ? 34 : Math.max(3, 22 - day * 2);
    for (let k = 0; k < perDay; k++) {
      const featured = trips.filter((t) => t.route.featured);
      const trip = r() < 0.6 && featured.length ? pick(featured) : pick(trips);
      const c = clsOf(state, trip.cls);
      const taken = used[trip.id] || (used[trip.id] = baseTaken(state, trip));
      const free = seatList(c).filter((s) => !taken.has(s));
      if (!free.length) continue;
      const n = Math.min(free.length, r() < 0.55 ? 1 : r() < 0.75 ? 2 : r() < 0.9 ? 3 : 4);
      const start = Math.floor(r() * (free.length - n + 1));
      const seats = free.slice(start, start + n);
      seats.forEach((s) => taken.add(s));
      const oi = Math.floor(r() * OWNERS.length);
      const x = r();
      const source = x < 0.34 ? 'website' : x < 0.6 ? 'app' : x < 0.9 ? 'counter' : x < 0.95 ? 'phone' : 'facebook';
      const online = ['website', 'app'].includes(source);
      const y = r();
      const method = online ? (y < 0.52 ? 'gcash' : y < 0.72 ? 'maya' : y < 0.9 ? 'card' : 'qrph') : 'cash';
      const pax = seats.map((seat, i) => {
        const z = r();
        const type = z < 0.8 ? 'regular' : z < 0.9 ? 'student' : z < 0.97 ? 'senior' : 'pwd';
        const f = paxFare(state, trip, type);
        return { seat, name: i === 0 ? OWNERS[oi] : `${pick(PAX)} ${OWNERS[oi].split(' ')[1]}`, type, idNo: type === 'regular' ? '' : `ID-${100000 + Math.floor(r() * 899999)}`, ...f, boarded: false };
      });
      const fee = online ? 15 * pax.length : 0;
      const fare = pax.reduce((s, p) => s + p.fare, 0);
      const st = tripStatus(trip, now);
      let status = 'confirmed';
      let payStatus = 'paid';
      if (st === 'arrived' || st === 'departed') {
        const z = r();
        status = z < 0.88 ? 'boarded' : z < 0.93 ? 'confirmed' : z < 0.97 ? 'cancelled' : 'refunded';
        if (status === 'boarded') pax.forEach((p) => { p.boarded = true; });
        if (status === 'refunded') payStatus = 'refunded';
      } else if (online && r() < 0.08) {
        status = 'reserved'; payStatus = 'unpaid';
      } else if (st === 'boarding' && r() < 0.5) {
        status = 'boarded'; pax.forEach((p) => { p.boarded = true; });
      }
      let created = new Date(trip.departAt.getTime() - (online ? (1 + r() * 9) * 86400000 : r() * 3 * 3600000));
      // Tickets for later trips were sold some time before now (never "in the future").
      if (created.getTime() > now) created = new Date(now - r() * 3 * 86400000);
      bookings.push({
        id: seq,
        ref: `FS-${year}-${String(seq).padStart(6, '0')}`,
        tripId: trip.id,
        date,
        pax,
        contact: { name: OWNERS[oi], mobile: `0900-555-${String(1000 + oi * 37).slice(-4)}`, email: online && r() < 0.7 ? `${OWNERS[oi].split(' ')[1].toLowerCase().replace(/-test$/, '')}${oi}@example.com` : '' },
        passengerId: oi === 2 ? 'p1' : null,
        fare,
        fee,
        total: fare + fee,
        pay: { method: status === 'reserved' ? 'terminal' : method, status: payStatus, at: payStatus === 'paid' ? created.toISOString() : null },
        status,
        source,
        createdAt: created.toISOString(),
        by: online ? null : 'Ticketing – Cubao (Demo)',
        history: [],
      });
      seq++;
    }
  }
  return { bookings, seq };
}

// Demo passenger's own trips: one upcoming (tomorrow morning) and two past.
function demoTrips(state, bookings, seqStart) {
  let seq = seqStart;
  const year = new Date().getFullYear();
  const make = (tripId, seats, status, dayOffset) => {
    const trip = getTrip(state, tripId);
    if (!trip) return;
    const c = clsOf(state, trip.cls);
    const taken = baseTaken(state, trip);
    bookings.filter((b) => b.tripId === tripId).forEach((b) => b.pax.forEach((p) => taken.add(p.seat)));
    const free = seatList(c).filter((s) => !taken.has(s));
    const chosen = seats.map((s) => (taken.has(s) ? free.shift() : s));
    const pax = chosen.map((seat, i) => ({ seat, name: i ? 'Maria Dela Cruz-Test' : DEMO_PASSENGER.name, type: i ? 'senior' : 'regular', idNo: i ? 'OSCA-123456' : '', ...paxFare(state, trip, i ? 'senior' : 'regular'), boarded: status === 'boarded' }));
    const fare = pax.reduce((s, p) => s + p.fare, 0);
    bookings.push({
      id: seq, ref: `FS-${year}-${String(seq).padStart(6, '0')}`, tripId, date: trip.date, pax,
      contact: { name: DEMO_PASSENGER.name, mobile: DEMO_PASSENGER.mobile, email: 'juan@example.com' }, passengerId: 'p1',
      fare, fee: 15 * pax.length, total: fare + 15 * pax.length, pay: { method: 'gcash', status: 'paid', at: addDays(new Date(), dayOffset - 3).toISOString() },
      status, source: 'app', createdAt: addDays(new Date(), dayOffset - 3).toISOString(), by: null, history: [],
    });
    seq++;
  };
  make(`cub-dag_out_${ymd(addDays(new Date(), 1))}_0800`, ['3A', '3B'], 'confirmed', 1);
  make(`cub-dag_back_${ymd(addDays(new Date(), 4))}_1530`, ['5C', '5D'], 'confirmed', 4);
  make(`cub-dag_out_${ymd(addDays(new Date(), -21))}_0700`, ['4A'], 'boarded', -21);
  make(`cub-tug_out_${ymd(addDays(new Date(), -45))}_1900`, ['2A'], 'boarded', -45);
  return seq;
}

function seedParcels(state, r) {
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const list = [];
  const year = new Date().getFullYear();
  const routes = state.routes.filter((x) => x.featured);
  const ITEMS = ['Box of clothes', 'Documents', 'Balikbayan box', 'Spare parts', 'Rice (1 sack)', 'Dried fish (pasalubong)', 'Laptop (boxed)', 'School supplies', 'Medicines'];
  for (let i = 0; i < 48; i++) {
    const route = pick(routes);
    const out = r() < 0.65;
    const from = out ? route.from : route.to;
    const to = out ? route.to : route.from;
    const days = -Math.floor(r() * 12);
    const created = addDays(new Date(), days);
    created.setHours(6 + Math.floor(r() * 12), Math.floor(r() * 60));
    const kg = Math.round((1 + r() * 24) * 10) / 10;
    const declared = [500, 1000, 2000, 3000, 5000, 10000][Math.floor(r() * 6)];
    const fee = Math.max(120, Math.round(120 + Math.max(0, kg - 3) * 25 + (route.km / 100) * 30 + declared * 0.01));
    const age = -days;
    const status = age >= 3 ? (r() < 0.85 ? 'claimed' : 'arrived') : age === 2 ? pick(['arrived', 'claimed']) : age === 1 ? pick(['in_transit', 'arrived']) : pick(['received', 'loaded', 'in_transit']);
    const events = [{ at: created.toISOString(), status: 'received', where: from }];
    const steps = ['loaded', 'in_transit', 'arrived', 'claimed'];
    let t = created.getTime();
    for (const s of steps) {
      if (steps.indexOf(s) > steps.indexOf(status === 'received' ? 'none' : status)) break;
      t += (s === 'arrived' ? route.mins : 60) * 60000;
      events.push({ at: new Date(Math.min(t, Date.now())).toISOString(), status: s, where: s === 'arrived' || s === 'claimed' ? to : from });
    }
    list.push({
      id: i + 1,
      waybill: `WB-${year}-${String(i + 1).padStart(6, '0')}`,
      from, to,
      sender: { name: pick(OWNERS), mobile: `0900-555-${String(3000 + i * 13).slice(-4)}` },
      receiver: { name: pick(OWNERS), mobile: `0900-555-${String(4000 + i * 17).slice(-4)}` },
      item: pick(ITEMS), pieces: 1 + Math.floor(r() * 3), kg, declared, fee,
      paidBy: r() < 0.8 ? 'sender' : 'receiver',
      status, events, createdAt: created.toISOString(),
    });
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function seedWorkOrders(state, r) {
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const TYPES = [['PMS', 'Preventive maintenance (oil, filters, brakes check)'], ['Repair', 'Aircon not cooling'], ['Repair', 'Brake pads replacement'], ['Tires', 'Replace 2 rear tires'], ['Repair', 'Door actuator fault'], ['PMS', 'Preventive maintenance'], ['Body', 'Side mirror replacement'], ['Electrical', 'USB ports not charging (rows 4–6)']];
  return Array.from({ length: 14 }, (_, i) => {
    const bus = state.buses[Math.floor(r() * state.buses.length)];
    const [type, desc] = pick(TYPES);
    const opened = addDays(new Date(), -Math.floor(r() * 20));
    const status = i < 4 ? 'open' : i < 7 ? 'in_progress' : 'done';
    if (status !== 'done') bus.status = 'maintenance';
    return { id: i + 1, no: `WO-${String(1201 + i)}`, busId: bus.id, type, desc, opened: opened.toISOString(), status, cost: status === 'done' ? 2500 + Math.floor(r() * 30000) : 0, mechanic: pick(['Shop A – Cubao', 'Shop B – Pasay', 'Dagupan yard']), notes: '' };
  });
}

function seedRemittances(state, r) {
  const list = [];
  const today = ymd(new Date());
  tripsOn(state, today, { from: 'cubao' }).filter((t) => tripStatus(t) === 'departed' || tripStatus(t) === 'arrived').slice(-14).forEach((t, i) => {
    const roadside = Math.floor(r() * 9);
    const cash = roadside * Math.round(t.route.fares.regular * (0.3 + r() * 0.5));
    const done = tripStatus(t) === 'arrived' && r() < 0.6;
    const counted = done ? cash - (r() < 0.2 ? Math.round(r() * 120) : 0) : null;
    list.push({ id: i + 1, tripId: t.id, conductorId: t.ops.conductorId, roadside, expected: cash, counted, status: done ? 'received' : 'pending', at: done ? new Date().toISOString() : null });
  });
  return list;
}

function seedCharters() {
  const d = (n) => ymd(addDays(new Date(), n));
  return [
    { id: 1, ref: 'CH-2026-0041', name: 'R. Bautista-Test', org: 'St. Joseph Academy (sample)', mobile: '0900-555-7001', email: 'events@example.com', pickup: 'Quezon City', destination: 'Hundred Islands, Alaminos', date: d(12), returnDate: d(12), pax: 140, buses: 3, cls: 'regular', notes: 'Grade 6 field trip, 5 AM pick-up.', status: 'new', quote: null, createdAt: new Date().toISOString() },
    { id: 2, ref: 'CH-2026-0040', name: 'L. Garcia-Test', org: 'Garcia family reunion', mobile: '0900-555-7002', email: '', pickup: 'Pasay', destination: 'Baguio City', date: d(20), returnDate: d(22), pax: 38, buses: 1, cls: 'deluxe', notes: '3 days, driver lodging needed.', status: 'quoted', quote: { amount: 68000, deposit: 20400, valid: d(5) }, createdAt: addDays(new Date(), -2).toISOString() },
    { id: 3, ref: 'CH-2026-0038', name: 'K. Mendoza-Test', org: 'Acme Logistics (sample)', mobile: '0900-555-7003', email: 'hr@example.com', pickup: 'Caloocan', destination: 'Subic, Zambales', date: d(6), returnDate: d(7), pax: 90, buses: 2, cls: 'deluxe', notes: 'Company outing.', status: 'confirmed', quote: { amount: 112000, deposit: 33600, valid: d(1), paid: true }, busIds: ['b1270', 'b1271'], createdAt: addDays(new Date(), -9).toISOString() },
    { id: 4, ref: 'CH-2026-0031', name: 'P. Lim-Test', org: 'Barangay San Roque (sample)', mobile: '0900-555-7004', email: '', pickup: 'Cubao', destination: 'Manaoag Church, Pangasinan', date: d(-8), returnDate: d(-8), pax: 49, buses: 1, cls: 'regular', notes: 'Pilgrimage.', status: 'completed', quote: { amount: 38000, deposit: 11400, valid: d(-15), paid: true }, createdAt: addDays(new Date(), -25).toISOString() },
  ];
}

export function seedOps(base) {
  const r = rng(20261026);
  const state = { ...base, tripOps: {}, extraTrips: extraTrips(), bookings: [], holds: [] };
  const workOrders = seedWorkOrders(state, r);
  state.tripOps = dispatch(state, r);
  const { bookings, seq } = seedBookings(state, r);
  const seq2 = demoTrips(state, bookings, seq);
  bookings.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const now = new Date();
  return {
    tripOps: state.tripOps,
    extraTrips: state.extraTrips,
    bookings,
    holds: [],
    seq: seq2,
    passengers: [
      { id: 'p1', name: DEMO_PASSENGER.name, mobile: DEMO_PASSENGER.mobile, email: 'juan@example.com', points: 1240, createdAt: addDays(now, -200).toISOString(), saved: [{ name: 'Maria Dela Cruz-Test', type: 'senior', idNo: 'OSCA-123456' }], prefs: { sms: true, email: true, promos: false } },
    ],
    parcels: seedParcels(state, r),
    parcelSeq: 49,
    workOrders,
    remittances: seedRemittances(state, r),
    charters: seedCharters(),
    inquiries: [
      { id: 1, at: addDays(now, -1).toISOString(), name: 'F. Ramos-Test', mobile: '0900-555-0199', email: '', topic: 'Lost item', message: 'I left a black umbrella on the 7:00 AM Cubao–Dagupan bus yesterday, seat 8C.', status: 'new' },
      { id: 2, at: addDays(now, -2).toISOString(), name: 'G. Torres-Test', mobile: '0900-555-0198', email: 'g@example.com', topic: 'Corporate account', message: 'Can our company get monthly billing for employee trips to Tarlac?', status: 'new' },
    ],
    sms: [],
  };
}

export const timeNow = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
