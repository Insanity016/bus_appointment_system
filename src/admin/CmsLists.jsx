import { useState } from 'react';
import Icon from '../lib/icons.jsx';
import { audit, useStore } from '../lib/store.jsx';
import { clsOf, fmtDur, peso, seatList, tName } from '../lib/trips.js';
import { PhotoInput, Toggle } from '../components.jsx';
import { SeatMap } from '../shared.jsx';
import { TopBar } from './AdminApp.jsx';

/** Left list + right editor, saved straight away (every change in the audit log). */
function ListEditor({ crumb, title, items, label, sub, selected, onSelect, onAdd, addLabel, children, menu, onSignOut }) {
  return (
    <>
      <TopBar crumb={crumb} title={title} menu={menu} onSignOut={onSignOut}>
        {onAdd && <button type="button" className="btn-a b-navy" onClick={onAdd}><Icon name="plus" />{addLabel}</button>}
      </TopBar>
      <div className="pad">
        <div className="cmsgrid">
          <div className="panel" style={{ maxHeight: 'calc(100vh - 110px)', overflowY: 'auto' }}>
            <div className="secl">
              {items.map((x) => (
                <div key={x.id} className={`sec ${selected === x.id ? 'on' : ''} ${x.on === false ? 'off' : ''}`} onClick={() => onSelect(x.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(x.id); }}>
                  <div className="grow"><b>{label(x)}</b><span className="m">{sub(x)}</span></div>
                  {x.on === false && <span className="st s-mute">Off</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="panel">{children}</div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- routes
export function CmsRoutes(p) {
  const { state, update, toast } = useStore();
  const [sel, setSel] = useState(state.routes[0]?.id);
  const r = state.routes.find((x) => x.id === sel);
  const [newT, setNewT] = useState({ out: '06:00', back: '06:00' });
  const ed = (fn, what) => update((d) => { const x = d.routes.find((y) => y.id === sel); fn(x); if (what) audit(d, 'cms.route.updated', `${tName(d, x.from)} – ${tName(d, x.to)}: ${what}`, { severity: /fare/i.test(what) ? 'warning' : 'info' }); });
  const add = () => {
    const id = `r${Date.now().toString(36)}`;
    update((d) => { d.routes.push({ id, from: 'cubao', to: 'dagupan', via: 'TPLEX', km: 200, mins: 240, fares: { regular: 450, deluxe: 530, premium: 700 }, out: [{ t: '08:00', c: 'regular' }], back: [{ t: '14:00', c: 'regular' }], stops: [], featured: false, photo: null, online: true, on: false }); audit(d, 'cms.route.created', 'New route created (off until switched on)'); });
    setSel(id);
  };
  const terms = state.terminals.filter((t) => t.on);
  return (
    <ListEditor {...p} crumb="Website CMS" title="Routes, fares & schedules" items={state.routes} selected={sel} onSelect={setSel} onAdd={add} addLabel="New route"
      label={(x) => `${tName(state, x.from)} – ${tName(state, x.to)}`} sub={(x) => `via ${x.via} · ${x.out.length + x.back.length} departures · from ${peso(Math.min(...Object.values(x.fares)))}`}>
      {r && (
        <>
          <div className="ph-row"><h3>{tName(state, r.from)} – {tName(state, r.to)}</h3><span className="sp" /><span className="mini">On sale</span><Toggle on={r.on} onChange={(v) => ed((x) => { x.on = v; }, v ? 'switched on' : 'switched off')} label="Route on" /></div>
          <div className="row3">
            <label className="field"><span>From (Metro Manila terminal)</span><select className="select" value={r.from} onChange={(e) => ed((x) => { x.from = e.target.value; }, `origin → ${e.target.value}`)}>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="field"><span>To</span><select className="select" value={r.to} onChange={(e) => ed((x) => { x.to = e.target.value; }, `destination → ${e.target.value}`)}>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="field"><span>Via</span><input className="input" value={r.via} onChange={(e) => ed((x) => { x.via = e.target.value; })} onBlur={() => ed(() => {}, `via ${r.via}`)} /></label>
            <label className="field"><span>Distance</span><div className="num"><input type="number" value={r.km} onChange={(e) => ed((x) => { x.km = Number(e.target.value); })} /><span>km</span></div></label>
            <label className="field"><span>Travel time</span><div className="num"><input type="number" value={r.mins} onChange={(e) => ed((x) => { x.mins = Number(e.target.value); })} /><span>min ({fmtDur(r.mins)})</span></div></label>
            <label className="field"><span>Show on homepage</span><Toggle on={r.featured} onChange={(v) => ed((x) => { x.featured = v; }, v ? 'featured on homepage' : 'removed from homepage')} label="Featured" /></label>
          </div>
          <span className="label">One-way fares</span>
          <div className="row3">{state.classes.map((c) => <label className="field" key={c.id}><span><i className="cdot" style={{ background: c.color }} />{c.name}</span><div className="num"><input type="number" value={r.fares[c.id]} onChange={(e) => ed((x) => { x.fares[c.id] = Number(e.target.value); })} onBlur={(e) => ed(() => {}, `${c.name} fare → ₱${e.target.value}`)} /><span>₱</span></div></label>)}</div>
          <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>Within the fare matrix approved by LTFRB. New fares apply to new bookings; tickets already sold keep their price. Discounts are in Settings → Fares & discounts.</p>
          <label className="field"><span>Drop-off points along the way (comma separated)</span><input className="input" value={r.stops.join(', ')} onChange={(e) => ed((x) => { x.stops = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); })} /></label>
          <div className="row2">
            <label className="field"><span>Sell online (website and app)</span><Toggle on={r.online} onChange={(v) => ed((x) => { x.online = v; }, v ? 'online sales on' : 'counter only')} label="Online" /></label>
          </div>
          {[['out', `${tName(state, r.from)} → ${tName(state, r.to)}`], ['back', `${tName(state, r.to)} → ${tName(state, r.from)}`]].map(([dir, l]) => (
            <div className="sect" key={dir}>
              <div className="sect-h"><h3>{l}</h3><span className="mini">{r[dir].length} departures daily</span></div>
              <div className="dep-grid">
                {r[dir].map((d, i) => (
                  <div className="dep" key={`${d.t}${i}`} style={{ '--c': clsOf(state, d.c).color }}>
                    <b>{d.t}</b>
                    <select value={d.c} onChange={(e) => ed((x) => { x[dir][i].c = e.target.value; }, `${dir === 'out' ? 'outbound' : 'return'} ${d.t} class → ${e.target.value}`)} aria-label="Class">{state.classes.map((c) => <option key={c.id} value={c.id}>{c.short}</option>)}</select>
                    <button type="button" onClick={() => ed((x) => { x[dir].splice(i, 1); }, `${dir === 'out' ? 'outbound' : 'return'} ${d.t} removed`)} aria-label={`Remove ${d.t}`}><Icon name="x" /></button>
                  </div>
                ))}
              </div>
              <div className="otp" style={{ marginTop: 10 }}>
                <input className="input" type="time" value={newT[dir]} onChange={(e) => setNewT({ ...newT, [dir]: e.target.value })} style={{ maxWidth: 140, flex: 'none' }} aria-label="New departure time" />
                <button type="button" className="btn-a b-ghost" onClick={() => { if (r[dir].some((d) => d.t === newT[dir])) { toast('That time already exists.', 'err'); return; } ed((x) => { x[dir].push({ t: newT[dir], c: 'regular' }); x[dir].sort((a, b) => a.t.localeCompare(b.t)); }, `${dir === 'out' ? 'outbound' : 'return'} departure ${newT[dir]} added`); }}><Icon name="plus" />Add departure</button>
              </div>
            </div>
          ))}
          <p className="mini">One-off trips (holidays) are added on the dispatch board instead.</p>
        </>
      )}
    </ListEditor>
  );
}

// ---------------------------------------------------------------- terminals
export function CmsTerminals(p) {
  const { state, update } = useStore();
  const [sel, setSel] = useState('cubao');
  const t = state.terminals.find((x) => x.id === sel);
  const ed = (fn, what) => update((d) => { const x = d.terminals.find((y) => y.id === sel); fn(x); if (what) audit(d, 'cms.terminal.updated', `${x.name}: ${what}`); });
  const add = () => { const id = `t${Date.now().toString(36)}`; update((d) => { d.terminals.push({ id, name: 'New terminal', region: 'Pangasinan', area: '', address: '', phones: [d.brand.hotline], lat: 15.9, lng: 120.5, hub: false, hours: '4:00 AM – 11:00 PM', parcels: true, photo: null, on: false }); audit(d, 'cms.terminal.created', 'New terminal created (off)'); }); setSel(id); };
  const f = (label, key, opts = {}) => <label className="field"><span>{label}</span><input className="input" type={opts.type || 'text'} step="any" value={t[key]} onChange={(e) => ed((x) => { x[key] = opts.type === 'number' ? Number(e.target.value) : e.target.value; })} onBlur={() => ed(() => {}, `${label} updated`)} /></label>;
  return (
    <ListEditor {...p} crumb="Website CMS" title="Terminals" items={state.terminals} selected={sel} onSelect={setSel} onAdd={add} addLabel="New terminal" label={(x) => x.name} sub={(x) => `${x.region}${x.hub ? ' · hub' : ''}`}>
      {t && (
        <>
          <div className="ph-row"><h3>{t.name}</h3><span className="sp" /><span className="mini">Shown</span><Toggle on={t.on} onChange={(v) => ed((x) => { x.on = v; }, v ? 'shown' : 'hidden')} label="Shown" /></div>
          <div className="row2">{f('Name', 'name')}{f('Province / region', 'region')}{f('Town / city', 'area')}{f('Opening hours', 'hours')}</div>
          {f('Address', 'address')}
          <label className="field"><span>Phone numbers (comma separated)</span><input className="input" value={t.phones.join(', ')} onChange={(e) => ed((x) => { x.phones = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); })} /></label>
          <div className="row2">{f('Map pin latitude', 'lat', { type: 'number' })}{f('Map pin longitude', 'lng', { type: 'number' })}</div>
          <div className="row2">
            <label className="field"><span>Metro Manila hub (counters, departure screens)</span><Toggle on={t.hub} onChange={(v) => ed((x) => { x.hub = v; }, `hub ${v ? 'on' : 'off'}`)} label="Hub" /></label>
            <label className="field"><span>Accepts parcels</span><Toggle on={t.parcels} onChange={(v) => ed((x) => { x.parcels = v; }, `parcels ${v ? 'on' : 'off'}`)} label="Parcels" /></label>
          </div>
          <PhotoInput value={t.photo} onChange={(v) => ed((x) => { x.photo = v; }, 'photo changed')} label="Terminal photo" />
          <div className="map" style={{ height: 220, marginTop: 6 }}><iframe title="Map preview" src={`https://www.openstreetmap.org/export/embed.html?bbox=${t.lng - 0.02},${t.lat - 0.02},${t.lng + 0.02},${t.lat + 0.02}&layer=mapnik&marker=${t.lat},${t.lng}`} loading="lazy" /></div>
        </>
      )}
    </ListEditor>
  );
}

// ---------------------------------------------------------------- bus classes
export function CmsClasses(p) {
  const { state, update } = useStore();
  const [sel, setSel] = useState('regular');
  const c = state.classes.find((x) => x.id === sel);
  const ed = (fn, what) => update((d) => { const x = d.classes.find((y) => y.id === sel); fn(x); if (what) audit(d, 'cms.class.updated', `${x.name}: ${what}`); });
  return (
    <ListEditor {...p} crumb="Website CMS" title="Bus classes & amenities" items={state.classes} selected={sel} onSelect={setSel} label={(x) => x.name} sub={(x) => `${seatList(x).length} seats · ${x.layout}`}>
      {c && (
        <div className="grid" style={{ gridTemplateColumns: '1fr auto', marginTop: 0 }}>
          <div>
            <div className="ph-row"><h3>{c.name}</h3><span className="sp" /><span className="mini">Shown</span><Toggle on={c.on} onChange={(v) => ed((x) => { x.on = v; }, v ? 'shown' : 'hidden')} label="Shown" /></div>
            <div className="row2">
              <label className="field"><span>Name</span><input className="input" value={c.name} onChange={(e) => ed((x) => { x.name = e.target.value; })} /></label>
              <label className="field"><span>Short name (boards, tickets)</span><input className="input" value={c.short} onChange={(e) => ed((x) => { x.short = e.target.value; })} /></label>
              <label className="field"><span>Seating</span><select className="select" value={c.layout} onChange={(e) => ed((x) => { x.layout = e.target.value; }, `seating ${e.target.value}`)}><option value="2-2">2 + 2</option><option value="2-1">2 + 1</option></select></label>
              <label className="field"><span>Rows</span><div className="num"><input type="number" min="4" max="16" value={c.rows} onChange={(e) => ed((x) => { x.rows = Number(e.target.value); }, `rows ${e.target.value}`)} /><span>rows</span></div></label>
              <label className="field"><span>Back row seats (0 = none)</span><div className="num"><input type="number" min="0" max="5" value={c.back} onChange={(e) => ed((x) => { x.back = Number(e.target.value); })} /><span>seats</span></div></label>
              <label className="field"><span>Charter rate</span><div className="num"><input type="number" value={c.charterDay} onChange={(e) => ed((x) => { x.charterDay = Number(e.target.value); })} /><span>₱ / bus / day</span></div></label>
              <label className="field"><span>Colour on boards and maps</span><input className="input" type="color" value={c.color} onChange={(e) => ed((x) => { x.color = e.target.value; })} style={{ height: 42, padding: 4 }} /></label>
            </div>
            <label className="field"><span>Description</span><textarea className="textarea" value={c.text} onChange={(e) => ed((x) => { x.text = e.target.value; })} /></label>
            <label className="field"><span>Amenities (one per line)</span><textarea className="textarea" value={c.amenities.join('\n')} onChange={(e) => ed((x) => { x.amenities = e.target.value.split('\n').filter((s) => s.trim()); })} /></label>
            <p className="mini">Total {seatList(c).length} seats. Seat maps, tickets and the manifest follow this layout. A bus with a different layout can be given its own class.</p>
          </div>
          <div><SeatMap state={state} cls={c.id} taken={new Set()} compact /></div>
        </div>
      )}
    </ListEditor>
  );
}

