import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { ROLES } from '../lib/data.js';
import { audit, setting, useStore } from '../lib/store.jsx';
import { can } from '../lib/auth.js';
import { Mark } from '../shared.jsx';
import { maintenanceActive } from '../site/util.js';
import Dashboard from './Dashboard.jsx';
import Dispatch from './Dispatch.jsx';
import Bookings, { Passengers } from './Bookings.jsx';
import Counter from './Counter.jsx';
import Boarding from './Boarding.jsx';
import Parcels from './Parcels.jsx';
import { Crew, Fleet, Remittance } from './Fleet.jsx';
import { Charters, LiveMap, Reports } from './Phase3.jsx';
import CmsHome from './CmsHome.jsx';
import { CmsClasses, CmsRoutes, CmsTerminals } from './CmsLists.jsx';
import { CmsBranding, CmsContent, CmsReviews, Inquiries, Messages } from './CmsContent.jsx';
import Settings from './Settings.jsx';
import Staff from './Staff.jsx';
import Audit from './Audit.jsx';

// [path, label, icon, permission, phase]
const MENU = [
  ['Overview', [['/admin', 'Dashboard', 'grid', 'dashboard']]],
  ['Operations', [
    ['/admin/dispatch', 'Dispatch board', 'bus', 'trips'],
    ['/admin/boarding', 'Boarding & manifest', 'scan', 'boarding'],
    ['/admin/live', 'Live bus map', 'nav', 'tracking', 3],
  ]],
  ['Ticketing', [
    ['/admin/counter', 'Ticket counter', 'ticket', 'counter'],
    ['/admin/bookings', 'Bookings', 'list', 'bookings'],
    ['/admin/passengers', 'Passengers', 'users', 'passengers'],
  ]],
  ['Services', [
    ['/admin/parcels', 'Parcels & cargo', 'package', 'parcels', 2],
    ['/admin/charters', 'Bus rental (charter)', 'building', 'charters', 3],
  ]],
  ['Fleet & crew', [
    ['/admin/fleet', 'Buses & maintenance', 'tool', 'fleet', 2],
    ['/admin/crew', 'Drivers & conductors', 'steering', 'crew', 2],
    ['/admin/remittance', 'Cash remittance', 'coins', 'remittance', 2],
  ]],
  ['Insights', [['/admin/reports', 'Report builder', 'chart', 'reports', 3]]],
  ['Website CMS', [
    ['/admin/cms/home', 'Homepage', 'home', 'cms'],
    ['/admin/cms/routes', 'Routes, fares & schedules', 'route', 'cms'],
    ['/admin/cms/terminals', 'Terminals', 'pin', 'cms'],
    ['/admin/cms/classes', 'Bus classes', 'seat', 'cms'],
    ['/admin/cms/content', 'News, FAQs & promo', 'megaphone', 'cms'],
    ['/admin/cms/reviews', 'Reviews', 'star', 'cms'],
    ['/admin/cms/branding', 'Branding & logo', 'palette', 'cms'],
    ['/admin/inquiries', 'Inquiries', 'message', 'inquiries'],
  ]],
  ['Administration', [
    ['/admin/staff', 'Staff & roles', 'users', 'staff'],
    ['/admin/settings', 'Settings', 'gear', 'settings'],
    ['/admin/messages', 'SMS outbox', 'send', 'settings'],
    ['/admin/audit', 'Audit logs', 'history', 'audit'],
  ]],
];

