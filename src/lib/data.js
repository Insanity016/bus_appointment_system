// Starting content for the prototype. Everything here is "CMS data": the admin
// changes it in the admin portal and the change is saved in this browser.
// Terminals, routes and departure times come from fivestarph.com (Routes & Schedules).
// Fares, buses, crew and passengers are SAMPLES; people are fictional ("-Test").

import { seedOps } from './seed.js';

export const DATA_VERSION = 4;

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Small deterministic random generator so the sample data is the same for everyone.
export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
export function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------------------------------------------------------------- terminals
const HOTLINE = '0927-712-4349';
const TERMINALS = [
  { id: 'cubao', name: 'Cubao', region: 'Metro Manila', area: 'Quezon City', address: '674 EDSA, E. Rodriguez, Cubao, Quezon City', phones: ['(02) 8911-7359', '0927-712-4349 (Globe)', '0943-706-5083 (Sun)'], lat: 14.6205, lng: 121.0530, hub: true },
  { id: 'pasay', name: 'Pasay', region: 'Metro Manila', area: 'Pasay City', address: 'Aurora Blvd. (Tramo), Pasay City · Head office', phones: [HOTLINE], lat: 14.5434, lng: 120.9982, hub: true },
  { id: 'caloocan', name: 'Caloocan', region: 'Metro Manila', area: 'Caloocan City', address: 'Rizal Avenue Extension, Caloocan City', phones: [HOTLINE], lat: 14.6566, lng: 120.9840, hub: true },
  { id: 'avenida', name: 'Avenida', region: 'Metro Manila', area: 'Sta. Cruz, Manila', address: 'Doroteo Jose St., Sta. Cruz, Manila (shared terminal)', phones: [HOTLINE], lat: 14.6050, lng: 120.9820, hub: true },
  { id: 'dagupan', name: 'Dagupan', region: 'Pangasinan', area: 'Dagupan City', lat: 16.0433, lng: 120.3333 },
  { id: 'sancarlos', name: 'San Carlos', region: 'Pangasinan', area: 'San Carlos City', address: '138 Rizal Avenue, San Carlos City, Pangasinan', lat: 15.9281, lng: 120.3486 },
  { id: 'alaminos', name: 'Alaminos', region: 'Pangasinan', area: 'Alaminos City (Hundred Islands)', lat: 16.1553, lng: 119.9806 },
  { id: 'bolinao', name: 'Bolinao', region: 'Pangasinan', area: 'Bolinao', lat: 16.3881, lng: 119.8950 },
  { id: 'anda', name: 'Anda', region: 'Pangasinan', area: 'Anda', lat: 16.2893, lng: 119.9493 },
  { id: 'agno', name: 'Agno', region: 'Pangasinan', area: 'Agno', lat: 16.1160, lng: 119.8027 },
  { id: 'tayug', name: 'Tayug', region: 'Pangasinan', area: 'Tayug', address: '103 Mabini St., Tayug, Pangasinan', lat: 16.0270, lng: 120.7440 },
  { id: 'tarlac', name: 'Tarlac (Siesta)', region: 'Tarlac', area: 'Tarlac City', lat: 15.4755, lng: 120.5963 },
  { id: 'cabanatuan', name: 'Cabanatuan', region: 'Nueva Ecija', area: 'Cabanatuan City', lat: 15.4865, lng: 120.9667 },
  { id: 'sanantonio', name: 'San Antonio', region: 'Nueva Ecija', area: 'San Antonio, Nueva Ecija', lat: 15.3060, lng: 120.8570 },
  { id: 'santiago', name: 'Santiago', region: 'Isabela', area: 'Santiago City', lat: 16.6880, lng: 121.5490 },
  { id: 'maddela', name: 'Maddela', region: 'Quirino', area: 'Maddela', lat: 16.3420, lng: 121.6910 },
  { id: 'piat', name: 'Piat', region: 'Cagayan', area: 'Piat', lat: 17.7900, lng: 121.4770 },
  { id: 'tuguegarao', name: 'Tuguegarao', region: 'Cagayan', area: 'Tuguegarao City', lat: 17.6132, lng: 121.7270 },
].map((t) => ({ address: '', phones: [HOTLINE], hub: false, hours: t.hub ? 'Open 24 hours' : '4:00 AM – 11:00 PM', parcels: true, photo: null, on: true, ...t }));

// ---------------------------------------------------------------- bus classes
export const CLASSES = [
  { id: 'regular', name: 'Regular Aircon', short: 'Regular', layout: '2-2', rows: 11, back: 5, seats: 49, amenities: ['Air-conditioned', 'Reclining seats', 'CCTV on board'], text: 'Our everyday air-conditioned bus: frequent trips at the lowest fare.', color: '#2A4FB0', charterDay: 18000, on: true },
  { id: 'deluxe', name: 'Deluxe', short: 'Deluxe', layout: '2-2', rows: 10, back: 0, seats: 40, amenities: ['Wider reclining seats', 'On-board toilet', 'USB charging', 'Free Wi-Fi'], text: 'More legroom, a toilet on board and charging at every seat.', color: '#0E9AA7', charterDay: 24000, on: true },
  { id: 'premium', name: 'Premium First Class', short: 'Premium', layout: '2-1', rows: 9, back: 0, seats: 27, amenities: ['Extra-wide seats with leg rest', 'Blanket and pillow', 'Snack and water', 'Power outlet & USB', 'On-board toilet', 'Free Wi-Fi'], text: '27 extra-wide seats, leg rests and a snack. Best for long night trips.', color: '#B7791F', charterDay: 32000, on: true },
];

// ---------------------------------------------------------------- routes
// Departure lists from the published schedule. every(from, to, hours) expands "every N hours".
const every = (from, to, step = 1) => {
  const [h0, m0] = from.split(':').map(Number);
  const [h1] = to.split(':').map(Number);
  const out = [];
  for (let m = h0 * 60 + m0; m <= h1 * 60 + m0; m += step * 60) out.push(`${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`);
  return out;
};
// Class of each departure: night trips on long routes get Deluxe/Premium (set per departure in the CMS).
const classed = (times, long) => times.map((t) => {
  const h = Number(t.slice(0, 2));
  let c = 'regular';
  if (long && (h >= 19 || h < 2)) c = h % 2 ? 'premium' : 'deluxe';
  else if (long && h % 4 === 1) c = 'deluxe';
  return { t, c };
});

