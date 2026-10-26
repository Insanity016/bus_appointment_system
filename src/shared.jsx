// Pieces shared by the website, the mobile app and the staff portal.
import { useEffect, useState } from 'react';
import Icon from './lib/icons.jsx';
import { hash, rng } from './lib/data.js';
import { COAST_PATH, MAP, busPoint, clsOf, fmtTime, isPriority, isWindow, project, seatRows, term, tripStatus } from './lib/trips.js';

/** Seat map of one bus. taken: Set; picked: array; onPick(seat) toggles. */
export function SeatMap({ state, cls, taken, picked = [], onPick, boarded, compact, priorityOpen }) {
  const c = clsOf(state, cls);
  const rows = seatRows(c);
  return (
    <div className={`seatmap ${compact ? 'compact' : ''} l${c.layout}`}>
      <div className="sm-front"><span className="wheel"><Icon name="steering" /></span><span className="door">Door</span></div>
      {rows.map((row, i) => (
        <div className="sm-row" key={i}>
          {row.map((s, j) => {
            if (!s) return <span className="aisle" key={j}>{i === 0 ? '' : ''}</span>;
            const isTaken = taken.has(s);
            const on = picked.includes(s);
            const pri = isPriority(state, s) && !priorityOpen;
            const done = boarded?.has(s);
            return (
              <button
                type="button" key={s}
                className={`seat ${isTaken ? 'taken' : ''} ${on ? 'on' : ''} ${pri && !isTaken ? 'pri' : ''} ${done ? 'done' : ''} ${isWindow(c, s) ? 'win' : ''}`}
                disabled={!onPick || (isTaken && !on)}
                onClick={() => onPick?.(s)}
                aria-label={`Seat ${s}${isTaken ? ' taken' : ''}${pri ? ' priority' : ''}${on ? ' selected' : ''}`}
                aria-pressed={on}
                title={`${s}${isWindow(c, s) ? ' · window' : ''}${pri ? ' · priority seat' : ''}`}
              >{s}</button>
            );
          })}
        </div>
      ))}
      {c.amenities.some((a) => /toilet/i.test(a)) && <div className="sm-back"><Icon name="toilet" />Toilet</div>}
    </div>
  );
}

export function SeatLegend({ withPriority = true }) {
  return (
    <div className="seat-legend">
      <span><i className="seat sample" />Available</span>
      <span><i className="seat sample on" />Your seat</span>
      <span><i className="seat sample taken" />Taken</span>
      {withPriority && <span><i className="seat sample pri" />Priority (senior, PWD, pregnant)</span>}
    </div>
  );
}

/**
 * QR-style code for the e-ticket. In the prototype it is a pattern made from the reference;
 * the real system encodes a signed token that the crew app verifies offline.
 */
export function QrCode({ text, size = 168, dark = '#0B1B3F' }) {
  const N = 29;
  const r = rng(hash(text));
  const cells = [];
  const finder = (x, y) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!finder(x, y) && r() < 0.5) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" />);
  const F = ({ x, y }) => <g><rect x={x} y={y} width="7" height="7" rx="1.2" /><rect x={x + 1} y={y + 1} width="5" height="5" rx=".8" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" rx=".6" /></g>;
  return (
    <svg className="qr" viewBox={`-2 -2 ${N + 4} ${N + 4}`} width={size} height={size} role="img" aria-label={`QR code for ${text}`} fill={dark}>
      <rect x="-2" y="-2" width={N + 4} height={N + 4} fill="#fff" />
      {cells}
      <F x={0} y={0} /><F x={N - 7} y={0} /><F x={0} y={N - 7} />
    </svg>
  );
}

