import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { useStore } from '../lib/store.jsx';
import { destinationsFrom, servedTerminals, todayYmd } from '../lib/trips.js';
import { addDays, ymd } from '../lib/data.js';
import { searchUrl } from './util.js';

/** From · To · Date · Passengers. Used on the homepage hero and at the top of the results. */
export default function TripSearch({ initial = {}, compact, onSearch }) {
  const { state } = useStore();
  const nav = useNavigate();
  const all = servedTerminals(state);
  const [from, setFrom] = useState(initial.from || 'cubao');
  const dests = destinationsFrom(state, from);
  const [to, setTo] = useState(initial.to && dests.some((t) => t.id === initial.to) ? initial.to : dests[0]?.id || '');
  const [date, setDate] = useState(initial.date || todayYmd());
  const [pax, setPax] = useState(Number(initial.pax) || 1);
  const maxSeats = Number(state.settings.booking.general.maxSeats);

  const pickFrom = (id) => {
    setFrom(id);
    const d = destinationsFrom(state, id);
    if (!d.some((t) => t.id === to)) setTo(d[0]?.id || '');
  };
  const swap = () => { if (destinationsFrom(state, to).some((t) => t.id === from)) { setFrom(to); setTo(from); } };
  const go = (e) => {
    e.preventDefault();
    if (!to) return;
    const url = searchUrl({ from, to, date, pax });
    if (onSearch) onSearch({ from, to, date, pax }); else nav(url);
  };
  const quick = [[todayYmd(), 'Today'], [ymd(addDays(new Date(), 1)), 'Tomorrow']];
  const groups = [...new Set(all.map((t) => t.region))];

  return (
    <form className={`tsearch ${compact ? 'compact' : ''}`} onSubmit={go}>
      <label className="tf">
        <span><Icon name="pin" />From</span>
        <select value={from} onChange={(e) => pickFrom(e.target.value)} aria-label="From">
          {groups.map((g) => <optgroup key={g} label={g}>{all.filter((t) => t.region === g).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}
        </select>
      </label>
      <button type="button" className="swap" onClick={swap} aria-label="Swap from and to"><Icon name="swap" /></button>
      <label className="tf">
        <span><Icon name="flag" />To</span>
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="To">
          {dests.map((t) => <option key={t.id} value={t.id}>{t.name}{t.region !== 'Metro Manila' ? `, ${t.region}` : ''}</option>)}
        </select>
      </label>
      <label className="tf">
        <span><Icon name="calendar" />Date</span>
        <input type="date" value={date} min={todayYmd()} onChange={(e) => setDate(e.target.value)} aria-label="Travel date" />
      </label>
      <label className="tf small">
        <span><Icon name="users" />Passengers</span>
        <select value={pax} onChange={(e) => setPax(Number(e.target.value))} aria-label="Passengers">
          {Array.from({ length: maxSeats }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
        </select>
      </label>
      <button type="submit" className="btn btn-gold go"><Icon name="search" />Search trips</button>
      {!compact && (
        <div className="quick">
          {quick.map(([d, l]) => <button type="button" key={d} className={`chip ${date === d ? 'on' : ''}`} onClick={() => setDate(d)}>{l}</button>)}
          <span className="mini">Online sales close {state.settings.booking.general.cutoffMinutes} min before departure.</span>
        </div>
      )}
    </form>
  );
}
