import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DATA_VERSION, addDays, defaultState, ymd } from './data.js';

// The prototype has no server: the whole "database" is one object saved in
// this browser's localStorage, shared by the website and the admin portal
// (open them in two tabs and they stay in sync).
const KEY = 'fivestar-bus-prototype';

function shiftDates(state) {
  // Keep the sample trips and bookings around "today" when the demo is opened on a later day.
  const today = ymd(new Date());
  if (state.seedDate === today) return state;
  const diff = Math.round((new Date(today) - new Date(state.seedDate)) / 86400000);
  if (!diff) return state;
  const day = (d) => ymd(addDays(new Date(`${d}T00:00`), diff));
  const iso = (s) => (s ? addDays(new Date(s), diff).toISOString() : s);
  const tid = (id) => { const p = id.split('_'); p[2] = day(p[2]); return p.join('_'); };
  return {
    ...state,
    seedDate: today,
    bookings: state.bookings.map((b) => ({ ...b, date: day(b.date), tripId: tid(b.tripId), createdAt: iso(b.createdAt), pay: { ...b.pay, at: iso(b.pay.at) } })),
    tripOps: Object.fromEntries(Object.entries(state.tripOps).map(([k, v]) => [tid(k), v])),
    holds: [],
    parcels: state.parcels.map((p) => ({ ...p, createdAt: iso(p.createdAt), events: p.events.map((e) => ({ ...e, at: iso(e.at) })) })),
    remittances: state.remittances.map((x) => ({ ...x, tripId: tid(x.tripId) })),
    charters: state.charters.map((c) => ({ ...c, date: day(c.date), returnDate: day(c.returnDate) })),
  };
}

function load() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === DATA_VERSION) return shiftDates(parsed);
    }
  } catch {
    // Storage blocked or corrupt: fall back to the sample data.
  }
  return defaultState();
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);
  const [toasts, setToasts] = useState([]);
  const [storageError, setStorageError] = useState(false);
  const skipSave = useRef(false);

  // Save (debounced) on every change.
  useEffect(() => {
    if (skipSave.current) { skipSave.current = false; return undefined; }
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(state));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [state]);

  // Another tab changed the data: take it over.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue);
        if (next.version === DATA_VERSION) { skipSave.current = true; setState(next); }
      } catch { /* ignore */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Brand colours from the CMS.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--blue', state.brand.primary);
    root.setProperty('--blue-d', shade(state.brand.primary, -0.38));
    root.setProperty('--blue-50', mix(state.brand.primary, '#ffffff', 0.9));
    root.setProperty('--gold', state.brand.accent);
    root.setProperty('--gold-d', shade(state.brand.accent, -0.2));
    root.setProperty('--gold-50', mix(state.brand.accent, '#ffffff', 0.9));
  }, [state.brand.primary, state.brand.accent]);

  // update(recipe): the recipe edits a copy of the current state and may return a
  // value (e.g. an error message). Applied immediately, so calls in a row chain.
  const current = useRef(state);
  current.current = state;
  const update = useCallback((recipe) => {
    const next = structuredClone(current.current);
    const result = recipe(next);
    current.current = next;
    setState(next);
    return result;
  }, []);

  const toast = useCallback((text, kind = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'code' ? 12000 : 4200);
  }, []);

  const reset = useCallback(() => {
    try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    setState(defaultState());
  }, []);

  const value = useMemo(() => ({ state, update, toast, reset, storageError }), [state, update, toast, reset, storageError]);

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);

/** Read a setting: setting(state, 'security.lockout.maxAttempts'). */
export function setting(state, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.settings);
}

/** Add an audit entry inside an update() recipe. */
export function audit(draft, event, description, { actor, severity = 'info' } = {}) {
  draft.audit.unshift({
    at: new Date().toISOString(),
    event,
    description,
    severity,
    actor: actor ?? draft.staffSession?.name ?? 'System',
  });
  draft.audit = draft.audit.slice(0, 400);
}

/** Queue an SMS inside an update() recipe (Semaphore in the real system; shown in Messages here). */
export function sms(draft, to, text, kind = 'service') {
  draft.sms.unshift({ at: new Date().toISOString(), to, text, kind, status: draft.settings.integrations.semaphore.enabled ? 'sent' : 'simulated' });
  draft.sms = draft.sms.slice(0, 200);
}

// ---- colour helpers
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
export function mix(a, b, t) { const x = hexToRgb(a); const y = hexToRgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); }
export function shade(hex, amount) { return amount < 0 ? mix(hex, '#000000', -amount) : mix(hex, '#ffffff', amount); }

/** Downscale an uploaded photo and return it as a data URL (keeps the browser storage small). */
export function readPhoto(file, max = 1400) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) { reject(new Error('Please choose a photo (JPG, PNG or WebP).')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('This photo format is not supported by the browser.'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
