// Screenshots of the running prototype for the documentation (headless Edge over CDP).
//   1. in the repository root:  npm run build && npx vite preview --port 4180
//   2. here:                    node shoot.js [http://localhost:4180]
// Writes shots/<name>.png. Each shot: page, optional staff sign-in, viewport, optional script to run
// first (clicks), and optional element to crop to.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = process.argv[2] || 'http://localhost:4180';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const KEY = 'fivestar-bus-prototype';
const PORT = 9300 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();

// Helpers available to the "run" scripts.
const HELPERS = `
window.setVal = (el, v) => { const p = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
window.btn = (t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(t) && !x.disabled); if (b) b.click(); return !!b; };
window.seat = (n = 1) => { const s = [...document.querySelectorAll('.seatmap .seat')].filter((x) => !x.disabled && !x.classList.contains('pri') && !x.classList.contains('taken')).slice(3, 3 + n); s.forEach((x, i) => setTimeout(() => x.click(), i * 120)); return s.length; };
`;
const SUPER = 'superadmin@demo.test';

const SHOTS = [
  { name: 'home-hero', url: '/', w: 1366, h: 900 },
  { name: 'home-popular', url: '/', w: 1366, el: '[data-sec="popular"]' },
  { name: 'home-departures', url: '/', w: 1366, el: '[data-sec="departures"]' },
  { name: 'home-network', url: '/', w: 1366, el: '[data-sec="network"]' },
  { name: 'home-classes', url: '/', w: 1366, el: '[data-sec="classes"]' },
  { name: 'home-app', url: '/', w: 1366, el: '[data-sec="app"]' },
  { name: 'home-services', url: '/', w: 1366, el: '[data-sec="services"]' },
  { name: 'home-m', url: '/', w: 390, h: 844, scale: 2 },
  { name: 'book-results', url: `/book?from=cubao&to=dagupan&date=${tomorrow}&pax=2`, w: 1366, h: 1000 },
  { name: 'book-seats', url: `/book?from=cubao&to=dagupan&date=${tomorrow}&pax=2`, w: 1366, wait: 2200, run: "btn('Select'); setTimeout(() => { seat(2); setTimeout(() => { const i = document.querySelectorAll('.pax input.input'); setVal(i[0], 'Juan Dela Cruz-Test'); setTimeout(() => { setVal(document.querySelectorAll('.pax input.input')[1], 'Maria Dela Cruz-Test'); setTimeout(() => setVal(document.querySelectorAll('.pax select')[1], 'senior'), 150); }, 150); }, 500); }, 300); true", el: '.checkout' },
  { name: 'book-pay', url: `/book?from=cubao&to=dagupan&date=${tomorrow}&pax=1`, w: 1366, run: "btn('Select'); setTimeout(() => { seat(1); setTimeout(() => { setVal(document.querySelector('.pax input.input'), 'Juan Dela Cruz-Test'); btn('Continue'); setTimeout(() => { const i = document.querySelectorAll('.panel-s .input'); setVal(i[0], 'Juan Dela Cruz-Test'); setVal(i[1], '09175550101'); btn('Send SMS code'); setTimeout(() => { const c = document.querySelector('.toast-code').textContent.match(/: (\\d{6})/)[1]; setVal(document.querySelector('.input.code'), c); document.querySelector('.field.check input').click(); btn('Continue to payment'); }, 300); }, 300); }, 300); }, 300); true", wait: 2600, el: '.checkout' },
  { name: 'ticket', url: '/manage', w: 1366, h: 1000, run: `location.href = '/ticket/' + JSON.parse(localStorage.getItem('${KEY}')).bookings.find((b) => b.passengerId === 'p1' && b.status === 'confirmed').ref; true`, wait: 2500 },
  { name: 'routes', url: '/routes', w: 1366, h: 1150 },
  { name: 'terminals', url: '/terminals', w: 1366, h: 1000, wait: 3500 },
  { name: 'charter', url: '/rent-a-bus', w: 1366, h: 1150 },
  { name: 'parcels', url: '/parcels', w: 1366, h: 900, run: "document.querySelector('.linkbtn')?.click(); true" },
  { name: 'track', url: '/track', w: 1366, h: 1000 },
  { name: 'account', url: '/account', w: 1366, h: 900, signInPassenger: true },
  { name: 'app-home', url: '/app', w: 1366, h: 900, signInPassenger: true },
  { name: 'app-ticket', url: '/app', w: 1366, h: 900, signInPassenger: true, run: "document.querySelector('.ma-next')?.click(); true" },
  { name: 'app-seats', url: '/app', w: 1366, h: 900, signInPassenger: true, run: "btn('Search buses'); setTimeout(() => { document.querySelector('.ma-trip:not(:disabled)').click(); setTimeout(() => seat(2), 300); }, 400); true", wait: 1800 },
  { name: 'crew-trip', url: '/app/crew', w: 1366, h: 900, run: "setVal(document.querySelector('input[type=password]'), '246810'); btn('Sign in'); setTimeout(() => { document.querySelector('.ma-trip').click(); setTimeout(() => btn('Manifest'), 300); }, 400); true", wait: 1800 },
  { name: 'admin-login', url: '/admin/login', w: 1366, h: 860 },
  { name: 'admin-dashboard', url: '/admin', as: SUPER, w: 1440, h: 1180 },
  { name: 'admin-dispatch', url: '/admin/dispatch', as: SUPER, w: 1440, h: 900 },
  { name: 'admin-assign', url: '/admin/dispatch', as: SUPER, w: 1440, h: 900, run: "btn('Assign'); true" },
  { name: 'admin-boarding', url: '/admin/boarding', as: SUPER, w: 1440, h: 980 },
  { name: 'admin-counter', url: '/admin/counter', as: 'counter@demo.test', w: 1440, h: 900, wait: 2200, run: "document.querySelectorAll('.pos-trips .pt:not(:disabled)')[2].click(); setTimeout(() => { seat(2); setTimeout(() => { const i = document.querySelectorAll('.pax input.input'); setVal(i[0], 'Walk-in A-Test'); setTimeout(() => { setVal(document.querySelectorAll('.pax input.input')[1], 'Walk-in B-Test'); setTimeout(() => { const c = [...document.querySelectorAll('.pos-pay .chip')].filter((x) => x.textContent.startsWith('₱')); c[c.length - 1].click(); }, 150); }, 150); }, 500); }, 300); true" },
  { name: 'admin-bookings', url: '/admin/bookings', as: SUPER, w: 1440, h: 900, run: "document.querySelector('.tbl tbody tr').click(); true" },
  { name: 'admin-tv', url: '/admin/departures-tv', w: 1600, h: 900 },
  { name: 'admin-live', url: '/admin/live', as: SUPER, w: 1440, h: 900 },
  { name: 'admin-parcels', url: '/admin/parcels', as: SUPER, w: 1440, h: 800 },
  { name: 'admin-fleet', url: '/admin/fleet', as: SUPER, w: 1440, h: 800 },
  { name: 'admin-charters', url: '/admin/charters', as: SUPER, w: 1440, h: 640 },
  { name: 'admin-reports', url: '/admin/reports', as: SUPER, w: 1440, h: 860 },
  { name: 'admin-cms-home', url: '/admin/cms/home', as: SUPER, w: 1440, h: 980 },
  { name: 'admin-cms-routes', url: '/admin/cms/routes', as: SUPER, w: 1440, h: 1100 },
  { name: 'admin-cms-classes', url: '/admin/cms/classes', as: SUPER, w: 1440, h: 900 },
  { name: 'admin-settings', url: '/admin/settings/security', as: SUPER, w: 1440, h: 980 },
  { name: 'admin-ticketing', url: '/admin/settings/booking', as: SUPER, w: 1440, h: 980 },
  { name: 'admin-integrations', url: '/admin/settings/integrations', as: SUPER, w: 1440, h: 1100 },
  { name: 'admin-staff', url: '/admin/staff', as: SUPER, w: 1440, h: 1000 },
  { name: 'maintenance', url: '/', w: 1366, h: 820, maintenance: true },
];

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-shoot-'));
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 60 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ } }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const patch = (body) => ev(`(() => { const s = JSON.parse(localStorage.getItem('${KEY}')); ${body}; localStorage.setItem('${KEY}', JSON.stringify(s)); return true; })()`);

  await send('Page.navigate', { url: `${BASE}/` });
  await sleep(2000);
  fs.mkdirSync('shots', { recursive: true });

  for (const s of SHOTS) {
    await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h || 900, deviceScaleFactor: s.scale || 1, mobile: s.w < 600 });
    await patch(`s.staffSession = null; s.passengerSession = null; s.crewSession = null; s.settings.system.maintenance.enabled = ${!!s.maintenance};
      ${s.as ? `const a = s.accounts.find((x) => x.email === '${s.as}'); s.staffSession = { id: a.id, email: a.email, name: a.name, role: a.role, branches: a.branches, at: new Date().toISOString(), lastActive: new Date().toISOString() };` : ''}
      ${s.signInPassenger ? "s.passengerSession = { id: 'p1', name: s.passengers[0].name, at: new Date().toISOString() };" : ''}`);
    await send('Page.navigate', { url: BASE + s.url });
    await sleep(1800);
    await ev('document.fonts.ready.then(() => true)');
    if (s.run) { await ev(HELPERS); await ev(s.run); await sleep(s.wait || 1200); }
    let clip = { x: 0, y: 0, width: s.w, height: s.h || 900, scale: 1 };
    if (s.el) {
      const full = await ev('Math.ceil(document.documentElement.scrollHeight)');
      await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: full, deviceScaleFactor: 1, mobile: false });
      await sleep(600);
      const r = await ev(`(() => { const r = document.querySelector('${s.el.replace(/'/g, "\\'")}').getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, width: r.width, height: Math.min(r.height, 1400) }; })()`);
      clip = { ...r, scale: 1 };
    }
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
    fs.writeFileSync(path.join('shots', `${s.name}.png`), Buffer.from(shot.result.data, 'base64'));
    console.log('wrote', `shots/${s.name}.png`, `${Math.round(clip.width)}x${Math.round(clip.height)}`);
  }
  await patch('s.settings.system.maintenance.enabled = false; s.staffSession = null');
  ws.close();
  edge.kill();
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Edge may still hold it */ }
})().catch((e) => { console.error(e); process.exit(1); });
