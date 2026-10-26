import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { addDays, ymd } from '../lib/data.js';
import { useStore } from '../lib/store.jsx';
import { SOURCE_LABEL, busOf, clsOf, crewOf, peso, seatList, tName, takenSeats, todayYmd, tripStatus, tripsOn } from '../lib/trips.js';
import { BarList, Heatmap, LineChart } from './charts.jsx';
import { TopBar, useTerminalScope } from './AdminApp.jsx';

export default function Dashboard({ menu, onSignOut }) {
  const { state } = useStore();
  const { all, hubs, inScope } = useTerminalScope();
  const [term, setTerm] = useState(all ? 'all' : hubs[0]?.id);
  const [days, setDays] = useState(30);
  const now = Date.now();
  const today = todayYmd();

  const data = useMemo(() => {
    const scope = (trip) => term === 'all' || trip.fromId === term || trip.toId === term;
    const tripsToday = tripsOn(state, today).filter((t) => (all || inScope(t.fromId) || inScope(t.toId)) && scope(t));
    const st = tripsToday.reduce((m, t) => { const s = tripStatus(t, now); m[s] = (m[s] || 0) + 1; return m; }, {});
    const departed = tripsToday.filter((t) => ['departed', 'arrived'].includes(tripStatus(t, now)));
    const seats = departed.reduce((s, t) => s + seatList(clsOf(state, t.cls)).length, 0);
    const sold = departed.reduce((s, t) => s + takenSeats(state, t).size, 0);
    const tripOf = (b) => { const [routeId, dir] = b.tripId.split('_'); const r = state.routes.find((x) => x.id === routeId); return r ? { fromId: dir === 'out' ? r.from : r.to, toId: dir === 'out' ? r.to : r.from, r } : null; };
    const inT = (b) => { const t = tripOf(b); return t && (term === 'all' || t.fromId === term || t.toId === term); };
    const paid = state.bookings.filter((b) => ['paid', 'refunded'].includes(b.pay.status) && inT(b));
    const labels = []; const online = []; const counter = []; const tix = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = ymd(addDays(new Date(), -i));
      const list = paid.filter((b) => b.createdAt.slice(0, 10) === d && b.pay.status === 'paid');
      labels.push(new Date(`${d}T00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }));
      online.push(Math.round(list.filter((b) => ['website', 'app'].includes(b.source)).reduce((s, b) => s + b.total, 0) / 1000));
      counter.push(Math.round(list.filter((b) => !['website', 'app'].includes(b.source)).reduce((s, b) => s + b.total, 0) / 1000));
      tix.push(list.reduce((s, b) => s + b.pax.length, 0));
    }
    const since = ymd(addDays(new Date(), -days));
    const period = paid.filter((b) => b.createdAt.slice(0, 10) > since && b.pay.status === 'paid');
    const prev = paid.filter((b) => b.createdAt.slice(0, 10) <= since && b.createdAt.slice(0, 10) > ymd(addDays(new Date(), -2 * days)) && b.pay.status === 'paid');
    const rev = period.reduce((s, b) => s + b.total, 0);
    const prevRev = prev.reduce((s, b) => s + b.total, 0);
    const bySource = Object.entries(period.reduce((m, b) => { m[b.source] = (m[b.source] || 0) + b.pax.length; return m; }, {})).map(([k, v]) => [SOURCE_LABEL[k], v]).sort((a, b) => b[1] - a[1]);
    const byRoute = Object.entries(period.reduce((m, b) => { const t = tripOf(b); if (t) { const k = `${tName(state, t.r.from)} – ${tName(state, t.r.to)}`; m[k] = (m[k] || 0) + b.total; } return m; }, {})).map(([k, v]) => [k, Math.round(v / 1000)]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const grid = Array.from({ length: 7 }, () => Array(12).fill(0));
    period.forEach((b) => { const [, , date, hm] = b.tripId.split('_'); const wd = (new Date(`${date}T00:00`).getDay() + 6) % 7; grid[wd][Math.floor(Number(hm.slice(0, 2)) / 2)] += b.pax.length; });
    const lf = departed.length ? Math.round((sold / seats) * 100) : 0;
    const loadByRoute = Object.entries(departed.reduce((m, t) => { const k = `${tName(state, t.fromId)} → ${tName(state, t.toId)}`; m[k] = m[k] || [0, 0]; m[k][0] += takenSeats(state, t).size; m[k][1] += seatList(clsOf(state, t.cls)).length; return m; }, {})).map(([k, [a, b]]) => [k, Math.round((a / b) * 100)]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const todaySold = paid.filter((b) => b.createdAt.slice(0, 10) === today && b.pay.status === 'paid');
    return { tripsToday, st, lf, labels, online, counter, tix, rev, prevRev, period, bySource, byRoute, grid, loadByRoute, todaySold, sold };
  }, [state, term, days, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const pmsKm = Number(state.settings.fleet.maintenance.pmsKm);
  const warnDays = Number(state.settings.fleet.documents.warnDays);
  const soon = ymd(addDays(new Date(), warnDays));
  const pmsDue = state.buses.filter((b) => b.odometer - b.lastPmsKm >= pmsKm - Number(state.settings.fleet.maintenance.warnKm));
  const docs = state.buses.filter((b) => [b.regExpiry, b.cpcExpiry, b.insExpiry].some((d) => d <= soon));
  const licenses = state.crew.filter((c) => c.licenseExpiry && c.licenseExpiry <= soon);
  const delayed = data.tripsToday.filter((t) => t.ops.delay && ['scheduled', 'delayed', 'boarding', 'departed'].includes(tripStatus(t)));
  const unassigned = data.tripsToday.filter((t) => !t.ops.busId && ['scheduled', 'delayed'].includes(tripStatus(t)));
  const flagged = state.accounts.filter((a) => a.status === 'flagged' || (a.lockedUntil && new Date(a.lockedUntil) > new Date()));
  const change = data.prevRev ? Math.round(((data.rev - data.prevRev) / data.prevRev) * 100) : 0;
  const onlineShare = data.period.length ? Math.round((data.period.filter((b) => ['website', 'app'].includes(b.source)).length / data.period.length) * 100) : 0;

  return (
    <>
      <TopBar crumb="Overview" title="Dashboard" menu={menu} onSignOut={onSignOut}>
        <label className="ctl"><Icon name="building" /><select value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Terminal">{all && <option value="all">All terminals</option>}{hubs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <div className="seg">{[7, 30, 60].map((d) => <button type="button" key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d} days</button>)}</div>
      </TopBar>
      <div className="pad">
        <div className="kpis">
          <div className="k"><div className="l"><Icon name="bus" />Trips today</div><div className="v">{data.tripsToday.length}</div><div className="d">{data.st.departed || 0} on the road · {data.st.arrived || 0} arrived</div></div>
          <div className="k"><div className="l"><Icon name="ticket" />Tickets sold today</div><div className="v">{data.todaySold.reduce((s, b) => s + b.pax.length, 0)}</div><div className="d">{peso(data.todaySold.reduce((s, b) => s + b.total, 0))} in the system</div></div>
          <div className="k"><div className="l"><Icon name="seat" />Load factor today</div><div className="v">{data.lf}%</div><div className="d">{data.sold.toLocaleString()} seats on departed trips</div></div>
          <div className="k"><div className="l"><Icon name="coins" />Revenue {days} days</div><div className="v">{peso(Math.round(data.rev / 1000))}k</div><div className={`d ${change >= 0 ? 'up' : 'dn'}`}>{change >= 0 ? '▲' : '▼'} {Math.abs(change)}% vs previous {days} days</div></div>
          <div className="k"><div className="l"><Icon name="smartphone" />Sold online</div><div className="v">{onlineShare}%</div><div className="d">website + app, rest at counters</div></div>
          <div className="k"><div className="l"><Icon name="alert" />Delayed now</div><div className="v">{delayed.length}</div><div className="d">{data.st.cancelled || 0} cancelled · {unassigned.length} without a bus</div></div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="panel">
            <div className="ph-row"><h3>Ticket revenue per day</h3><span className="sub">₱ thousands, by sales channel</span><span className="sp" /><span className="sample">sample data</span></div>
            <LineChart labels={data.labels} series={[{ name: 'Online', color: '#2A4FB0', values: data.online }, { name: 'Counter', color: '#C28700', values: data.counter }]} unit="k" height={400} />
          </div>
          <div className="panel">
            <div className="ph-row"><h3>Needs attention</h3></div>
            <Alert to="/admin/dispatch" icon="alert" tone="warn" title={`${delayed.length} trips delayed`} text={delayed.slice(0, 2).map((t) => `${t.time} ${tName(state, t.fromId)}→${tName(state, t.toId)} +${t.ops.delay}m`).join(' · ') || 'All on time'} />
            <Alert to="/admin/dispatch" icon="bus" tone="info" title={`${unassigned.length} trips today without a bus`} text="Assign buses and crew on the dispatch board." />
            <Alert to="/admin/fleet" icon="tool" tone="warn" title={`${pmsDue.length} buses due for PMS`} text={`Every ${pmsKm.toLocaleString()} km · ${state.workOrders.filter((w) => w.status !== 'done').length} open work orders`} />
            <Alert to="/admin/fleet" icon="file" tone="bad" title={`${docs.length} buses with documents expiring`} text={`Registration, LTFRB franchise or insurance within ${warnDays} days · ${licenses.length} driver licenses`} />
            <Alert to="/admin/remittance" icon="coins" tone="info" title={`${state.remittances.filter((r) => r.status === 'pending').length} conductor remittances pending`} text="Cash from roadside tickets, to be counted by the cashier." />
            <Alert to="/admin/charters" icon="building" tone="info" title={`${state.charters.filter((c) => c.status === 'new').length} new bus rental requests`} text="Send the quotation within 24 hours." />
            <Alert to="/admin/staff" icon="shield" tone={flagged.length ? 'bad' : 'good'} title={`${flagged.length} locked or flagged accounts`} text={`Last backup today 02:00 · SMS: Semaphore ${state.settings.integrations.semaphore.enabled ? 'connected' : 'not connected (simulated)'}`} />
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="panel"><div className="ph-row"><h3>Top routes by revenue</h3><span className="sub">₱ thousands · {days} days</span></div><BarList data={data.byRoute} unit="k" labelWidth={150} /></div>
          <div className="panel"><div className="ph-row"><h3>Load factor today</h3><span className="sub">seats sold ÷ seats, departed trips</span></div><BarList data={data.loadByRoute} unit="%" color="#0E9AA7" labelWidth={150} /></div>
          <div className="panel"><div className="ph-row"><h3>Tickets by channel</h3><span className="sub">{days} days</span></div><BarList data={data.bySource} color="#C28700" labelWidth={150} /></div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
          <div className="panel"><div className="ph-row"><h3>Busiest departure times</h3><span className="sub">passengers by weekday and departure hour · plan extra trips and crew</span></div><Heatmap grid={data.grid} /></div>
          <div className="panel">
            <div className="ph-row"><h3>Next departures</h3><span className="sp" /><Link to="/admin/dispatch" className="btn-a b-ghost b-xs">Dispatch board</Link></div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Time</th><th>Route</th><th>Bus</th><th>Seats</th></tr></thead>
                <tbody>{data.tripsToday.filter((t) => ['scheduled', 'delayed', 'boarding'].includes(tripStatus(t))).slice(0, 8).map((t) => (
                  <tr key={t.id}><td><b>{t.time}</b>{t.ops.delay ? <span className="st s-warn" style={{ marginLeft: 4 }}>+{t.ops.delay}</span> : null}</td><td>{tName(state, t.fromId)} → {tName(state, t.toId)}</td><td>{busOf(state, t.ops.busId)?.bodyNo || <span className="st s-warn">none</span>}<div className="mini">{crewOf(state, t.ops.driverId)?.name.split(' ')[0] || ''}</div></td><td>{takenSeats(state, t).size}/{seatList(clsOf(state, t.cls)).length}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Alert({ to, icon, tone, title, text }) {
  const bg = { warn: ['var(--warn-bg)', 'var(--warn)'], bad: ['var(--bad-bg)', 'var(--bad)'], info: ['var(--blue-50)', 'var(--blue)'], good: ['var(--good-bg)', 'var(--good)'] }[tone];
  return <Link to={to} className="al"><span className="ico" style={{ background: bg[0], color: bg[1] }}><Icon name={icon} /></span><div><b>{title}</b><span>{text}</span></div></Link>;
}