/** Schematic map of Central & Northern Luzon with the route network (and optional live buses). */
export function NetworkMap({ state, selected, onSelect, trips = [], highlight, labels = 'hubs+sel', height }) {
  const [, tick] = useState(0);
  useEffect(() => { if (!trips.length) return undefined; const t = setInterval(() => tick((x) => x + 1), 5000); return () => clearInterval(t); }, [trips.length]);
  const terms = state.terminals.filter((t) => t.on);
  const lines = state.routes.filter((r) => r.on).map((r) => ({ id: r.id, a: term(state, r.from), b: term(state, r.to) })).filter((l) => l.a && l.b);
  return (
    <svg className="netmap" viewBox={`0 0 ${MAP.w} ${MAP.h}`} style={height ? { height } : undefined} role="img" aria-label="Map of Five Star terminals and routes">
      <defs>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--map-sea-a)" /><stop offset="1" stopColor="var(--map-sea-b)" /></linearGradient>
      </defs>
      <rect width={MAP.w} height={MAP.h} fill="url(#sea)" rx="18" />
      <path d={COAST_PATH} fill="var(--map-land)" stroke="var(--map-coast)" strokeWidth="1.2" />
      {lines.map((l) => {
        const [x1, y1] = project(l.a); const [x2, y2] = project(l.b);
        const mx = (x1 + x2) / 2 + (y2 - y1) * 0.08; const my = (y1 + y2) / 2 - (x2 - x1) * 0.08;
        const hot = highlight && (highlight === l.id || l.a.id === selected || l.b.id === selected);
        return <path key={l.id} d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none" stroke={hot ? 'var(--gold)' : 'var(--map-route)'} strokeWidth={hot ? 2.6 : 1.4} strokeLinecap="round" opacity={hot ? 1 : 0.75} />;
      })}
      {terms.map((t) => {
        const [x, y] = project(t);
        const sel = t.id === selected;
        const show = labels === 'all' || sel || (labels === 'hubs+sel' && !t.hub);
        return (
          <g key={t.id} className="nm-t" onClick={() => onSelect?.(t.id)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            <circle cx={x} cy={y} r={sel ? 8 : t.hub ? 6 : 4.5} fill={sel ? 'var(--gold)' : t.hub ? '#fff' : 'var(--map-dot)'} stroke={sel ? '#fff' : 'var(--blue)'} strokeWidth="2" />
            {show && <text x={x + 9} y={y + 4} fontSize={sel ? 12 : 10.5} fontWeight={sel ? 700 : 600} fill="var(--map-label)" paintOrder="stroke" stroke="var(--map-halo)" strokeWidth="3">{t.name}</text>}
          </g>
        );
      })}
      {(() => { const [x, y] = project({ lat: 14.6, lng: 121.02 }); return <text x={x + 12} y={y + 18} fontSize="11" fontWeight="700" fill="var(--map-label)" paintOrder="stroke" stroke="var(--map-halo)" strokeWidth="3">Metro Manila · 4 terminals</text>; })()}
      {trips.map((trip) => {
        if (tripStatus(trip) !== 'departed') return null;
        const [x, y] = project(busPoint(state, trip));
        return (
          <g key={trip.id} className="nm-bus" onClick={() => onSelect?.(trip.id)} style={{ cursor: 'pointer' }}>
            <circle cx={x} cy={y} r="9" fill={trip.ops.delay ? '#F59E0B' : 'var(--gold)'} opacity=".25" />
            <circle cx={x} cy={y} r="5" fill={trip.ops.delay ? '#B45309' : 'var(--blue)'} stroke="#fff" strokeWidth="1.5" />
          </g>
        );
      })}
    </svg>
  );
}