const R = (id, from, to, via, km, mins, base, out, back, opts = {}) => {
  const long = mins >= 300;
  return {
    id, from, to, via, km, mins,
    fares: { regular: base, deluxe: Math.round((base * 1.18) / 5) * 5, premium: Math.round((base * 1.55) / 5) * 5 },
    out: classed(out, long),
    back: classed(back, long),
    stops: opts.stops || [],
    featured: !!opts.featured,
    photo: null,
    online: true,
    on: true,
  };
};

const ROUTES = [
  R('cub-dag', 'cubao', 'dagupan', 'TPLEX', 210, 240, 455, every('04:00', '22:00', 1), every('03:30', '21:30', 1), { featured: true, stops: ['Tarlac (TPLEX exit)', 'Urdaneta', 'Mapandan'] }),
  R('cub-sca', 'cubao', 'sancarlos', 'TPLEX', 220, 300, 496, every('03:00', '21:00', 1), every('02:30', '20:30', 1), { featured: true, stops: ['Tarlac (TPLEX exit)', 'Rosales', 'Malasiqui'] }),
  R('cub-ala', 'cubao', 'alaminos', 'TPLEX', 250, 330, 560, every('00:00', '22:00', 2), every('01:00', '21:00', 2), { featured: true, stops: ['Tarlac', 'Urbiztondo', 'Mangatarem', 'Bani'] }),
  R('cub-bol', 'cubao', 'bolinao', 'Alaminos', 275, 360, 610, every('01:00', '21:00', 2), every('01:00', '21:00', 2), { featured: true, stops: ['Tarlac', 'Mangatarem', 'Alaminos', 'Bani'] }),
  R('cub-and', 'cubao', 'anda', 'Alaminos', 285, 390, 620, ['03:20', '05:20', '08:00', '12:40', '16:00', '16:40', '19:20', '23:40'], ['00:20', '02:30', '07:30', '09:30', '15:30', '21:45'], { stops: ['Alaminos', 'Bani'] }),
  R('cub-agn', 'cubao', 'agno', 'Alaminos', 290, 390, 630, ['06:30', '15:00', '17:00', '18:30', '19:30'], ['09:30', '10:30'], { stops: ['Alaminos', 'Burgos'] }),
  R('cub-tay', 'cubao', 'tayug', 'TPLEX', 200, 360, 447, every('04:00', '20:00', 2), every('03:20', '13:20', 1), { stops: ['Rosales', 'Asingan'] }),
  R('cub-tar', 'cubao', 'tarlac', 'NLEX–SCTEX', 125, 150, 285, every('04:00', '20:00', 1), every('03:00', '17:00', 1), { stops: ['Capas'] }),
  R('cub-cab', 'cubao', 'cabanatuan', 'SCTEX', 115, 180, 265, every('03:00', '22:00', 1), every('01:30', '21:30', 1), { featured: true, stops: ['San Leonardo'] }),
  R('cub-san', 'cubao', 'sanantonio', 'Bulacan', 105, 180, 240, every('06:00', '20:00', 2), every('02:00', '14:00', 2)),
  R('cub-stg', 'cubao', 'santiago', 'Nueva Ecija', 330, 540, 780, ['05:30', '07:00', '10:00', '13:00', '18:00'], ['05:30', '07:30', '08:30', '18:00'], { stops: ['Cabanatuan', 'San Jose City', 'Bayombong', 'Solano'] }),
  R('cub-mad', 'cubao', 'maddela', 'Santiago', 365, 600, 860, ['20:00', '22:00'], ['16:30', '17:30'], { stops: ['Cabanatuan', 'Santiago', 'Cabarroguis'] }),
  R('cub-pia', 'cubao', 'piat', 'Santiago', 480, 660, 1050, ['21:00'], ['15:30'], { stops: ['Santiago', 'Tuguegarao'] }),
  R('cub-tug', 'cubao', 'tuguegarao', 'Santiago', 485, 660, 1080, ['03:00', '05:30', '08:00', '11:00', '14:00', '17:00', '19:00', '23:00'], ['05:30', '10:00', '12:30', '16:00', '18:00'], { featured: true, stops: ['Cabanatuan', 'Santiago', 'Cauayan', 'Ilagan'] }),
  R('pas-dag', 'pasay', 'dagupan', 'TPLEX', 225, 270, 475, every('04:40', '22:40', 1), every('04:00', '20:00', 2), { stops: ['Tarlac (TPLEX exit)', 'Urdaneta'] }),
  R('pas-sca', 'pasay', 'sancarlos', 'TPLEX', 235, 320, 515, every('05:00', '21:00', 2), every('03:00', '21:00', 2)),
  R('pas-ala', 'pasay', 'alaminos', 'TPLEX', 265, 350, 580, every('02:00', '22:00', 2), every('01:00', '21:00', 2)),
  R('pas-bol', 'pasay', 'bolinao', 'Alaminos', 290, 380, 630, every('00:00', '20:00', 2), every('02:00', '20:00', 2)),
  R('pas-tar', 'pasay', 'tarlac', 'NLEX–SCTEX', 140, 170, 300, every('06:00', '20:00', 1), every('03:00', '17:00', 1)),
  R('pas-cab', 'pasay', 'cabanatuan', 'Bulacan', 130, 200, 285, every('02:00', '22:00', 2), every('01:50', '21:30', 1)),
  R('pas-tug', 'pasay', 'tuguegarao', 'Santiago', 500, 690, 1100, ['20:00'], ['10:00', '15:00']),
  R('cal-dag', 'caloocan', 'dagupan', 'TPLEX', 205, 240, 450, every('06:30', '18:30', 2), every('02:30', '12:30', 2)),
  R('ave-dag', 'avenida', 'dagupan', 'TPLEX', 210, 250, 455, every('10:30', '16:30', 2), every('03:30', '09:30', 2)),
];

