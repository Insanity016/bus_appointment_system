import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { audit, useStore } from '../lib/store.jsx';
import { fmtDate, seatList } from '../lib/trips.js';
import { NetworkMap } from '../shared.jsx';

export function NewsList() {
  const { state } = useStore();
  const [type, setType] = useState('all');
  const posts = [...state.posts].sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date)).filter((p) => type === 'all' || p.type === type);
  return (
    <>
      <div className="page-hero slim"><div className="wrap"><h1>News & travel advisories</h1><p>Holiday trips, road conditions, new routes and promos.</p>
        <div className="seg-l light" style={{ marginTop: 12 }}>{[['all', 'All'], ['advisory', 'Advisories'], ['news', 'News']].map(([k, l]) => <button type="button" key={k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>{l}</button>)}</div>
      </div></div>
      <div className="wrap news-grid">
        {posts.map((p) => (
          <Link to={`/news/${p.id}`} key={p.id} className="ncard">
            {p.photo ? <img src={p.photo} alt="" /> : <div className={`nart ${p.type}`}><Icon name={p.type === 'advisory' ? 'megaphone' : 'bus'} size={36} /></div>}
            <div><span className={`ntag ${p.type}`}>{p.type === 'advisory' ? 'Advisory' : 'News'}{p.pinned ? ' · pinned' : ''}</span><h3>{p.title}</h3><p>{p.body.split('\n')[0]}</p><span className="mini">{fmtDate(p.date, { month: 'long', day: 'numeric', year: 'numeric' })}</span></div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function NewsDetail() {
  const { id } = useParams();
  const { state } = useStore();
  const p = state.posts.find((x) => x.id === id);
  if (!p) return <NotFound />;
  return (
    <article className="wrap article">
      <Link to="/news" className="mini"><Icon name="left" />All news</Link>
      <span className={`ntag ${p.type}`}>{p.type === 'advisory' ? 'Travel advisory' : 'News'}</span>
      <h1>{p.title}</h1>
      <p className="mini">{fmtDate(p.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
      {p.photo && <img src={p.photo} alt="" />}
      {p.body.split('\n\n').map((x, i) => <p key={i}>{x}</p>)}
      <Link to="/book" className="btn btn-gold"><Icon name="ticket" />Book a trip</Link>
    </article>
  );
}

export function Help() {
  const { state, update, toast } = useStore();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(0);
  const [f, setF] = useState({ name: '', mobile: '', email: '', topic: params.get('topic') || 'Booking', message: '' });
  const [sent, setSent] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    update((d) => {
      d.inquiries.unshift({ id: Date.now(), at: new Date().toISOString(), ...f, status: 'new' });
      audit(d, 'inquiry.received', `Inquiry (${f.topic}) from ${f.name}`, { actor: `Guest ${f.name}` });
    });
    setSent(true);
    toast('Message sent. Customer service replies within one business day.');
  };
  return (
    <>
      <div className="page-hero slim"><div className="wrap"><h1>Help center</h1><p>Answers to common questions, our privacy notice and terms, and a way to reach customer service.</p></div></div>
      <div className="wrap help">
        <div>
          <h2>Frequently asked questions</h2>
          <div className="faq">{state.faqs.map((x, i) => <div key={i} className={`fq ${open === i ? 'open' : ''}`}><button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>{x.q}<Icon name="down" /></button>{open === i && <p>{x.a}</p>}</div>)}</div>
          <h2 style={{ marginTop: 28 }}>Privacy notice & terms of carriage</h2>
          <p className="mini">Written and versioned in the CMS. Passengers accept the current version when booking; the accepted version is stored with the booking (Data Privacy Act of 2012).</p>
        </div>
        <div className="panel-s">
          {sent ? <div className="okbox big"><Icon name="check" /><div><b>Thank you!</b><span>We received your message and will reply by SMS or email.</span></div></div> : (
            <form onSubmit={submit}>
              <h3 style={{ marginBottom: 12 }}>Contact customer service</h3>
              <label className="field"><span>Topic</span><select className="select" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>{['Booking', 'Refund', 'Lost item', 'Parcel', 'Rent a bus', 'Corporate account', 'Feedback', 'Other'].map((t) => <option key={t}>{t}</option>)}</select></label>
              <div className="row2">
                <label className="field"><span>Name</span><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
                <label className="field"><span>Mobile</span><input className="input" required value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></label>
              </div>
              <label className="field"><span>Email (optional)</span><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
              <label className="field"><span>Message</span><textarea className="textarea" required value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Include your booking reference if you have one." /></label>
              <button className="btn btn-gold btn-block" type="submit"><Icon name="send" />Send</button>
              <p className="mini" style={{ marginTop: 10 }}>Or call {state.brand.hotline} · {state.brand.email}</p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

export function About() {
  const { state } = useStore();
  return (
    <>
      <div className="page-hero"><div className="wrap"><span className="kicker light">About Five Star</span><h1>{state.brand.tagline}</h1><p>{state.brand.tagline2}</p></div></div>
      <div className="wrap about">
        <div>
          <h2>Our story</h2><p>{state.brand.about}</p>
          <h2>Our promise</h2><p>{state.brand.mission}</p>
          <div className="stats light">{state.home.stats.map((s, i) => <div key={i}><Icon name={s.icon} /><b>{s.value}</b><span>{s.label}</span></div>)}</div>
          <h2>Our fleet</h2>
          <p>{state.buses.length}+ buses in the sample data across {state.classes.length} classes: {state.classes.map((c) => `${c.name} (${seatList(c).length} seats)`).join(', ')}.</p>
        </div>
        <NetworkMap state={state} labels="all" />
      </div>
    </>
  );
}

export function NotFound() {
  return <div className="wrap" style={{ padding: '80px 0', textAlign: 'center' }}><h1 style={{ fontSize: 60, color: 'var(--blue)' }}>404</h1><p>This page took a different route.</p><Link to="/" className="btn btn-gold" style={{ marginTop: 16 }}>Back home</Link></div>;
}