/** Built-in hero artwork: a Five Star bus on the road (day, night or group). Replaced by an uploaded photo in the CMS. */
export function BusArt({ mode = 'day', brand }) {
  const sky = mode === 'night' ? ['#0B1530', '#1E2F6B', '#3B3A7A'] : mode === 'group' ? ['#0E3A7A', '#2B6CB0', '#F6C667'] : ['#0A2E73', '#2D5BB8', '#F7B733'];
  const stars = mode === 'night' ? Array.from({ length: 40 }, (_, i) => { const r = rng(i * 97 + 3); return <circle key={i} cx={r() * 1200} cy={r() * 260} r={r() * 1.6 + 0.4} fill="#fff" opacity={0.35 + r() * 0.6} />; }) : null;
  const Bus = ({ x, y, s = 1, flip }) => (
    <g transform={`translate(${x},${y}) scale(${flip ? -s : s},${s})`}>
      <ellipse cx="300" cy="196" rx="300" ry="12" fill="#000" opacity=".25" />
      <rect x="10" y="20" width="575" height="160" rx="26" fill="#FDFDFD" />
      <path d="M520 20h30a35 35 0 0 1 35 35v80h-65z" fill="#E9EEF8" />
      <rect x="10" y="118" width="575" height="26" fill={brand.primary} />
      <path d="M10 144h575v10H10z" fill={brand.accent} />
      <rect x="34" y="40" width="470" height="62" rx="10" fill="#132447" />
      {Array.from({ length: 7 }, (_, i) => <rect key={i} x={40 + i * 66} y="46" width="60" height="50" rx="6" fill={mode === 'night' ? '#F8D97A' : '#3D5E9E'} opacity={mode === 'night' ? 0.85 : 0.9} />)}
      <path d="M522 40h38a18 18 0 0 1 18 18v52h-56z" fill="#132447" />
      <path d="M528 46h30a12 12 0 0 1 12 12v44h-42z" fill={mode === 'night' ? '#2A3F70' : '#6E8BC4'} />
      <rect x="470" y="104" width="40" height="72" rx="5" fill="#E2E8F3" stroke="#C7D0E2" />
      <g transform="translate(150 122)"><path d="M0 0l3.5 7 7.7 1.1-5.6 5.4 1.3 7.7L0 17.6l-6.9 3.6 1.3-7.7L-11.2 8.1-3.5 7z" fill={brand.accent} /></g>
      <text x="168" y="138" fill="#fff" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800" fontSize="20" letterSpacing="3">{brand.name}</text>
      <rect x="560" y="150" width="22" height="12" rx="3" fill="#FFD66B" />
      <circle cx="130" cy="180" r="30" fill="#1B2333" /><circle cx="130" cy="180" r="13" fill="#9AA6BD" />
      <circle cx="455" cy="180" r="30" fill="#1B2333" /><circle cx="455" cy="180" r="13" fill="#9AA6BD" />
    </g>
  );
  return (
    <svg className="busart" viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`sky-${mode}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky[0]} /><stop offset=".6" stopColor={sky[1]} /><stop offset="1" stopColor={sky[2]} /></linearGradient>
      </defs>
      <rect width="1200" height="560" fill={`url(#sky-${mode})`} />
      {stars}
      {mode !== 'night' ? <circle cx="930" cy="300" r="70" fill="#FFE29A" opacity=".85" /> : <circle cx="980" cy="110" r="34" fill="#F5F0D8" />}
      <path d="M0 360 L120 290 L230 340 L380 250 L520 330 L640 270 L790 340 L930 280 L1060 330 L1200 270 V560 H0Z" fill={mode === 'night' ? '#162350' : '#1D3F86'} opacity=".75" />
      <path d="M0 400 L160 340 L300 390 L460 330 L640 390 L820 340 L1000 395 L1200 350 V560 H0Z" fill={mode === 'night' ? '#0F1A3D' : '#163370'} />
      <rect y="440" width="1200" height="120" fill="#262B36" />
      <rect y="438" width="1200" height="6" fill="#3A4152" />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={i * 110 + 20} y="497" width="60" height="5" rx="2" fill="#E9C46A" opacity=".8" />)}
      {mode === 'group'
        ? <><Bus x={560} y={262} s={0.95} /><Bus x={130} y={290} s={0.8} /></>
        : <Bus x={540} y={258} s={1} />}
    </svg>
  );
}

/** Brand mark: the uploaded logo, or a star emblem until the real logo is uploaded in the CMS. */
export function Mark({ brand, size = 44 }) {
  if (brand.logo) return <span className="mark" style={{ width: size, height: size }}><img src={brand.logo} alt={`${brand.name} logo`} /></span>;
  return (
    <span className="mark" style={{ width: size, height: size }} title="Placeholder mark – the real logo is uploaded in Website CMS → Branding">
      <svg viewBox="0 0 64 64" width={size} height={size} aria-label="Logo placeholder"><rect width="64" height="64" rx="18" fill="var(--blue)" /><path d="M32 10l6.4 13 14.4 2.1-10.4 10.1 2.5 14.3L32 42.8l-12.9 6.7 2.5-14.3L11.2 25.1l14.4-2.1z" fill="var(--gold)" /></svg>
    </span>
  );
}

export function BrandLockup({ brand, light, small }) {
  return (
    <span className={`lockup ${light ? 'light' : ''} ${small ? 'small' : ''}`}>
      <Mark brand={brand} size={small ? 36 : 44} />
      <span><b>{brand.name}</b><small>{brand.sub}</small></span>
    </span>
  );
}

/** "Leaves in 2h 10m" style countdown. */
export function Countdown({ to }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const m = Math.round((to.getTime() - now) / 60000);
  if (m <= 0) return <>now</>;
  if (m < 60) return <>in {m} min</>;
  if (m < 48 * 60) return <>in {Math.floor(m / 60)}h {m % 60}m</>;
  return <>in {Math.round(m / 1440)} days</>;
}

export const ampm = (d) => fmtTime(d);