// ---------------------------------------------------------------- fleet & crew
const MODELS = {
  regular: ['Higer A80 KLQ6123K', 'Yutong ZK6128H', 'King Long XMQ6118Y2', 'Ankai HFF6121K40', 'Hino RK1JST'],
  deluxe: ['Higer V91 KLQ6119QE3', 'MAN R39 18.350 (Golden Dragon)', 'Yutong ZK6128H'],
  premium: ['Hyundai Universe Space Luxury', 'MAN R39 18.430 "Tourist Star"'],
};
const POOL = { regular: 165, deluxe: 55, premium: 20 };
function seedBuses() {
  const r = rng(5512);
  const today = new Date();
  const hubs = ['cubao', 'cubao', 'cubao', 'pasay', 'pasay', 'caloocan', 'avenida'];
  const list = [];
  let n = 1101;
  Object.entries(POOL).forEach(([cls, count]) => {
    for (let i = 0; i < count; i++) {
      const odo = 80000 + Math.floor(r() * 520000);
      const sincePms = Math.floor(r() * 5400);
      list.push({
        id: `b${n}`,
        bodyNo: String(n),
        plate: `${'ABCDEFGHJKN'[Math.floor(r() * 11)]}${'ABCDEFGHJKLMNPRSTUVWXYZ'[Math.floor(r() * 23)]}${'ABCDEFGHJKLMNPRSTUVWXYZ'[Math.floor(r() * 23)]} ${1000 + Math.floor(r() * 8999)}`,
        cls,
        model: MODELS[cls][Math.floor(r() * MODELS[cls].length)],
        year: 2016 + Math.floor(r() * 10),
        home: hubs[Math.floor(r() * hubs.length)],
        odometer: odo,
        lastPmsKm: odo - sincePms,
        regExpiry: ymd(addDays(today, Math.floor(r() * 400) - 20)),
        cpcExpiry: ymd(addDays(today, Math.floor(r() * 900) + 10)),
        insExpiry: ymd(addDays(today, Math.floor(r() * 360) - 5)),
        gps: `GPS-${String(n).padStart(5, '0')}`,
        status: r() < 0.06 ? 'maintenance' : 'active',
      });
      n++;
    }
  });
  return list;
}