export default function AdminApp() {
  const { state, update, toast } = useStore();
  const session = state.staffSession;
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Idle timeout from Settings → Security → Sessions (shorter on the ticket counter).
  useEffect(() => {
    if (!session) return undefined;
    const key = session.role === 'ticketing' || session.role === 'cashier' ? 'counterIdleMinutes' : 'staffIdleMinutes';
    const idle = Number(setting(state, `security.sessions.${key}`)) * 60000;
    const t = setInterval(() => {
      if (Date.now() - new Date(session.lastActive).getTime() > idle) {
        update((d) => { audit(d, 'auth.session.expired', `${session.email} signed out after inactivity`, { actor: 'System' }); d.staffSession = null; });
        toast('You were signed out after a period of inactivity.', 'err');
      }
    }, 30000);
    return () => clearInterval(t);
  }, [session, state, update, toast]);

  useEffect(() => {
    setOpen(false);
    if (session) update((d) => { if (d.staffSession) d.staffSession.lastActive = new Date().toISOString(); });
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return <Navigate to="/admin/login" replace state={{ from: pathname }} />;
  const me = state.accounts.find((a) => a.email === session.email);
  if (!me || me.status === 'flagged') return <Navigate to="/admin/login" replace />;
  const mnt = maintenanceActive(state);
  if (mnt && state.settings.system.maintenance.scope === 'all' && session.role !== 'super_admin') {
    update((d) => { d.staffSession = null; });
    return <Navigate to="/admin/login" replace />;
  }

  const counts = {
    '/admin/inquiries': state.inquiries.filter((i) => i.status === 'new').length,
    '/admin/charters': state.charters.filter((c) => c.status === 'new').length,
    '/admin/remittance': state.remittances.filter((r) => r.status === 'pending').length,
  };
  const signOut = () => { update((d) => { audit(d, 'auth.logout', `${session.email} signed out`); d.staffSession = null; }); nav('/admin/login'); };
  const p = { menu: () => setOpen(true), onSignOut: signOut };
  const guard = (perm, el) => (can(session, perm) ? el : <Denied />);
  const first = MENU.flatMap(([, items]) => items).find((i) => can(session, i[3]))?.[0];

  return (
    <div className="app">
      <aside className={`side ${open ? 'open' : ''}`}>
        <Link to="/admin" className="sb-brand"><Mark brand={state.brand} size={38} /><div><b>{state.brand.name}</b><small>OPERATIONS PORTAL</small></div></Link>
        {MENU.map(([group, items]) => {
          const visible = items.filter((i) => can(session, i[3]));
          if (!visible.length) return null;
          return (
            <div key={group}>
              <div className="grp">{group}</div>
              {visible.map(([to, label, icon, , phase]) => (
                <NavLink key={to} to={to} end={to === '/admin'} className="it">
                  <Icon name={icon} />{label}
                  {counts[to] > 0 ? <span className="ct">{counts[to]}</span> : phase ? <span className="ph" title={`Phase ${phase} of the proposal`}>P{phase}</span> : null}
                </NavLink>
              ))}
            </div>
          );
        })}
        <div className="grp">Open</div>
        <a className="it" href="/admin/departures-tv" target="_blank" rel="noreferrer"><Icon name="monitor" />Departures TV</a>
        <a className="it" href="/app/crew" target="_blank" rel="noreferrer"><Icon name="smartphone" />Crew app</a>
        <a className="it" href="/" target="_blank" rel="noreferrer"><Icon name="globe" />Website</a>
      </aside>
      {open && <div className="drawer-bg" style={{ zIndex: 55 }} onClick={() => setOpen(false)} />}
      <div className="main">
        {mnt && <div className="banner-warn"><Icon name="wrench" />Maintenance mode is ON ({state.settings.system.maintenance.scope === 'all' ? 'everyone except Super Admins' : 'website and app only'}). <Link to="/admin/settings/system" style={{ textDecoration: 'underline', fontWeight: 700 }}>Turn it off</Link></div>}
        <Routes>
          <Route index element={can(session, 'dashboard') ? <Dashboard {...p} /> : <Navigate to={first && first !== '/admin' ? first : '/admin/login'} replace />} />
          <Route path="dispatch" element={guard('trips', <Dispatch {...p} />)} />
          <Route path="boarding" element={guard('boarding', <Boarding {...p} />)} />
          <Route path="live" element={guard('tracking', <LiveMap {...p} />)} />
          <Route path="counter" element={guard('counter', <Counter {...p} />)} />
          <Route path="bookings" element={guard('bookings', <Bookings {...p} />)} />
          <Route path="passengers" element={guard('passengers', <Passengers {...p} />)} />
          <Route path="parcels" element={guard('parcels', <Parcels {...p} />)} />
          <Route path="charters" element={guard('charters', <Charters {...p} />)} />
          <Route path="fleet" element={guard('fleet', <Fleet {...p} />)} />
          <Route path="crew" element={guard('crew', <Crew {...p} />)} />
          <Route path="remittance" element={guard('remittance', <Remittance {...p} />)} />
          <Route path="reports" element={guard('reports', <Reports {...p} />)} />
          <Route path="cms/home" element={guard('cms', <CmsHome {...p} />)} />
          <Route path="cms/routes" element={guard('cms', <CmsRoutes {...p} />)} />
          <Route path="cms/terminals" element={guard('cms', <CmsTerminals {...p} />)} />
          <Route path="cms/classes" element={guard('cms', <CmsClasses {...p} />)} />
          <Route path="cms/content" element={guard('cms', <CmsContent {...p} />)} />
          <Route path="cms/reviews" element={guard('cms', <CmsReviews {...p} />)} />
          <Route path="cms/branding" element={guard('cms', <CmsBranding {...p} />)} />
          <Route path="inquiries" element={guard('inquiries', <Inquiries {...p} />)} />
          <Route path="messages" element={guard('settings', <Messages {...p} />)} />
          <Route path="settings" element={guard('settings', <Settings {...p} />)} />
          <Route path="settings/:group" element={guard('settings', <Settings {...p} />)} />
          <Route path="staff" element={guard('staff', <Staff {...p} />)} />
          <Route path="audit" element={guard('audit', <Audit {...p} />)} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </div>
  );
}

/** Top bar used by every admin screen. */
export function TopBar({ crumb, title, children, menu, onSignOut, after }) {
  const { state } = useStore();
  const s = state.staffSession;
  const initials = s.name.replace(/\(.*\)/, '').replace(/–.*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="tb">
      <button type="button" className="m-menu" onClick={menu} aria-label="Menu"><Icon name="menu" /></button>
      <div><div className="crumb">{crumb}</div><h1>{title}</h1></div>
      {after}
      <span className="sp" />
      {children}
      <div className="me" title={`${s.name} · ${ROLES[s.role].label}`}>
        <span className="avatar">{initials}</span>
        <div style={{ lineHeight: 1.2 }} className="me-t"><b style={{ fontSize: 12 }}>{s.name}</b><div className="mini">{ROLES[s.role].label}</div></div>
        <button type="button" className="btn-a b-ghost b-xs" onClick={onSignOut} aria-label="Sign out"><Icon name="logout" /></button>
      </div>
    </div>
  );
}

/** Terminals the staff member works in (hubs for counters/dispatch). */
export function useTerminalScope() {
  const { state } = useStore();
  const s = state.staffSession;
  const all = s.branches === 'all';
  const hubs = state.terminals.filter((t) => t.on && t.hub && (all || s.branches.includes(t.id)));
  const terminals = state.terminals.filter((t) => t.on && (all || s.branches.includes(t.id)));
  return { all, hubs, terminals, inScope: (id) => all || s.branches.includes(id) };
}

function Denied() {
  return <div className="later"><div className="ico"><Icon name="lock" /></div><h2>No access</h2><p className="mini">Your role does not include this screen. A Super Admin can change roles in Staff & roles.</p></div>;
}
