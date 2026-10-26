import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { useStore } from '../lib/store.jsx';
import { distanceKm, fmtTime, tName, tel, todayYmd, tripStatus, tripsOn } from '../lib/trips.js';
import { searchUrl } from './util.js';

export default function Terminals() {
  const { state, toast } = useStore();
  const terms = state.terminals.filter((t) => t.on);
  const [sel, setSel] = useState('cubao');
  const [dist, setDist] = useState({});
  const [q, setQ] = useState('');
  const t = terms.find((x) => x.id === sel) || terms[0];
  const shown = terms.filter((x) => !q || `${x.name} ${x.area} ${x.region} ${x.address}`.toLowerCase().includes(q.toLowerCase()));
  const regions = [...new Set(shown.map((x) => x.region))];
  const next = tripsOn(state, todayYmd(), { from: t.id }).filter((x) => ['scheduled', 'delayed', 'boarding'].includes(tripStatus(x))).slice(0, 6);

  const locate = () => {
    if (!navigator.geolocation) { toast('Your browser cannot share its location.', 'err'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const d = Object.fromEntries(terms.map((x) => [x.id, distanceKm(me, x)]));
      const near = terms.slice().sort((a, b) => d[a.id] - d[b.id])[0];
      setDist(d); setSel(near.id);
      toast(`Nearest terminal: ${near.name} (${d[near.id].toFixed(1)} km)`);
    }, () => toast('Location not shared. Pick a terminal from the list.', 'err'), { timeout: 10000 });
  };

  const dd = 0.03;
  const map = `https://www.openstreetmap.org/export/embed.html?bbox=${t.lng - dd},${t.lat - dd},${t.lng + dd},${t.lat + dd}&layer=mapnik&marker=${t.lat},${t.lng}`;
  return (
    <>
      <div className="page-hero slim"><div className="wrap"><h1>Terminals</h1><p>{terms.length} terminals from Metro Manila to Cagayan Valley. Tickets, parcels and help desks at every one.</p></div></div>
      <div className="wrap tm-grid">
        <div className="tm-list">
          <div className="tm-tools">
            <label className="rp-q dark"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search terminal or town" aria-label="Search terminals" /></label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={locate}><Icon name="locate" />Nearest</button>
          </div>
          {regions.map((g) => (
            <div key={g}>
              <div className="tm-g">{g}</div>
              {shown.filter((x) => x.region === g).map((x) => (
                <button type="button" key={x.id} className={`tm-it ${x.id === t.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
                  <Icon name={x.hub ? 'building' : 'pin'} /><span><b>{x.name}</b><small>{x.area}</small></span>
                  {dist[x.id] != null && <span className="pill near">{dist[x.id].toFixed(0)} km</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="tm-detail">
          <div className="map"><iframe title={`Map of ${t.name} terminal`} src={map} loading="lazy" /></div>
          <div className="tm-info">
            <div>
              <h2>{t.name} terminal</h2>
              <p><Icon name="pin" />{t.address || `${t.area}, ${t.region}`}</p>
              <p><Icon name="clock" />{t.hours}</p>
              {t.phones.map((p) => <p key={p}><Icon name="phone" /><a href={tel(p)}>{p}</a></p>)}
              <div className="chips" style={{ marginTop: 10 }}>
                <span className="chip on"><Icon name="ticket" />Ticket counter</span>
                {t.parcels && <span className="chip on"><Icon name="package" />Parcels</span>}
                {t.hub && <span className="chip on"><Icon name="monitor" />Departure screens</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <a className="btn btn-blue btn-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`} target="_blank" rel="noreferrer"><Icon name="nav" />Directions</a>
                <a className="btn btn-ghost btn-sm" href={`https://waze.com/ul?ll=${t.lat},${t.lng}&navigate=yes`} target="_blank" rel="noreferrer">Waze</a>
              </div>
            </div>
            <div>
              <h4>Next departures today</h4>
              {next.map((x) => <Link key={x.id} className="nd" to={searchUrl({ from: x.fromId, to: x.toId, date: x.date })}><b>{fmtTime(x.time)}</b><span>{tName(state, x.toId)}</span>{x.ops.delay ? <span className="st s-warn">+{x.ops.delay}m</span> : <Icon name="next" />}</Link>)}
              {!next.length && <p className="mini">No more departures from here today.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
