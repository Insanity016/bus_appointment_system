import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { useStore } from '../lib/store.jsx';
import { clsOf, fmtDur, fmtTime, peso, tName, todayYmd } from '../lib/trips.js';
import { searchUrl } from './util.js';

export default function RoutesPage() {
  const { state } = useStore();
  const hubs = state.terminals.filter((t) => t.hub && t.on);
  const [hub, setHub] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(state.routes[0]?.id);
  const routes = state.routes.filter((r) => r.on && (hub === 'all' || r.from === hub) && (!q || `${tName(state, r.from)} ${tName(state, r.to)} ${r.via} ${r.stops.join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  const classes = state.classes.filter((c) => c.on);

  return (
    <>
      <div className="page-hero slim"><div className="wrap">
        <h1>Routes & schedules</h1>
        <p>Every departure from our Metro Manila terminals and back. Times and fares are kept up to date by our team; holiday extra trips appear in the booking results.</p>
        <div className="rp-filters">
          <div className="seg-l light"><button type="button" className={hub === 'all' ? 'on' : ''} onClick={() => setHub('all')}>All terminals</button>{hubs.map((t) => <button type="button" key={t.id} className={hub === t.id ? 'on' : ''} onClick={() => setHub(t.id)}>{t.name}</button>)}</div>
          <label className="rp-q"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a town, e.g. Urdaneta" aria-label="Search routes" /></label>
        </div>
      </div></div>
      <div className="wrap rp">
        <div className="lg-row">{classes.map((c) => <span key={c.id}><i className="cdot" style={{ background: c.color }} />{c.name}</span>)}<span className="mini">Fares are samples for the prototype; Five Star sets the real fares in the CMS.</span></div>
        {routes.map((r) => {
          const on = open === r.id;
          return (
            <div key={r.id} className={`rp-card ${on ? 'on' : ''}`}>
              <button type="button" className="rp-h" onClick={() => setOpen(on ? null : r.id)} aria-expanded={on}>
                <span className="rp-name"><b>{tName(state, r.from)}</b><Icon name="swap" /><b>{tName(state, r.to)}</b></span>
                <span className="rp-meta"><span><Icon name="route" />via {r.via}</span><span><Icon name="clock" />{fmtDur(r.mins)}</span><span className="hide-s"><Icon name="pin" />{r.km} km</span></span>
                <span className="rp-from">from <b>{peso(Math.min(...Object.values(r.fares)))}</b></span>
                <Icon name="down" />
              </button>
              {on && (
                <div className="rp-b">
                  <div className="rp-fares">{classes.map((c) => <div key={c.id}><span><i className="cdot" style={{ background: c.color }} />{c.name}</span><b>{peso(r.fares[c.id])}</b></div>)}</div>
                  {r.stops.length > 0 && <p className="mini"><b>Drop-off points along the way:</b> {r.stops.join(' · ')}</p>}
                  {[['out', r.from, r.to], ['back', r.to, r.from]].map(([dir, a, z]) => (
                    <div key={dir} className="rp-dir">
                      <div className="rp-dh"><b>{tName(state, a)} → {tName(state, z)}</b><span className="mini">{r[dir].length} departures daily</span><Link className="btn btn-sm btn-gold" to={searchUrl({ from: a, to: z, date: todayYmd() })}>Book</Link></div>
                      <div className="times">{r[dir].map((d) => <span key={d.t} className="tm" style={{ '--c': clsOf(state, d.c).color }} title={clsOf(state, d.c).name}>{fmtTime(d.t)}</span>)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!routes.length && <div className="empty"><Icon name="route" />No routes match your search.</div>}
      </div>
    </>
  );
}
