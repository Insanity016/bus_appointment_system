import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { DEMO_MFA, DEMO_PASSWORD, ROLES } from '../lib/data.js';
import { audit, useStore } from '../lib/store.jsx';
import { checkMfa, ensureCanAttempt, lockState, mfaRequired, recordFailure } from '../lib/auth.js';
import { BrandLockup, BusArt } from '../shared.jsx';
import { maintenanceActive } from '../site/util.js';

export default function AdminLogin() {
  const { state, update, reset, toast } = useStore();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState('password');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 15000); return () => clearInterval(t); }, []);

  if (state.staffSession) return <Navigate to="/admin" replace />;
  const acc = state.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  const mntAll = maintenanceActive(state) && state.settings.system.maintenance.scope === 'all';

  const finish = (a) => {
    update((d) => {
      const x = d.accounts.find((y) => y.id === a.id);
      x.failed = 0; x.lastFailedAt = null; x.lastLoginAt = new Date().toISOString();
      d.staffSession = { id: x.id, email: x.email, name: x.name, role: x.role, branches: x.branches, at: new Date().toISOString(), lastActive: new Date().toISOString() };
      audit(d, 'auth.login.success', `${x.email} signed in`, { actor: x.name });
    });
    nav('/admin');
  };

  const submitPassword = (e) => {
    e.preventDefault();
    setErr('');
    if (!acc) { setErr('The credentials you entered are incorrect.'); return; }
    if (mntAll && acc.role !== 'super_admin') { setErr('The system is under maintenance. Only Super Admins can sign in right now.'); return; }
    const msg = update((d) => {
      const x = d.accounts.find((y) => y.id === acc.id);
      return ensureCanAttempt(d, x) || (password !== x.password ? recordFailure(d, x, 'password') : null);
    });
    if (msg) { setErr(msg); return; }
    if (mfaRequired(state)) { setStep('mfa'); setCode(''); } else finish(acc);
  };

  const submitMfa = (e) => {
    e.preventDefault();
    const result = update((d) => {
      const x = d.accounts.find((y) => y.id === acc.id);
      const msg = ensureCanAttempt(d, x) || (!checkMfa(code) ? recordFailure(d, x, 'mfa') : null);
      return { msg, locked: lockState(x) !== 'active' };
    });
    if (result.msg) { setErr(result.msg); if (result.locked) setStep('password'); return; }
    finish(acc);
  };

  return (
    <div className="login">
      <div className="art">
        <Link to="/" className="brand"><BrandLockup brand={state.brand} light /></Link>
        <div>
          <h2>Operations <span className="accent">portal</span></h2>
          <p>Dispatch, ticketing, boarding, parcels, fleet and the website CMS, protected by login lockout, authenticator codes and an audit trail.</p>
        </div>
        <span className="mini" style={{ color: '#8FA0CC' }}>Prototype · sample data</span>
        <div className="login-art"><BusArt mode="night" brand={state.brand} /></div>
      </div>
      <div className="form">
        <div>
          <h1>{step === 'mfa' ? 'Authenticator code' : 'Staff sign-in'}</h1>
          <p className="sub" style={{ marginBottom: 18 }}>{step === 'mfa' ? `Enter the 6-digit code from the authenticator app for ${acc?.email}.` : 'Sign in with your work email and password.'}</p>
          {mntAll && <div className="error" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}><Icon name="wrench" />Maintenance mode: only Super Admins can sign in.</div>}
          {err && <div className="error"><Icon name={/flagged/i.test(err) ? 'shield' : /locked/i.test(err) ? 'lock' : 'alert'} />{err}</div>}
          {step === 'password' ? (
            <form onSubmit={submitPassword}>
              <label className="field"><span>Email</span><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
              <label className="field"><span>Password</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
              <button className="btn btn-blue btn-block" type="submit"><Icon name="lock" />Sign in</button>
            </form>
          ) : (
            <form onSubmit={submitMfa}>
              <label className="field"><span>6-digit code</span><input className="input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={6} autoFocus style={{ letterSpacing: '.4em', fontSize: 20, fontWeight: 700, textAlign: 'center' }} /></label>
              <button className="btn btn-blue btn-block" type="submit"><Icon name="shield" />Verify</button>
              <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => { setStep('password'); setErr(''); }}>Back</button>
            </form>
          )}

          <div className="demo-box">
            <b style={{ color: 'var(--ink)' }}>Demo accounts</b> (password <code>{DEMO_PASSWORD}</code>, authenticator code <code>{DEMO_MFA}</code>):
            <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
              {state.accounts.map((a) => {
                const ls = lockState(a);
                return (
                  <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); setStep('password'); setErr(''); }}>{a.email}</button>
                    <span>{ROLES[a.role].label}</span>
                    {ls !== 'active' && <span className={`st ${ls === 'flagged' ? 's-bad' : 's-warn'}`}><Icon name="lock" />{ls === 'flagged' ? 'Flagged' : 'Locked'}</span>}
                  </div>
                );
              })}
            </div>
            <p style={{ marginTop: 8 }}>Try a wrong password 3 times to see the lockout, and again after the lock to see the suspicious-activity flag. A higher-ranking account unlocks it in Staff & roles. Drivers and conductors use the <Link to="/app/crew">crew app</Link>.</p>
            <button type="button" style={{ marginTop: 6 }} onClick={() => { reset(); setErr(''); setStep('password'); toast('Demo data reset to the starting sample.'); }}>Reset all demo data</button>
          </div>
          <p style={{ marginTop: 14, fontSize: 12.5 }}><Link to="/" style={{ color: 'var(--blue)', fontWeight: 600 }}>← Back to the website</Link></p>
        </div>
      </div>
    </div>
  );
}