const FIRST = ['Mario', 'Jun', 'Rodel', 'Arnel', 'Dante', 'Boyet', 'Rommel', 'Ernesto', 'Jomar', 'Allan', 'Ramil', 'Noel', 'Edwin', 'Ricky', 'Jerome', 'Leo', 'Ariel', 'Romeo', 'Nestor', 'Joel', 'Celso', 'Gilbert', 'Randy', 'Marvin', 'Jayson', 'Ronald', 'Danilo', 'Eddie', 'Rey', 'Victor'];
const LAST = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Ramos', 'Aquino', 'Villanueva', 'Castillo', 'Flores', 'Torres', 'Navarro', 'Domingo', 'Soriano', 'Fernandez', 'Lopez', 'Gonzales', 'Dela Cruz', 'Manalo'];
// Each bus has a regular driver and conductor (dispatch can swap them per trip).
function seedCrew(buses) {
  const r = rng(7781);
  const today = new Date();
  const list = [];
  buses.forEach((bus, i) => {
    ['driver', 'conductor'].forEach((role, k) => {
      const n = i * 2 + k;
      list.push({
        id: `c${n + 1}`,
        empNo: `E-${2001 + n}`,
        name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}-Test`,
        role,
        mobile: `0900-555-${String(2000 + n * 7).slice(-4)}`,
        license: role === 'driver' ? `N0${Math.floor(r() * 9)}-${10 + Math.floor(r() * 89)}-${100000 + Math.floor(r() * 899999)}` : '',
        licenseExpiry: role === 'driver' ? ymd(addDays(today, Math.floor(r() * 900) - 15)) : '',
        home: bus.home,
        status: r() < 0.05 ? 'leave' : 'active',
        rating: Math.round((4.2 + r() * 0.8) * 10) / 10,
      });
      bus[role === 'driver' ? 'driverId' : 'conductorId'] = `c${n + 1}`;
    });
  });
  return list;
}

// ---------------------------------------------------------------- homepage
export const SECTION_LABELS = {
  hero: ['Hero slides', 'Photos or artwork, headline and buttons'],
  search: ['Trip search', 'From · To · Date · Passengers'],
  advisories: ['Travel advisories', 'Pinned advisories (e.g. holiday trips)'],
  popular: ['Popular routes', 'Featured routes with "from" fares'],
  departures: ['Next departures', 'Live list from the schedule'],
  network: ['Route map', 'All terminals on a map of Luzon'],
  classes: ['Bus classes', 'From Bus classes & amenities'],
  why: ['Why Five Star', 'Counters and promises'],
  app: ['Mobile app', 'Download / install the app'],
  services: ['More services', 'Rent a bus · Parcels · Corporate'],
  reviews: ['Passenger reviews', 'Approved reviews only'],
  news: ['News & FAQs', 'Latest posts and FAQs'],
};

const HOME = {
  sections: Object.keys(SECTION_LABELS).map((id) => ({ id, on: true })),
  hero: {
    autoplay: 7,
    slides: [
      { id: 's1', on: true, eyebrow: 'Over 30 years on the road', headline: 'Kaagapay sa', accent: 'Masayang Paglalakbay.', text: 'Book your seat to Pangasinan, Nueva Ecija, Tarlac and Cagayan Valley in under a minute. Pay with GCash, Maya or card and board with the QR on your phone.', photo: null, art: 'day', alt: 'A Five Star bus on the expressway at sunrise', btn1: 'Book a trip', link1: '/book', btn2: 'Routes & schedules', link2: '/routes' },
      { id: 's2', on: true, eyebrow: 'Undas 2026', headline: 'Extra trips for', accent: 'Undas weekend.', text: 'Additional departures from Cubao and Pasay from October 29 to November 3. Book early: seats go fast.', photo: null, art: 'night', alt: 'A Five Star bus at night', btn1: 'See extra trips', link1: '/news/undas-2026', btn2: 'Book now', link2: '/book' },
      { id: 's3', on: true, eyebrow: 'Rent a bus', headline: 'Group trip?', accent: 'Charter a Five Star.', text: 'Family outings, company events, school field trips: get a quotation for one bus or a whole convoy.', photo: null, art: 'group', alt: 'Two Five Star buses parked side by side', btn1: 'Get a quotation', link1: '/rent-a-bus', btn2: '', link2: '' },
    ],
  },
  searchTitle: 'Where are you going?',
  popularTitle: 'Popular routes',
  popularText: 'Fares shown are the lowest one-way fare. Prices are set by Five Star and may change.',
  departuresTitle: 'Leaving soon',
  networkTitle: 'One network, 18 terminals',
  networkText: 'From Metro Manila to Central Luzon, Pangasinan and Cagayan Valley.',
  classesTitle: 'Choose how you ride',
  whyTitle: 'Parating maaasahan at komportable',
  stats: [
    { value: '30+', label: 'years serving Luzon travellers', icon: 'flag' },
    { value: '18', label: 'terminals in 7 provinces', icon: 'pin' },
    { value: '500+', label: 'trips every day', icon: 'bus' },
    { value: '24/7', label: 'Cubao and Pasay terminals', icon: 'clock' },
  ],
  promises: [
    { icon: 'qr', title: 'Paperless boarding', text: 'Show the QR on your phone. No printing, no queue at the counter.' },
    { icon: 'seat', title: 'Pick your seat', text: 'Window or aisle, front or back: choose on the seat map.' },
    { icon: 'nav', title: 'Track your bus', text: 'See where your bus is and when it will arrive.' },
    { icon: 'shield', title: 'Safe & accredited', text: 'LTFRB-franchised buses, licensed drivers, CCTV on board.' },
  ],
  appTitle: 'Your ticket, always in your pocket',
  appText: 'Install the Five Star app: book in seconds, keep your e-tickets even without signal, track your bus live and earn Star Points on every trip.',
  servicesTitle: 'More than bus tickets',
  reviewsTitle: 'What passengers say',
  newsTitle: 'News & advisories',
};

// ---------------------------------------------------------------- content
const POSTS = [
  { id: 'undas-2026', type: 'advisory', pinned: true, title: 'Undas 2026: extra trips October 29 – November 3', date: '2026-10-20', photo: null, body: 'Five Star adds departures from Cubao and Pasay to Pangasinan, Nueva Ecija and Cagayan Valley for All Saints\' and All Souls\' Day.\n\nBook online to secure your seat. Online sales close 60 minutes before departure; please be at the terminal 30 minutes before your trip.' },
  { id: 'tplex-advisory', type: 'advisory', pinned: false, title: 'Road works on TPLEX: allow extra travel time', date: '2026-10-12', photo: null, body: 'Lane closures near the Rosales exit may add 20 to 30 minutes to trips to Dagupan, San Carlos and Alaminos until the end of the month. Track your bus in the app for the latest arrival time.' },
  { id: 'student-discount', type: 'news', pinned: false, title: 'How to book with your student, senior or PWD discount online', date: '2026-09-28', photo: null, body: 'Choose the passenger type when you enter the passenger details and type your ID number. The 20% discount is applied right away. Bring the same ID when you board; the conductor checks it before you sit down.' },
  { id: 'new-premium', type: 'news', pinned: false, title: 'Premium First Class now on the Cubao – Tuguegarao night trips', date: '2026-09-10', photo: null, body: '27 extra-wide seats with leg rests, a blanket and pillow, a snack and a power outlet at every seat. Available on selected night departures to Cagayan Valley.' },
];

const FAQS = [
  { q: 'How do I board with an online ticket?', a: 'Show the QR code of your e-ticket (in the app, the email or the SMS link) to the conductor at the gate. No need to print or line up at the counter.' },
  { q: 'Until when can I buy a ticket online?', a: 'Online sales close 60 minutes before departure. After that, buy at the terminal counter if seats are left.' },
  { q: 'Can I change or cancel my trip?', a: 'Yes. Open your booking with the reference number and mobile number, then choose Change trip or Cancel. Rebooking is allowed until 3 hours before departure; refunds follow the policy shown when you book.' },
  { q: 'Do you have student, senior and PWD discounts?', a: 'Yes, 20% off for students, senior citizens and persons with disability, as required by law. Enter your ID number when booking and show the ID when boarding.' },
  { q: 'How much baggage can I bring?', a: 'One bag up to 20 kg goes in the baggage compartment free, plus a small bag on your lap or the rack. Excess baggage is paid at the terminal.' },
  { q: 'Can I send a parcel on a Five Star bus?', a: 'Yes. Drop it off at any terminal, pay by weight, and the receiver gets an SMS when it arrives. Track it on our website with the waybill number.' },
];

const REVIEWS = [
  { id: 'r1', name: 'Sample review', where: 'Cubao → Dagupan', rating: 5, text: 'Booked on my phone during lunch, picked a window seat and just showed the QR at the gate. Ang bilis!', approved: true },
  { id: 'r2', name: 'Sample review', where: 'Pasay → Alaminos', rating: 5, text: 'The SMS told me the bus was 20 minutes late before I even left the house. Very helpful.', approved: true },
  { id: 'r3', name: 'Sample review', where: 'Cubao → Tuguegarao (Premium)', rating: 5, text: 'Premium seats are worth it for the 11-hour night trip. Slept the whole way.', approved: true },
  { id: 'r4', name: 'Sample review', where: 'Cabanatuan → Cubao', rating: 4, text: 'Clean bus and friendly conductor. The Cubao terminal was crowded on a Friday.', approved: false },
];

// ---------------------------------------------------------------- settings
// Schema drives the Settings screens. Values live in state.settings[group][section].
export const SETTINGS_SCHEMA = [
  {
    key: 'security', label: 'Security', icon: 'shield', superOnly: true,
    description: 'Sign-in protection, sessions, passwords and one-time codes.',
    sections: [
      {
        key: 'lockout', label: 'Login Lockout', required: true,
        description: 'Locks an account after repeated failed sign-ins. A repeat lockout flags the account as suspicious until a higher-ranking officer unlocks it.',
        fields: [
          { key: 'maxAttempts', label: 'Failed attempts before lock', type: 'number', unit: 'attempts', min: 1, max: 10, default: 3, desc: 'Wrong passwords and wrong authenticator codes both count.' },
          { key: 'windowMinutes', label: 'Count failures within', type: 'number', unit: 'minutes', min: 1, max: 1440, default: 30, desc: 'Older failed attempts no longer count.' },
          { key: 'lockMinutes', label: 'Temporary lock duration', type: 'number', unit: 'minutes', min: 1, max: 1440, default: 15, desc: 'Even the correct password is refused while locked.' },
          { key: 'flagAfterLocks', label: 'Flag as suspicious after', type: 'number', unit: 'lockouts', min: 1, max: 10, default: 2, desc: 'Lockouts within the window below that turn into a hard lock.' },
          { key: 'flagWindowHours', label: 'Lockout window', type: 'number', unit: 'hours', min: 1, max: 720, default: 24 },
          { key: 'showRemaining', label: 'Tell users how many attempts remain', type: 'toggle', default: true },
          { key: 'lockedMessage', label: 'Temporary lock message', type: 'textarea', desc: ':minutes is replaced with the minutes remaining.', default: 'Too many failed sign-in attempts. Your account is locked for :minutes minute(s). Please try again later.' },
          { key: 'flaggedMessage', label: 'Flagged account message', type: 'textarea', default: 'This account has been flagged for suspicious sign-in activity and is locked. Please contact a Super Admin or a higher-ranking officer to unlock it.' },
        ],
      },
      {
        key: 'mfa', label: 'Multi-factor Authentication', description: 'Authenticator-app codes for staff sign-in.',
        fields: [
          { key: 'required', label: 'Require MFA for all staff', type: 'toggle', default: true },
          { key: 'rememberDays', label: 'Remember a trusted device for', type: 'number', unit: 'days', min: 1, max: 90, default: 30 },
          { key: 'crewPin', label: 'Crew app: drivers and conductors sign in with employee no. + 6-digit PIN on assigned phones', type: 'toggle', default: true },
        ],
      },
      {
        key: 'sessions', label: 'Sessions', description: 'How long staff and passengers stay signed in.',
        fields: [
          { key: 'staffIdleMinutes', label: 'Staff idle timeout', type: 'number', unit: 'minutes', min: 5, max: 720, default: 30 },
          { key: 'staffMaxHours', label: 'Staff session maximum length', type: 'number', unit: 'hours', min: 1, max: 72, default: 12 },
          { key: 'counterIdleMinutes', label: 'Ticket counter idle timeout', type: 'number', unit: 'minutes', min: 1, max: 120, default: 10, desc: 'Shared counter computers sign out sooner.' },
          { key: 'passengerDays', label: 'Passenger "remember me" (website and app)', type: 'number', unit: 'days', min: 1, max: 180, default: 60 },
        ],
      },
      {
        key: 'password', label: 'Password Policy', required: true, description: 'Rules every new password must meet.',
        fields: [
          { key: 'minLength', label: 'Minimum length', type: 'number', unit: 'characters', min: 8, max: 64, default: 12 },
          { key: 'mixedCase', label: 'Require upper and lower case letters', type: 'toggle', default: true },
          { key: 'numbers', label: 'Require a number', type: 'toggle', default: true },
          { key: 'symbols', label: 'Require a symbol', type: 'toggle', default: true },
        ],
      },
      {
        key: 'otp', label: 'One-time Codes', required: true, description: 'SMS codes that confirm a passenger\'s mobile number at booking and sign-in.',
        fields: [
          { key: 'length', label: 'Code length', type: 'number', unit: 'digits', min: 4, max: 8, default: 6 },
          { key: 'expiryMinutes', label: 'Code valid for', type: 'number', unit: 'minutes', min: 1, max: 30, default: 5 },
          { key: 'resendSeconds', label: 'Wait before sending a new code', type: 'number', unit: 'seconds', min: 30, max: 600, default: 60 },
          { key: 'maxTries', label: 'Wrong tries allowed per code', type: 'number', unit: 'tries', min: 1, max: 10, default: 5 },
        ],
      },
    ],
  },
  {
    key: 'booking', label: 'Ticketing rules', icon: 'ticket',
    description: 'How online and counter ticketing works. Fares and departures are set per route in Routes, fares & schedules.',
    sections: [
      {
        key: 'general', label: 'Online sales', required: true,
        fields: [
          { key: 'guestBooking', label: 'Allow booking without an account (mobile number confirmed by SMS code)', type: 'toggle', default: true },
          { key: 'maxDays', label: 'Sell tickets up to', type: 'number', unit: 'days ahead', min: 1, max: 180, default: 30 },
          { key: 'cutoffMinutes', label: 'Online sales close', type: 'number', unit: 'min before departure', min: 0, max: 720, default: 60 },
          { key: 'maxSeats', label: 'Seats per booking', type: 'number', unit: 'seats', min: 1, max: 20, default: 6 },
          { key: 'holdMinutes', label: 'Hold the seats while paying', type: 'number', unit: 'minutes', min: 5, max: 60, default: 15 },
          { key: 'fee', label: 'Online convenience fee', type: 'number', unit: '₱ per seat', min: 0, max: 500, default: 15, desc: 'Set to 0 for no fee. Counter sales never have this fee.' },
          { key: 'chooseSeat', label: 'Passengers choose their own seats', type: 'toggle', default: true, desc: 'Off: seats are assigned automatically from the front.' },
        ],
      },
      {
        key: 'reserve', label: 'Reserve now, pay at the terminal', optional: true,
        description: 'Passengers may reserve without paying online. Unpaid seats are released automatically before departure.',
        fields: [
          { key: 'releaseMinutes', label: 'Release unpaid seats', type: 'number', unit: 'min before departure', min: 15, max: 720, default: 120 },
          { key: 'maxPerMobile', label: 'Unpaid reservations per mobile number', type: 'number', unit: 'reservations', min: 1, max: 10, default: 1 },
        ],
      },
      {
        key: 'priority', label: 'Priority seats', required: true,
        description: 'Seats kept for senior citizens, persons with disability and pregnant passengers.',
        fields: [
          { key: 'rows', label: 'Priority rows (from the front)', type: 'number', unit: 'rows', min: 0, max: 4, default: 1 },
          { key: 'releaseMinutes', label: 'Open priority seats to everyone', type: 'number', unit: 'min before departure', min: 0, max: 240, default: 30 },
        ],
      },
      {
        key: 'changes', label: 'Changes, refunds & no-shows', required: true,
        fields: [
          { key: 'rebookHours', label: 'Change trip allowed until', type: 'number', unit: 'hours before', min: 0, max: 72, default: 3 },
          { key: 'rebookFee', label: 'Change-trip fee', type: 'number', unit: '₱ per seat', min: 0, max: 1000, default: 50 },
          { key: 'refundHours', label: 'Refund allowed until', type: 'number', unit: 'hours before', min: 0, max: 168, default: 24 },
          { key: 'refundPercent', label: 'Refund amount', type: 'number', unit: '% of the fare', min: 0, max: 100, default: 80 },
          { key: 'graceMinutes', label: 'Mark as no-show when not boarded', type: 'number', unit: 'min after departure', min: 0, max: 60, default: 5 },
        ],
      },
      {
        key: 'reminders', label: 'Trip reminders',
        fields: [
          { key: 'first', label: 'First reminder', type: 'select', options: { off: 'Off', '1d': '1 day before', '2d': '2 days before' }, default: '1d' },
          { key: 'second', label: 'Second reminder', type: 'select', options: { off: 'Off', '2h': '2 hours before', '3h': '3 hours before', '5h': '5 hours before' }, default: '3h' },
          { key: 'gate', label: 'SMS when boarding starts (with the bus number)', type: 'toggle', default: true },
        ],
      },
    ],
  },
  {
    key: 'discounts', label: 'Fares & discounts', icon: 'tag',
    description: 'Passenger types and their discounts. Student, senior citizen and PWD discounts are required by law (RA 11314, RA 9994, RA 10754).',
    sections: [
      {
        key: 'types', label: 'Passenger types', required: true,
        fields: [
          { key: 'student', label: 'Student discount', type: 'number', unit: '%', min: 0, max: 100, default: 20 },
          { key: 'senior', label: 'Senior citizen discount', type: 'number', unit: '%', min: 0, max: 100, default: 20 },
          { key: 'pwd', label: 'PWD discount', type: 'number', unit: '%', min: 0, max: 100, default: 20 },
          { key: 'childFreeHeight', label: 'Children below this height ride free on a parent\'s lap', type: 'number', unit: 'cm', min: 0, max: 150, default: 100 },
          { key: 'idRequired', label: 'ID number required at booking for discounted fares', type: 'toggle', default: true },
          { key: 'idUpload', label: 'Ask for a photo of the ID when booking online', type: 'toggle', default: false, desc: 'The conductor always checks the ID at boarding.' },
        ],
      },
      {
        key: 'peak', label: 'Peak-season fare', optional: true,
        description: 'Holiday surcharge on selected dates (for example Holy Week, Undas, Christmas), within the fare approved by LTFRB.',
        fields: [
          { key: 'percent', label: 'Surcharge', type: 'number', unit: '%', min: 0, max: 50, default: 0 },
          { key: 'from', label: 'From', type: 'date', default: '' },
          { key: 'to', label: 'Until', type: 'date', default: '' },
        ],
      },
    ],
  },
  {
    key: 'notifications', label: 'Notifications & templates', icon: 'message',
    description: 'Wording of every SMS. {name}, {ref}, {route}, {date}, {time}, {seats}, {bus}, {gate}, {terminal}, {minutes}, {code} and {link} are filled in by the system.',
    sections: [
      {
        key: 'sms', label: 'SMS templates', required: true,
        fields: [
          { key: 'otp', label: 'One-time code', type: 'textarea', default: '{code} is your Five Star code. It expires in 5 minutes. Never share it.' },
          { key: 'booked', label: 'Ticket confirmed', type: 'textarea', default: 'Five Star: {ref} confirmed. {route}, {date} {time}, seat {seats}. Show your QR at the gate: {link}' },
          { key: 'reserved', label: 'Reserved, pay at terminal', type: 'textarea', default: 'Five Star: seats {seats} reserved for {route}, {date} {time}. Pay at the {terminal} counter before {release} or they are released. Ref {ref}.' },
          { key: 'reminder', label: 'Trip reminder', type: 'textarea', default: 'Reminder: your Five Star trip {route} leaves {date} {time}. Be at {terminal} 30 min early. Ticket: {link}' },
          { key: 'gate', label: 'Boarding started', type: 'textarea', default: 'Now boarding: bus {bus} at {gate}, {terminal}. Ref {ref}.' },
          { key: 'delayed', label: 'Trip delayed', type: 'textarea', default: 'Five Star advisory: your {time} trip {route} is delayed by about {minutes} minutes. We are sorry. Track: {link}' },
          { key: 'cancelled', label: 'Trip cancelled by Five Star', type: 'textarea', default: 'Five Star advisory: the {date} {time} trip {route} is cancelled. Choose a new trip or a full refund: {link}' },
          { key: 'parcel', label: 'Parcel arrived (to the receiver)', type: 'textarea', default: 'Five Star Parcel {waybill} from {sender} has arrived at {terminal}. Bring a valid ID to claim it.' },
        ],
      },
      {
        key: 'quiet', label: 'Quiet hours', description: 'No promotional SMS during these hours. Codes, tickets, delays and boarding messages are always sent.',
        fields: [
          { key: 'from', label: 'From', type: 'time', default: '21:00' },
          { key: 'to', label: 'To', type: 'time', default: '07:00' },
        ],
      },
    ],
  },
  {
    key: 'parcels', label: 'Parcels & cargo', icon: 'package',
    description: 'Parcel rates and handling (Phase 2).',
    sections: [
      {
        key: 'rates', label: 'Rates', required: true,
        fields: [
          { key: 'minFee', label: 'Minimum fee', type: 'number', unit: '₱', min: 0, max: 5000, default: 120 },
          { key: 'perKg', label: 'Rate per kg above 3 kg', type: 'number', unit: '₱ / kg', min: 0, max: 500, default: 25 },
          { key: 'perKm', label: 'Distance factor', type: 'number', unit: '₱ per 100 km', min: 0, max: 500, default: 30 },
          { key: 'valuation', label: 'Valuation charge', type: 'number', unit: '% of declared value', min: 0, max: 10, default: 1 },
          { key: 'maxKg', label: 'Maximum weight per piece', type: 'number', unit: 'kg', min: 1, max: 200, default: 50 },
        ],
      },
      {
        key: 'handling', label: 'Handling', required: true,
        fields: [
          { key: 'smsReceiver', label: 'SMS the receiver when the parcel arrives', type: 'toggle', default: true },
          { key: 'storageDays', label: 'Free storage at the terminal', type: 'number', unit: 'days', min: 0, max: 60, default: 7 },
          { key: 'cod', label: 'Allow "receiver pays" (freight collect)', type: 'toggle', default: true },
        ],
      },
    ],
  },
  {
    key: 'fleet', label: 'Fleet & crew', icon: 'bus',
    description: 'Maintenance intervals, document expiry warnings and crew duty limits (Phase 2).',
    sections: [
      {
        key: 'maintenance', label: 'Maintenance', required: true,
        fields: [
          { key: 'pmsKm', label: 'Preventive maintenance every', type: 'number', unit: 'km', min: 1000, max: 30000, default: 5000 },
          { key: 'warnKm', label: 'Warn when PMS is due within', type: 'number', unit: 'km', min: 100, max: 5000, default: 500 },
          { key: 'blockOverdue', label: 'Do not allow dispatch of a bus with overdue PMS', type: 'toggle', default: true },
        ],
      },
      {
        key: 'documents', label: 'Documents', required: true,
        fields: [
          { key: 'warnDays', label: 'Warn before registration, franchise, insurance or license expires', type: 'number', unit: 'days', min: 7, max: 180, default: 30 },
          { key: 'blockExpired', label: 'Do not allow dispatch with an expired document', type: 'toggle', default: true },
        ],
      },
      {
        key: 'duty', label: 'Crew duty', required: true,
        fields: [
          { key: 'maxDriveHours', label: 'Maximum driving per duty', type: 'number', unit: 'hours', min: 4, max: 16, default: 10 },
          { key: 'restHours', label: 'Minimum rest between duties', type: 'number', unit: 'hours', min: 4, max: 24, default: 8 },
          { key: 'twoDriversOver', label: 'Two drivers required on trips longer than', type: 'number', unit: 'hours', min: 4, max: 16, default: 8 },
        ],
      },
    ],
  },
  {
    key: 'integrations', label: 'Integrations', icon: 'globe', superOnly: true,
    description: 'Built in and ready (plug and play). Enter the credentials when Five Star has its accounts, press Test, then switch it on.',
    sections: [
      {
        key: 'paymongo', label: 'PayMongo (online payments)', optional: true, test: ['secretKey', 'publicKey'],
        description: 'Tickets, charter deposits and parcel fees with GCash, Maya, cards and QR Ph.',
        fields: [
          { key: 'mode', label: 'Mode', type: 'select', options: { test: 'Test', live: 'Live' }, default: 'test' },
          { key: 'publicKey', label: 'Public key', type: 'text', default: '', placeholder: 'pk_test_…' },
          { key: 'secretKey', label: 'Secret key', type: 'secret', default: '', placeholder: 'sk_test_…' },
          { key: 'webhookSecret', label: 'Webhook secret', type: 'secret', default: '', placeholder: 'whsk_…' },
          { key: 'gcash', label: 'GCash', type: 'toggle', default: true },
          { key: 'maya', label: 'Maya', type: 'toggle', default: true },
          { key: 'card', label: 'Visa / Mastercard', type: 'toggle', default: true },
          { key: 'qrph', label: 'QR Ph', type: 'toggle', default: true },
        ],
      },
      {
        key: 'semaphore', label: 'Semaphore (SMS)', optional: true, test: ['apiKey'],
        description: 'One-time codes, tickets, reminders, delay advisories and parcel notices.',
        fields: [
          { key: 'apiKey', label: 'API key', type: 'secret', default: '' },
          { key: 'sender', label: 'Sender name (up to 11 characters)', type: 'text', default: 'FIVESTARBUS', max: 11 },
          { key: 'lowCredits', label: 'Warn when credits fall below', type: 'number', unit: 'credits', min: 0, max: 100000, default: 2000 },
        ],
      },
      {
        key: 'email', label: 'Mailjet (email)', optional: true, test: ['apiKey', 'fromEmail'],
        description: 'E-tickets, receipts, password resets, staff invitations and charter quotations.',
        fields: [
          { key: 'provider', label: 'Provider', type: 'select', options: { mailjet: 'Mailjet', smtp: 'Other SMTP server' }, default: 'mailjet' },
          { key: 'apiKey', label: 'API key / user name', type: 'text', default: '' },
          { key: 'secret', label: 'Secret / password', type: 'secret', default: '' },
          { key: 'fromEmail', label: 'Sender email', type: 'text', default: 'customerservice@fivestarbusph.com' },
          { key: 'fromName', label: 'Sender name', type: 'text', default: 'Five Star Bus' },
        ],
      },
      {
        key: 's3', label: 'Amazon S3 (file storage)', optional: true, test: ['bucket', 'accessKey', 'secretKey'],
        description: 'Photos, uploaded IDs, parcel photos, signed charter contracts and backups. Private bucket; files open through links that expire.',
        fields: [
          { key: 'region', label: 'Region', type: 'select', options: { 'ap-southeast-1': 'Asia Pacific (Singapore)', 'ap-east-1': 'Asia Pacific (Hong Kong)', 'ap-northeast-1': 'Asia Pacific (Tokyo)' }, default: 'ap-southeast-1' },
          { key: 'bucket', label: 'Bucket', type: 'text', default: '' },
          { key: 'accessKey', label: 'Access key ID', type: 'text', default: '' },
          { key: 'secretKey', label: 'Secret access key', type: 'secret', default: '' },
        ],
      },
      {
        key: 'maps', label: 'Google Maps', optional: true, test: ['apiKey'],
        description: 'Terminal maps, directions and the live bus map. Until connected, the website uses OpenStreetMap.',
        fields: [{ key: 'apiKey', label: 'API key', type: 'secret', default: '' }],
      },
      {
        key: 'gps', label: 'GPS tracking (Phase 3)', optional: true, test: ['apiKey'],
        description: 'Live bus positions from the crew app on the conductor\'s phone, or from the GPS devices already installed in the buses (provider API).',
        fields: [
          { key: 'source', label: 'Position source', type: 'select', options: { crew: 'Crew app (conductor phone)', provider: 'Installed GPS devices (provider API)' }, default: 'crew' },
          { key: 'apiKey', label: 'Provider API key', type: 'secret', default: '' },
          { key: 'interval', label: 'Update every', type: 'number', unit: 'seconds', min: 10, max: 300, default: 30 },
        ],
      },
      {
        key: 'turnstile', label: 'Cloudflare Turnstile (spam protection)', optional: true, test: ['siteKey', 'secretKey'],
        description: 'An invisible "are you human" check on booking, charter, contact and sign-in forms.',
        fields: [
          { key: 'siteKey', label: 'Site key', type: 'text', default: '' },
          { key: 'secretKey', label: 'Secret key', type: 'secret', default: '' },
        ],
      },
    ],
  },
  {
    key: 'system', label: 'System & maintenance', icon: 'wrench', superOnly: true,
    description: 'Maintenance mode and system housekeeping.',
    sections: [
      {
        key: 'maintenance', label: 'Maintenance Mode', optional: true,
        description: 'Pauses the website and app (and optionally the staff portal) for upgrades. Terminals keep selling tickets at the counter.',
        fields: [
          { key: 'scope', label: 'Who is affected', type: 'select', options: { public: 'Website and passenger app only (staff keep working)', all: 'Everyone except Super Admins' }, default: 'public' },
          { key: 'message', label: 'Message', type: 'textarea', default: 'Online booking is paused while we finish a scheduled upgrade. Our terminals are open and selling tickets as usual. Existing e-tickets remain valid.' },
          { key: 'until', label: 'Back online by (optional)', type: 'datetime', default: '' },
        ],
      },
      {
        key: 'backups', label: 'Backups', required: true, description: 'Encrypted daily backups (handled on the server in the real system).',
        fields: [
          { key: 'time', label: 'Daily backup time', type: 'time', default: '02:00' },
          { key: 'keepDays', label: 'Keep daily backups for', type: 'number', unit: 'days', min: 7, max: 365, default: 30 },
        ],
      },
    ],
  },
];

export function settingsDefaults() {
  const out = {};
  SETTINGS_SCHEMA.forEach((g) => {
    out[g.key] = {};
    g.sections.forEach((s) => {
      out[g.key][s.key] = { enabled: !s.optional };
      s.fields.forEach((f) => { out[g.key][s.key][f.key] = f.default; });
    });
  });
  return out;
}

// ---------------------------------------------------------------- staff
export const ROLES = {
  super_admin: { label: 'Super Admin', rank: 100, perms: ['*'] },
  company_admin: { label: 'Company Admin', rank: 90, perms: ['dashboard', 'trips', 'bookings', 'counter', 'boarding', 'passengers', 'parcels', 'fleet', 'crew', 'remittance', 'charters', 'tracking', 'reports', 'cms', 'inquiries', 'settings', 'staff', 'audit'] },
  terminal_manager: { label: 'Terminal Manager', rank: 70, perms: ['dashboard', 'trips', 'bookings', 'counter', 'boarding', 'passengers', 'parcels', 'crew', 'remittance', 'charters', 'tracking', 'reports', 'inquiries', 'staff'] },
  dispatcher: { label: 'Dispatcher', rank: 50, perms: ['dashboard', 'trips', 'boarding', 'fleet', 'crew', 'tracking'] },
  fleet_manager: { label: 'Fleet & Maintenance', rank: 50, perms: ['dashboard', 'fleet', 'crew', 'tracking', 'reports'] },
  ticketing: { label: 'Ticketing Clerk', rank: 40, perms: ['counter', 'bookings', 'boarding', 'passengers'] },
  cashier: { label: 'Cashier', rank: 40, perms: ['counter', 'bookings', 'remittance'] },
  customer_service: { label: 'Customer Service', rank: 40, perms: ['bookings', 'passengers', 'parcels', 'charters', 'inquiries', 'tracking'] },
  parcel_clerk: { label: 'Parcel Clerk', rank: 30, perms: ['parcels'] },
  content_editor: { label: 'Content Editor', rank: 30, perms: ['cms', 'inquiries'] },
  conductor: { label: 'Conductor', rank: 20, perms: ['boarding'] },
  driver: { label: 'Driver', rank: 20, perms: [] },
};

export const DEMO_PASSWORD = 'Demo@2026!';
export const DEMO_MFA = '123456';
export const DEMO_PIN = '246810';

const ACCOUNTS = [
  { id: 1, name: 'Super Admin (Demo)', email: 'superadmin@demo.test', role: 'super_admin', branches: 'all' },
  { id: 2, name: 'Company Admin (Demo)', email: 'admin@demo.test', role: 'company_admin', branches: 'all' },
  { id: 3, name: 'Terminal Manager – Cubao (Demo)', email: 'manager@demo.test', role: 'terminal_manager', branches: ['cubao'] },
  { id: 4, name: 'Dispatcher – Cubao (Demo)', email: 'dispatcher@demo.test', role: 'dispatcher', branches: ['cubao'] },
  { id: 5, name: 'Ticketing – Cubao (Demo)', email: 'counter@demo.test', role: 'ticketing', branches: ['cubao'] },
  { id: 6, name: 'Cashier – Cubao (Demo)', email: 'cashier@demo.test', role: 'cashier', branches: ['cubao'] },
  { id: 7, name: 'Customer Service (Demo)', email: 'csr@demo.test', role: 'customer_service', branches: 'all' },
  { id: 8, name: 'Fleet & Maintenance (Demo)', email: 'fleet@demo.test', role: 'fleet_manager', branches: 'all' },
  { id: 9, name: 'Parcel Clerk – Cubao (Demo)', email: 'parcel@demo.test', role: 'parcel_clerk', branches: ['cubao'] },
  { id: 10, name: 'Marketing (Demo)', email: 'editor@demo.test', role: 'content_editor', branches: 'all' },
  { id: 11, name: 'Conductor E-2002 (Demo)', email: 'conductor@demo.test', role: 'conductor', branches: ['cubao'] },
].map((a) => ({ ...a, password: DEMO_PASSWORD, status: 'active', failed: 0, lastFailedAt: null, lockedUntil: null, lockCount: 0, lastLoginAt: null, lastLockAt: null, flaggedAt: null }));

// ---------------------------------------------------------------- state
export function defaultState() {
  const buses = seedBuses();
  const crew = seedCrew(buses);
  const home = JSON.parse(JSON.stringify(HOME));
  const base = {
    version: DATA_VERSION,
    seedDate: ymd(new Date()),
    brand: {
      name: 'FIVE STAR',
      sub: 'BUS COMPANY',
      logo: null,
      primary: '#0A2E73',
      accent: '#F2A900',
      tagline: 'Kaagapay sa Masayang Paglalakbay',
      tagline2: 'Parating maaasahan at komportable, saanman ang destinasyon!',
      about: 'Five Star Bus Co. has carried passengers between Metro Manila and Northern and Central Luzon for more than 30 years. From our terminals in Cubao, Pasay, Caloocan and Avenida we serve Pangasinan, Tarlac, Nueva Ecija, Isabela, Quirino and Cagayan, with public transport, cargo delivery and chartered buses.',
      mission: 'Every trip safe, on time and comfortable, saanman ang destinasyon.',
      hotline: '0927-712-4349',
      email: 'customerservice@fivestarbusph.com',
      facebook: 'https://www.facebook.com/fivestarbus',
      instagram: 'https://www.instagram.com/fivestar.bus',
      tiktok: 'https://www.tiktok.com/@fivestarbusco',
      messenger: 'https://m.me/fivestarbus',
    },
    terminals: TERMINALS,
    classes: CLASSES,
    routes: ROUTES,
    buses,
    crew,
    home,
    homeDraft: JSON.parse(JSON.stringify(home)),
    homeVersions: [],
    promo: { on: true, text: 'Undas 2026: extra trips Oct 29 – Nov 3. Book early to get your seat.', link: '/news/undas-2026', start: '', end: '' },
    posts: POSTS,
    faqs: FAQS,
    reviews: REVIEWS,
    settings: (() => { const s = settingsDefaults(); s.booking.reserve.enabled = true; return s; })(),
    accounts: ACCOUNTS,
    audit: [],
    staffSession: null,
    passengerSession: null,
  };
  return { ...base, ...seedOps(base) };
}
