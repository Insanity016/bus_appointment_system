import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { useStore } from '../lib/store.jsx';
import { addDays, ymd } from '../lib/data.js';
import { busOf, clsOf, fmtTime, tName, todayYmd, tripStatus, tripsOn } from '../lib/trips.js';
import { BrandLockup } from '../shared.jsx';

/** Departure screen for the terminal waiting area: /admin/departures-tv?t=cubao */
export default function DeparturesTV() {
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const term = params.get('t') || 'cubao';
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  const list = [...tripsOn(state, todayYmd(), { from: term }), ...tripsOn(state, ymd(addDays(new Date(), 1)), { from: term })]
    .filter((t) => !['arrived', 'departed'].includes(tripStatus(t)) || (tripStatus(t) === 'departed' && now - t.etd < 10 * 60000)).slice(0, 12);
  const adv = state.posts.filter((p) => p.type === 'advisory').map((p) => p.title).join('   •   ');
  const label = (t) => { const s = tripStatus(t); return s === 'boarding' ? ['NOW BOARDING', 'boarding'] : s === 'departed' ? ['DEPARTED', 'departed'] : s === 'cancelled' ? ['CANCELLED', 'cancelled'] : t.ops.delay ? [`DELAYED ${fmtTime(t.etd)}`, 'delayed'] : ['ON TIME', 'scheduled']; };
  return (
    <div className="dtv">
      <div className="dtv-h">
        <BrandLockup brand={state.brand} light />
        <h1>Departures · {tName(state, term)}</h1>
        <select value={term} onChange={(e) => setParams({ t: e.target.value })} aria-label="Terminal">{state.terminals.filter((t) => t.hub).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <div className="clock">{now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}<small>{now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</small></div>
      </div>
      <div className="dtv-board">
        <div className="dtv-r head"><span>Time</span><span>Destination</span><span>Class</span><span>Bus</span><span>Gate</span><span>Status</span></div>
        {list.map((t) => {
          const [l, cls] = label(t);
          return (
            <div className={`dtv-r ${cls}`} key={t.id}>
              <span className="tm">{fmtTime(t.time)}</span>
              <span className="ds"><b>{tName(state, t.toId)}</b><small>via {t.route.via}</small></span>
              <span><i className="cdot" style={{ background: clsOf(state, t.cls).color }} />{clsOf(state, t.cls).short}</span>
              <span>{busOf(state, t.ops.busId)?.bodyNo || '—'}</span>
              <span className="gt">{(t.ops.gate || '—').replace('Gate ', '')}</span>
              <span className={`bst ${cls}`}>{l}</span>
            </div>
          );
        })}
      </div>
      <div className="dtv-ticker"><Icon name="megaphone" /><div><span>{adv}   •   Book online at fivestarph.com or in the Five Star app   •   Have your e-ticket QR ready at the gate</span></div></div>
    </div>
  );
}
