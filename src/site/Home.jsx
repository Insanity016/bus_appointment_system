import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { useStore } from '../lib/store.jsx';
import { Stars } from '../components.jsx';
import { BusArt, NetworkMap, QrCode } from '../shared.jsx';
import { TRIP_STATUS, clsOf, fmtDate, fmtDur, fmtTime, lowestFare, peso, saleClosed, seatList, seatsLeft, tName, todayYmd, tripStatus, tripsOn } from '../lib/trips.js';
import TripSearch from './TripSearch.jsx';
import { addDays, ymd } from '../lib/data.js';
import { linkProps, searchUrl } from './util.js';

function CmsLink({ link, className, children }) {
  const { state } = useStore();
  const p = linkProps(link, state.brand);
  if (!p) return null;
  return p.to ? <Link to={p.to} className={className}>{children}</Link> : <a {...p} className={className}>{children}</a>;
}

function Hero({ home, brand }) {
  const slides = home.hero.slides.filter((s) => s.on);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), Number(home.hero.autoplay || 7) * 1000);
    return () => clearInterval(t);
  }, [slides.length, home.hero.autoplay]);
  const s = slides[Math.min(i, slides.length - 1)];
  if (!s) return null;
  return (
    <section className="hero">
      <div className="hero-bg" key={s.id}>
        {s.photo ? <img src={s.photo} alt={s.alt} /> : <BusArt mode={s.art} brand={brand} />}
        <div className="hero-shade" />
      </div>
      <div className="wrap hero-in">
        <div className="hero-copy" key={`c${s.id}`}>
          {s.eyebrow && <span className="eyebrow"><Icon name="sparkle" />{s.eyebrow}</span>}
          <h1>{s.headline} <em>{s.accent}</em></h1>
          <p>{s.text}</p>
          <div className="hero-btns">
            {s.btn1 && <CmsLink link={s.link1} className="btn btn-gold btn-lg">{s.btn1}<Icon name="right" /></CmsLink>}
            {s.btn2 && <CmsLink link={s.link2} className="btn btn-light btn-lg">{s.btn2}</CmsLink>}
          </div>
        </div>
        {slides.length > 1 && (
          <div className="dots" role="tablist" aria-label="Slides">
            {slides.map((x, k) => <button type="button" key={x.id} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} aria-selected={k === i} role="tab" />)}
          </div>
        )}
      </div>
    </section>
  );
}

function SearchBlock({ home }) {
  return (
    <section className="search-sec">
      <div className="wrap">
        <div className="search-card">
          <div className="sc-tabs">
            <span className="on"><Icon name="ticket" />{home.searchTitle}</span>
            <Link to="/track"><Icon name="nav" />Track a bus</Link>
            <Link to="/parcels"><Icon name="package" />Track a parcel</Link>
            <Link to="/manage"><Icon name="edit" />Manage booking</Link>
          </div>
          <TripSearch />
        </div>
      </div>
    </section>
  );
}

function Advisories() {
  const { state } = useStore();
  const pinned = state.posts.filter((p) => p.type === 'advisory').sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date)).slice(0, 2);
  if (!pinned.length) return null;
  return (
    <section className="wrap adv">
      {pinned.map((p) => (
        <Link to={`/news/${p.id}`} key={p.id} className={`adv-card ${p.pinned ? 'hot' : ''}`}>
          <span className="ico"><Icon name="megaphone" /></span>
          <div><b>{p.title}</b><span>{p.body.split('\n')[0].slice(0, 110)}…</span></div>
          <Icon name="next" />
        </Link>
      ))}
    </section>
  );
}

