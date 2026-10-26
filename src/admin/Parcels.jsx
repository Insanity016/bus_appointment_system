import { useState } from 'react';
import Icon from '../lib/icons.jsx';
import { audit, setting, sms, useStore } from '../lib/store.jsx';
import { fillTemplate, peso, tName, todayYmd, tripStatus, tripsOn } from '../lib/trips.js';
import { Empty, Modal, StatusPill } from '../components.jsx';
import { QrCode } from '../shared.jsx';
import { PARCEL_STATUS, parcelFee } from '../site/Services.jsx';
import { TopBar, useTerminalScope } from './AdminApp.jsx';

const NEXT = { received: 'loaded', loaded: 'in_transit', in_transit: 'arrived', arrived: 'claimed' };
const NEXT_LABEL = { received: 'Load on bus', loaded: 'Bus departed', in_transit: 'Arrived', arrived: 'Release to receiver' };

export default function Parcels({ menu, onSignOut }) {
  const { state, update, toast } = useStore();
  const { all, terminals } = useTerminalScope();
  const [term, setTerm] = useState(all ? 'all' : terminals[0]?.id);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [label, setLabel] = useState(null);
  const rows = state.parcels.filter((p) => (term === 'all' || p.from === term || p.to === term) && (!status || p.status === status) && (!q || `${p.waybill} ${p.sender.name} ${p.receiver.name} ${p.receiver.mobile}`.toLowerCase().includes(q.toLowerCase())));
  const count = (s) => state.parcels.filter((p) => p.status === s && (term === 'all' || p.from === term || p.to === term)).length;

  const advance = (p) => {
    const next = NEXT[p.status];
    update((d) => {
      const x = d.parcels.find((y) => y.id === p.id);
      x.status = next;
      x.events.push({ at: new Date().toISOString(), status: next, where: ['arrived', 'claimed'].includes(next) ? x.to : x.from });
      if (next === 'arrived' && setting(d, 'parcels.handling.smsReceiver')) sms(d, x.receiver.mobile, fillTemplate(setting(d, 'notifications.sms.parcel'), { waybill: x.waybill, sender: x.sender.name, terminal: tName(d, x.to) }));
      audit(d, 'parcel.status', `${x.waybill} → ${PARCEL_STATUS[next].label}`);
    });
    toast(`${p.waybill}: ${PARCEL_STATUS[next].label}${next === 'arrived' ? '. Receiver notified by SMS.' : '.'}`);
  };

  const save = () => {
    const p = update((d) => {
      d.parcelSeq += 1;
      const fee = parcelFee(d, form);
      const x = { id: d.parcelSeq, waybill: `WB-${new Date().getFullYear()}-${String(d.parcelSeq).padStart(6, '0')}`, from: form.from, to: form.to, sender: { name: form.sname, mobile: form.smobile }, receiver: { name: form.rname, mobile: form.rmobile }, item: form.item, pieces: Number(form.pieces), kg: Number(form.kg), declared: Number(form.declared), fee, paidBy: form.paidBy, status: 'received', createdAt: new Date().toISOString(), events: [{ at: new Date().toISOString(), status: 'received', where: form.from }], tripId: form.tripId || null };
      d.parcels.unshift(x);
      sms(d, x.sender.mobile, `Five Star Parcel ${x.waybill} received at ${tName(d, x.from)} for ${tName(d, x.to)}. Track: ${window.location.host}/parcels?wb=${x.waybill}`);
      audit(d, 'parcel.created', `${x.waybill} ${tName(d, x.from)}→${tName(d, x.to)} ${x.kg} kg ${peso(fee)}`);
      return x;
    });
    setForm(null); setLabel(p);
    toast(`Parcel ${p.waybill} accepted. Fee ${peso(p.fee)}.`);
  };
  const valid = form && form.sname && form.smobile && form.rname && form.rmobile && Number(form.kg) > 0 && Number(form.kg) <= Number(setting(state, 'parcels.rates.maxKg'));
  const dests = state.terminals.filter((t) => t.on && t.parcels);

  return (
    <>
      <TopBar crumb="Services" title="Parcels & cargo" menu={menu} onSignOut={onSignOut} after={<span className="st s-mute" style={{ marginLeft: 6 }}>Phase 2</span>}>
        <label className="ctl"><Icon name="building" /><select value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Terminal">{all && <option value="all">All terminals</option>}{terminals.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="ctl" style={{ minWidth: 220 }}><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Waybill or name" style={{ width: '100%' }} /></label>
        <button type="button" className="btn-a b-navy" onClick={() => setForm({ from: term === 'all' ? 'cubao' : term, to: 'dagupan', sname: '', smobile: '', rname: '', rmobile: '', item: '', pieces: 1, kg: 3, declared: 1000, paidBy: 'sender', tripId: '' })}><Icon name="plus" />Accept parcel</button>
      </TopBar>
      <div className="pad">
        <div className="kpis">
          {Object.entries(PARCEL_STATUS).filter(([k]) => k !== 'returned').map(([k, v]) => <button type="button" key={k} className={`k ${status === k ? 'sel' : ''}`} onClick={() => setStatus(status === k ? '' : k)} style={{ textAlign: 'left' }}><div className="l"><Icon name={v.icon} />{v.label}</div><div className="v">{count(k)}</div></button>)}
          <div className="k"><div className="l"><Icon name="coins" />Fees this week</div><div className="v">{peso(state.parcels.filter((p) => p.createdAt > new Date(Date.now() - 7 * 86400000).toISOString()).reduce((s, p) => s + p.fee, 0))}</div></div>
        </div>
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Waybill</th><th>Route</th><th>Sender → Receiver</th><th>Item</th><th>Weight</th><th>Fee</th><th>Status</th><th /></tr></thead>
              <tbody>{rows.slice(0, 80).map((p) => (
                <tr key={p.id}>
                  <td><b>{p.waybill}</b><div className="mini">{new Date(p.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div></td>
                  <td>{tName(state, p.from)} → {tName(state, p.to)}</td>
                  <td className="mini">{p.sender.name}<br />→ {p.receiver.name}</td>
                  <td className="mini">{p.item} · {p.pieces} pc</td>
                  <td>{p.kg} kg</td>
                  <td>{peso(p.fee)}<div className="mini">{p.paidBy === 'receiver' ? 'receiver pays' : 'paid'}</div></td>
                  <td><StatusPill status={p.status} map={PARCEL_STATUS} /></td>
                  <td><div className="acts">{NEXT[p.status] && <button type="button" className="btn-a b-ghost b-xs" onClick={() => advance(p)}>{NEXT_LABEL[p.status]}</button>}<button type="button" className="btn-a b-ghost b-xs" onClick={() => setLabel(p)} aria-label="Label"><Icon name="qr" /></button></div></td>
                </tr>
              ))}</tbody>
            </table>
            {!rows.length && <Empty icon="package">No parcels match.</Empty>}
          </div>
        </div>
      </div>
      {form && (
        <Modal title="Accept a parcel" width={640} onClose={() => setForm(null)} footer={<><span className="mini" style={{ marginRight: 'auto' }}>Fee: <b style={{ fontSize: 16, color: 'var(--ink)' }}>{peso(parcelFee(state, form))}</b></span><button type="button" className="btn-a b-ghost" onClick={() => setForm(null)}>Cancel</button><button type="button" className="btn-a b-navy" disabled={!valid} onClick={save}>Accept & print label</button></>}>
          <div className="row2">
            <label className="field"><span>From</span><select className="select" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}>{dests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="field"><span>To</span><select className="select" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>{dests.filter((t) => t.id !== form.from).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="field"><span>Sender name</span><input className="input" value={form.sname} onChange={(e) => setForm({ ...form, sname: e.target.value })} /></label>
            <label className="field"><span>Sender mobile</span><input className="input" value={form.smobile} onChange={(e) => setForm({ ...form, smobile: e.target.value })} /></label>
            <label className="field"><span>Receiver name</span><input className="input" value={form.rname} onChange={(e) => setForm({ ...form, rname: e.target.value })} /></label>
            <label className="field"><span>Receiver mobile</span><input className="input" value={form.rmobile} onChange={(e) => setForm({ ...form, rmobile: e.target.value })} /></label>
          </div>
          <div className="row3">
            <label className="field"><span>Contents</span><input className="input" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="Inspected" /></label>
            <label className="field"><span>Pieces</span><input className="input" type="number" min="1" value={form.pieces} onChange={(e) => setForm({ ...form, pieces: e.target.value })} /></label>
            <label className="field"><span>Weight (kg)</span><input className="input" type="number" min="0.5" step="0.5" value={form.kg} onChange={(e) => setForm({ ...form, kg: e.target.value })} /></label>
            <label className="field"><span>Declared value (₱)</span><input className="input" type="number" min="0" value={form.declared} onChange={(e) => setForm({ ...form, declared: e.target.value })} /></label>
            <label className="field"><span>Who pays</span><select className="select" value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })}><option value="sender">Sender (now)</option>{setting(state, 'parcels.handling.cod') && <option value="receiver">Receiver (on pick-up)</option>}</select></label>
            <label className="field"><span>Load on trip (optional)</span><select className="select" value={form.tripId} onChange={(e) => setForm({ ...form, tripId: e.target.value })}><option value="">Next available</option>{tripsOn(state, todayYmd(), { from: form.from, to: form.to }).filter((t) => tripStatus(t) === 'scheduled').map((t) => <option key={t.id} value={t.id}>{t.time}</option>)}</select></label>
          </div>
        </Modal>
      )}
      {label && (
        <Modal title={`Label ${label.waybill}`} width={360} onClose={() => setLabel(null)} footer={<button type="button" className="btn-a b-navy" onClick={() => window.print()}><Icon name="file" />Print</button>}>
          <div className="print-area receipt"><b>FIVE STAR PARCEL</b><QrCode text={label.waybill} size={130} /><b style={{ fontSize: 18 }}>{label.waybill}</b><div><b>{tName(state, label.from)} → {tName(state, label.to)}</b></div><div className="r"><span>To</span><span>{label.receiver.name} · {label.receiver.mobile}</span></div><div className="r"><span>From</span><span>{label.sender.name}</span></div><div className="r"><span>{label.pieces} pc · {label.kg} kg</span><span>{peso(label.fee)} {label.paidBy === 'receiver' ? 'COLLECT' : 'PAID'}</span></div></div>
        </Modal>
      )}
    </>
  );
}
