import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { useStore } from '../lib/store.jsx';
import { BrandLockup } from '../shared.jsx';
import { tel } from '../lib/trips.js';
import { maintenanceActive, promoActive } from './util.js';
import Home from './Home.jsx';
import Book from './Book.jsx';
import { ManageLookup, Ticket } from './Ticket.jsx';
import RoutesPage from './RoutesPage.jsx';
import Terminals from './Terminals.jsx';
import { Charter, Parcels, Track } from './Services.jsx';
import { About, Help, NewsDetail, NewsList, NotFound } from './Pages.jsx';
import Account from './Account.jsx';

const NAV = [
  ['/book', 'Book a trip'],
  ['/routes', 'Routes & schedules'],
  ['/terminals', 'Terminals'],
  ['/rent-a-bus', 'Rent a bus'],
  ['/parcels', 'Parcels'],
  ['/news', 'News'],
  ['/help', 'Help'],
];

function Maintenance({ state }) {
  const m = state.settings.system.maintenance;
  const until = m.until ? new Date(m.until).toLocaleString('en-PH', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
  return (
    <div className="mnt">
      <div className="in">
        <BrandLockup brand={state.brand} />
        <div className="wr"><Icon name="wrench" /></div>
        <h1>We're upgrading online booking</h1>
        <p>{m.message}</p>
        {until && <div className="until"><Icon name="clock" />Back online by {until}</div>}
        <div className="ecard">
          <h3><Icon name="phone" />Need help with a trip? Call us</h3>
          <div className="g">
            <div><b>Hotline</b><a href={tel(state.brand.hotline)}><Icon name="phone" />{state.brand.hotline}</a></div>
            {state.terminals.filter((t) => t.on && t.hub).map((t) => (
              <div key={t.id}><b>{t.name} terminal</b><span className="mini">{t.hours}</span></div>
            ))}
          </div>
        </div>
        <p style={{ marginTop: 22, fontSize: 12 }}><Link to="/admin" style={{ color: 'var(--blue)', fontWeight: 700 }}>Staff sign-in</Link></p>
      </div>
    </div>
  );
}

export default function SiteApp() {
  const { state } = useStore();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const preview = params.get('preview') === '1';

  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => { document.title = `${state.brand.name.replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase())} Bus · ${state.brand.tagline}`; }, [state.brand]);

  if (maintenanceActive(state) && !preview) return <Maintenance state={state} />;
  const b = state.brand;

  return (
    <div className="site">
      {preview && <div className="preview-bar"><Icon name="eye" />Preview of unpublished homepage changes · <Link to="/admin/cms/home" style={{ textDecoration: 'underline' }}>Back to the editor</Link></div>}
      <div className="demo">Prototype with sample data. Changes made in the <Link to="/admin">staff portal</Link> are saved only in this browser. Try the <Link to="/app">mobile app</Link>.</div>
      <div className="top"><div className="wrap">
        <a href={tel(b.hotline)}><Icon name="phone" />Hotline {b.hotline}</a>
        <a className="hide" href={`mailto:${b.email}`}><Icon name="message" />{b.email}</a>
        <span className="sp" />
        <Link className="hide" to="/track"><Icon name="nav" />Track my bus</Link>
        <Link className="hide" to="/manage"><Icon name="ticket" />Manage booking</Link>
        <Link to="/account"><Icon name="user" />{state.passengerSession ? state.passengerSession.name.split(' ')[0] : 'Sign in'}</Link>
        <Link className="appchip" to="/app"><Icon name="smartphone" />Get the app</Link>
      </div></div>
      {promoActive(state) && <div className="promo"><div className="wrap"><Icon name="megaphone" />{state.promo.text}{state.promo.link && <Link to={state.promo.link}>Details</Link>}</div></div>}
      <header className="hdr"><div className="wrap">
        <Link to="/" className="brand" aria-label="Home"><BrandLockup brand={b} /></Link>
        <nav className="nav">{NAV.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav>
        <Link to="/book" className="btn btn-gold hdr-btn"><Icon name="ticket" />Book now</Link>
        <button type="button" className="burger" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}><Icon name={menu ? 'x' : 'menu'} /></button>
      </div></header>
      {menu && (
        <div className="mnav">
          {NAV.map(([to, label]) => <Link key={to} to={to}>{label}<Icon name="next" /></Link>)}
          <Link to="/manage">Manage booking<Icon name="next" /></Link>
          <Link to="/track">Track my bus<Icon name="next" /></Link>
          <Link to="/account">My account<Icon name="next" /></Link>
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            <Link to="/book" className="btn btn-gold"><Icon name="ticket" />Book a trip</Link>
            <Link to="/app" className="btn btn-ghost"><Icon name="smartphone" />Get the app</Link>
          </div>
        </div>
      )}

      <main>
        <Routes>
          <Route index element={<Home preview={preview} />} />
          <Route path="book" element={<Book />} />
          <Route path="ticket/:ref" element={<Ticket />} />
          <Route path="manage" element={<ManageLookup />} />
          <Route path="routes" element={<RoutesPage />} />
          <Route path="terminals" element={<Terminals />} />
          <Route path="rent-a-bus" element={<Charter />} />
          <Route path="parcels" element={<Parcels />} />
          <Route path="track" element={<Track />} />
          <Route path="news" element={<NewsList />} />
          <Route path="news/:id" element={<NewsDetail />} />
          <Route path="help" element={<Help />} />
          <Route path="about" element={<About />} />
          <Route path="account" element={<Account />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className="foot">
        <div className="wrap">
          <div className="fgrid">
            <div>
              <BrandLockup brand={b} light />
              <p className="ftag">{b.tagline}</p>
              <p className="fsub">{b.tagline2}</p>
              <div className="social">
                <a href={b.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><Icon name="facebook" /></a>
                <a href={b.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Icon name="image" /></a>
                <a href={b.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok"><Icon name="zap" /></a>
                <a href={b.messenger} target="_blank" rel="noreferrer" aria-label="Messenger"><Icon name="message" /></a>
              </div>
            </div>
            <div>
              <h4>Travel</h4>
              <Link to="/book">Book a trip</Link><Link to="/routes">Routes & schedules</Link><Link to="/manage">Manage booking</Link><Link to="/track">Track my bus</Link><Link to="/app">Mobile app</Link>
            </div>
            <div>
              <h4>Services</h4>
              <Link to="/rent-a-bus">Rent a bus</Link><Link to="/parcels">Parcels & cargo</Link><Link to="/help">Corporate travel</Link><Link to="/news">News & advisories</Link>
            </div>
            <div>
              <h4>Contact</h4>
              <a href={tel(b.hotline)}><Icon name="phone" />{b.hotline}</a>
              <a href={`mailto:${b.email}`}><Icon name="message" />{b.email}</a>
              {state.terminals.filter((t) => t.hub && t.on).slice(0, 1).map((t) => <span key={t.id}><Icon name="pin" />{t.address}</span>)}
              <Link to="/terminals">All terminals</Link>
            </div>
          </div>
          <div className="flinks">
            <span>© {new Date().getFullYear()} Five Star Bus Co., Inc. (prototype)</span>
            <span className="sp" />
            <Link to="/about">About us</Link><Link to="/help">Privacy notice</Link><Link to="/help">Terms of carriage</Link>
            <Link to="/admin">Staff portal</Link>
          </div>
        </div>
      </footer>
      <a className="chatbtn" href={b.messenger} target="_blank" rel="noreferrer" aria-label="Chat with us on Messenger"><Icon name="message" /></a>
    </div>
  );
}