function Popular({ home }) {
  const { state } = useStore();
  const routes = state.routes.filter((r) => r.on && r.featured).slice(0, 6);
  const today = todayYmd();
  return (
    <section className="hsec">
      <div className="wrap">
        <div className="sec-h"><div><span className="kicker">Most travelled</span><h2>{home.popularTitle}</h2><p>{home.popularText}</p></div><Link to="/routes" className="btn btn-ghost">All routes<Icon name="right" /></Link></div>
        <div className="routes-grid">
          {routes.map((r, i) => (
            <Link key={r.id} to={searchUrl({ from: r.from, to: r.to, date: today })} className={`rcard t${i % 3}`}>
              <div className="rc-top">
                <span className="rc-from">{tName(state, r.from)}</span>
                <span className="rc-line"><i /><Icon name="bus" /><i /></span>
                <span className="rc-to">{tName(state, r.to)}</span>
              </div>
              <div className="rc-body">
                <div className="rc-meta"><span><Icon name="clock" />{fmtDur(r.mins)}</span><span><Icon name="route" />via {r.via}</span><span><Icon name="calendar" />{r.out.length} trips a day</span></div>
                <div className="rc-price"><small>from</small><b>{peso(lowestFare(r))}</b><span className="btn btn-sm btn-blue">Book<Icon name="right" /></span></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Departures({ home }) {
  const { state } = useStore();
  const hubs = state.terminals.filter((t) => t.hub && t.on);
  const [from, setFrom] = useState(hubs[0]?.id);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const list = useMemo(() => tripsOn(state, todayYmd(), { from }).concat(tripsOn(state, ymd(addDays(new Date(), 1)), { from }))
    .filter((t) => t.etd.getTime() > now - 10 * 60000 && tripStatus(t, now) !== 'arrived').slice(0, 8), [state, from, now]);
  return (
    <section className="hsec dark">
      <div className="wrap">
        <div className="sec-h"><div><span className="kicker">Live from the schedule</span><h2>{home.departuresTitle}</h2></div>
          <div className="seg-l">{hubs.map((t) => <button type="button" key={t.id} className={from === t.id ? 'on' : ''} onClick={() => setFrom(t.id)}>{t.name}</button>)}</div>
        </div>
        <div className="board">
          <div className="board-h"><span>Time</span><span>Destination</span><span className="hide-s">Class</span><span className="hide-s">Seats</span><span>Status</span><span /></div>
          {list.map((t) => {
            const st = tripStatus(t, now);
            const closed = saleClosed(state, t, now);
            const left = seatsLeft(state, t);
            return (
              <div className="board-r" key={t.id}>
                <span className="bt">{fmtTime(t.time)}{t.ops.delay ? <small>→ {fmtTime(t.etd)}</small> : null}</span>
                <span className="bd"><b>{tName(state, t.toId)}</b><small>via {t.route.via}{t.extra ? ' · extra trip' : ''}</small></span>
                <span className="hide-s"><i className="cdot" style={{ background: clsOf(state, t.cls).color }} />{clsOf(state, t.cls).short}</span>
                <span className="hide-s">{left}/{seatList(clsOf(state, t.cls)).length}</span>
                <span><span className={`bst ${st}`}>{st === 'scheduled' ? 'On time' : st === 'delayed' ? `Delayed ${t.ops.delay}m` : TRIP_STATUS[st].label}</span></span>
                <span>{!closed && left > 0 ? <Link className="btn btn-sm btn-gold" to={searchUrl({ from: t.fromId, to: t.toId, date: t.date })}>Book</Link> : <span className="mini">{left ? 'Counter only' : 'Full'}</span>}</span>
              </div>
            );
          })}
          {!list.length && <div className="board-r"><span /><span>No more departures today.</span></div>}
        </div>
        <p className="board-note"><Icon name="monitor" />The same board runs on the TV screens at the terminals.</p>
      </div>
    </section>
  );
}

function Network({ home }) {
  const { state } = useStore();
  const [sel, setSel] = useState('dagupan');
  const t = state.terminals.find((x) => x.id === sel);
  const regions = [...new Set(state.terminals.filter((x) => x.on).map((x) => x.region))];
  const routesHere = state.routes.filter((r) => r.on && (r.from === sel || r.to === sel));
  return (
    <section className="hsec">
      <div className="wrap net">
        <div>
          <span className="kicker">Where we go</span>
          <h2>{home.networkTitle}</h2>
          <p className="lead">{home.networkText}</p>
          <div className="regions">
            {regions.map((g) => (
              <div key={g}><b>{g}</b><div className="chips">{state.terminals.filter((x) => x.on && x.region === g).map((x) => <button type="button" key={x.id} className={`chip ${sel === x.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>{x.name}</button>)}</div></div>
            ))}
          </div>
          {t && (
            <div className="net-card">
              <b>{t.name}</b><span className="mini">{t.area}{t.region !== 'Metro Manila' ? `, ${t.region}` : ''}</span>
              <div className="chips" style={{ marginTop: 8 }}>{routesHere.slice(0, 6).map((r) => { const other = r.from === sel ? r.to : r.from; return <Link key={r.id} className="chip" to={searchUrl({ from: sel, to: other, date: todayYmd() })}>{t.hub ? '→' : '↔'} {tName(state, other)} · {peso(lowestFare(r))}</Link>; })}</div>
            </div>
          )}
        </div>
        <NetworkMap state={state} selected={sel} onSelect={setSel} highlight />
      </div>
    </section>
  );
}

function Classes({ home }) {
  const { state } = useStore();
  const icons = { 'Air-conditioned': 'snow', 'On-board toilet': 'toilet', 'USB charging': 'plug', 'Free Wi-Fi': 'wifi', 'Power outlet & USB': 'plug', 'CCTV on board': 'eye' };
  return (
    <section className="hsec soft">
      <div className="wrap">
        <div className="sec-h"><div><span className="kicker">Bus classes</span><h2>{home.classesTitle}</h2></div></div>
        <div className="classes">
          {state.classes.filter((c) => c.on).map((c) => (
            <div className="ccard" key={c.id} style={{ '--c': c.color }}>
              <div className="cc-h"><span className="cc-badge">{c.layout} seating</span><h3>{c.name}</h3><p>{c.text}</p></div>
              <div className="cc-seats" aria-hidden="true">
                {Array.from({ length: 4 }, (_, r) => <div key={r}>{(c.layout === '2-1' ? [1, 1, 0, 1] : [1, 1, 0, 1, 1]).map((x, k) => <i key={k} className={x ? '' : 'gap'} />)}</div>)}
              </div>
              <ul>{c.amenities.map((a) => <li key={a}><Icon name={icons[a] || 'check'} />{a}</li>)}</ul>
              <div className="cc-f"><b>{seatList(c).length} seats</b><span>{c.id === 'regular' ? 'Lowest fare' : c.id === 'deluxe' ? 'About +18%' : 'About +55%'}</span></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Why({ home }) {
  return (
    <section className="hsec">
      <div className="wrap">
        <div className="why">
          <div className="why-l">
            <span className="kicker">Why Five Star</span>
            <h2>{home.whyTitle}</h2>
            <div className="stats">{home.stats.map((s, i) => <div key={i}><Icon name={s.icon} /><b>{s.value}</b><span>{s.label}</span></div>)}</div>
          </div>
          <div className="promises">{home.promises.map((p, i) => <div key={i}><span className="ico"><Icon name={p.icon} /></span><b>{p.title}</b><p>{p.text}</p></div>)}</div>
        </div>
      </div>
    </section>
  );
}

function AppPromo({ home }) {
  const { state } = useStore();
  return (
    <section className="hsec app-sec">
      <div className="wrap app-in">
        <div>
          <span className="kicker light">Five Star app</span>
          <h2>{home.appTitle}</h2>
          <p>{home.appText}</p>
          <ul className="app-list">
            <li><Icon name="qr" />E-tickets that work offline</li>
            <li><Icon name="nav" />Live bus location and arrival time</li>
            <li><Icon name="bell" />Delay and boarding alerts</li>
            <li><Icon name="gift" />Star Points on every trip</li>
          </ul>
          <div className="stores">
            <Link to="/app" className="store"><Icon name="smartphone" /><span><small>Open now</small>Try the app</span></Link>
            <span className="store muted"><Icon name="download" /><span><small>Phase 2</small>Google Play</span></span>
            <span className="store muted"><Icon name="download" /><span><small>Phase 2</small>App Store</span></span>
          </div>
        </div>
        <div className="phone-art">
          <div className="phone">
            <div className="ph-notch" />
            <div className="ph-screen">
              <div className="ph-top"><b>My ticket</b><span className="st s-good"><Icon name="check" />Confirmed</span></div>
              <div className="ph-route"><div><b>CUB</b><small>8:00 AM</small></div><Icon name="bus" /><div><b>DAG</b><small>12:00 PM</small></div></div>
              <div className="ph-qr"><QrCode text="FS-2026-DEMO" size={150} /></div>
              <div className="ph-meta"><span>Seat <b>3A, 3B</b></span><span>Bus <b>{state.buses[3]?.bodyNo}</b></span><span>Gate <b>2</b></span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MoreServices({ home }) {
  return (
    <section className="hsec">
      <div className="wrap">
        <div className="sec-h"><div><span className="kicker">Beyond tickets</span><h2>{home.servicesTitle}</h2></div></div>
        <div className="svc3">
          <Link to="/rent-a-bus" className="svc s1"><Icon name="users" size={30} /><h3>Rent a bus</h3><p>Family outings, company events, school trips and pilgrimages. Get a quotation online in minutes.</p><span>Get a quotation <Icon name="right" /></span></Link>
          <Link to="/parcels" className="svc s2"><Icon name="package" size={30} /><h3>Parcels & cargo</h3><p>Send boxes and documents on our buses. The receiver gets an SMS on arrival; track it with the waybill number.</p><span>Track or get a rate <Icon name="right" /></span></Link>
          <Link to="/help" className="svc s3"><Icon name="building" size={30} /><h3>Corporate travel</h3><p>Company accounts with monthly billing, bulk bookings and travel reports for your employees.</p><span>Talk to us <Icon name="right" /></span></Link>
        </div>
      </div>
    </section>
  );
}

function Reviews({ home }) {
  const { state } = useStore();
  const list = state.reviews.filter((r) => r.approved).slice(0, 3);
  if (!list.length) return null;
  return (
    <section className="hsec soft">
      <div className="wrap">
        <div className="sec-h"><div><span className="kicker">Reviews</span><h2>{home.reviewsTitle}</h2></div></div>
        <div className="reviews">{list.map((r) => <figure key={r.id}><Stars n={r.rating} /><blockquote>“{r.text}”</blockquote><figcaption><b>{r.name}</b><span>{r.where}</span></figcaption></figure>)}</div>
      </div>
    </section>
  );
}

function News({ home }) {
  const { state } = useStore();
  const [open, setOpen] = useState(0);
  const posts = [...state.posts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return (
    <section className="hsec">
      <div className="wrap news-faq">
        <div>
          <div className="sec-h"><div><span className="kicker">Updates</span><h2>{home.newsTitle}</h2></div><Link to="/news" className="btn btn-ghost btn-sm">All news</Link></div>
          <div className="news-list">
            {posts.map((p) => (
              <Link to={`/news/${p.id}`} key={p.id} className="news-item">
                <span className={`ntag ${p.type}`}>{p.type === 'advisory' ? 'Advisory' : 'News'}</span>
                <b>{p.title}</b><span className="mini">{fmtDate(p.date, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="sec-h"><div><span className="kicker">Help</span><h2>Frequently asked</h2></div><Link to="/help" className="btn btn-ghost btn-sm">Help center</Link></div>
          <div className="faq">
            {state.faqs.slice(0, 5).map((f, i) => (
              <div key={i} className={`fq ${open === i ? 'open' : ''}`}>
                <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>{f.q}<Icon name="down" /></button>
                {open === i && <p>{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home({ preview }) {
  const { state } = useStore();
  const home = preview ? state.homeDraft : state.home;
  const blocks = {
    hero: <Hero home={home} brand={state.brand} />,
    search: <SearchBlock home={home} />,
    advisories: <Advisories />,
    popular: <Popular home={home} />,
    departures: <Departures home={home} />,
    network: <Network home={home} />,
    classes: <Classes home={home} />,
    why: <Why home={home} />,
    app: <AppPromo home={home} />,
    services: <MoreServices home={home} />,
    reviews: <Reviews home={home} />,
    news: <News home={home} />,
  };
  return <div className="home">{home.sections.filter((s) => s.on).map((s) => <div key={s.id} data-sec={s.id}>{blocks[s.id]}</div>)}</div>;
}
