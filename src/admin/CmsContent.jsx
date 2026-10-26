import { useState } from 'react';
import Icon from '../lib/icons.jsx';
import { audit, useStore } from '../lib/store.jsx';
import { Empty, PhotoInput, Stars, Toggle } from '../components.jsx';
import { BrandLockup } from '../shared.jsx';
import { TopBar } from './AdminApp.jsx';

export function CmsContent({ menu, onSignOut }) {
  const { state, update, toast } = useStore();
  const [tab, setTab] = useState('posts');
  const [sel, setSel] = useState(state.posts[0]?.id);
  const post = state.posts.find((p) => p.id === sel);
  const edP = (fn) => update((d) => fn(d.posts.find((p) => p.id === sel)));
  return (
    <>
      <TopBar crumb="Website CMS" title="News, FAQs & promo" menu={menu} onSignOut={onSignOut}>
        {tab === 'posts' && <button type="button" className="btn-a b-navy" onClick={() => { const id = `post-${Date.now().toString(36)}`; update((d) => { d.posts.unshift({ id, type: 'advisory', pinned: false, title: 'New advisory', date: new Date().toISOString().slice(0, 10), photo: null, body: 'Write the advisory here.' }); audit(d, 'cms.post.created', 'New post'); }); setSel(id); }}><Icon name="plus" />New post</button>}
      </TopBar>
      <div className="pad">
        <div className="tabs">{[['posts', 'News & advisories'], ['faqs', 'FAQs'], ['promo', 'Promo banner']].map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        {tab === 'posts' && (
          <div className="cmsgrid">
            <div className="panel"><div className="secl">{state.posts.map((p) => <div key={p.id} className={`sec ${sel === p.id ? 'on' : ''}`} onClick={() => setSel(p.id)} role="button" tabIndex={0}><div className="grow"><b>{p.title}</b><span className="m">{p.type === 'advisory' ? 'Advisory' : 'News'} · {p.date}{p.pinned ? ' · pinned' : ''}</span></div></div>)}</div></div>
            {post && (
              <div className="panel">
                <div className="row3">
                  <label className="field"><span>Type</span><select className="select" value={post.type} onChange={(e) => edP((p) => { p.type = e.target.value; })}><option value="advisory">Travel advisory</option><option value="news">News</option></select></label>
                  <label className="field"><span>Date</span><input className="input" type="date" value={post.date} onChange={(e) => edP((p) => { p.date = e.target.value; })} /></label>
                  <label className="field"><span>Pin on the homepage</span><Toggle on={post.pinned} onChange={(v) => edP((p) => { p.pinned = v; })} label="Pinned" /></label>
                </div>
                <label className="field"><span>Title</span><input className="input" value={post.title} onChange={(e) => edP((p) => { p.title = e.target.value; })} /></label>
                <label className="field"><span>Text (blank line = new paragraph)</span><textarea className="textarea" style={{ minHeight: 180 }} value={post.body} onChange={(e) => edP((p) => { p.body = e.target.value; })} /></label>
                <PhotoInput value={post.photo} onChange={(v) => edP((p) => { p.photo = v; })} label="Cover photo (optional)" />
                <div className="bar2"><a className="btn-a b-ghost" href={`/news/${post.id}`} target="_blank" rel="noreferrer"><Icon name="eye" />View</a><span className="sp" /><button type="button" className="btn-a b-ghost" onClick={() => { update((d) => { d.posts = d.posts.filter((p) => p.id !== sel); audit(d, 'cms.post.deleted', `Post "${post.title}" deleted`); }); setSel(state.posts[0]?.id); toast('Deleted.'); }}><Icon name="trash" />Delete</button><button type="button" className="btn-a b-gold" onClick={() => { update((d) => audit(d, 'cms.post.published', `Post "${post.title}" saved`)); toast('Saved. It is live on the website.'); }}>Save</button></div>
              </div>
            )}
          </div>
        )}
        {tab === 'faqs' && (
          <div className="panel list-edit" style={{ maxWidth: 820 }}>
            {state.faqs.map((f, i) => (
              <div className="li" key={i}>
                <div className="li-h"><b>Question {i + 1}</b><button type="button" className="btn-a b-ghost b-xs" disabled={!i} onClick={() => update((d) => { [d.faqs[i - 1], d.faqs[i]] = [d.faqs[i], d.faqs[i - 1]]; })} aria-label="Move up"><Icon name="up" /></button><button type="button" className="btn-a b-ghost b-xs" onClick={() => update((d) => { d.faqs.splice(i, 1); })} aria-label="Delete"><Icon name="trash" /></button></div>
                <input className="input" value={f.q} onChange={(e) => update((d) => { d.faqs[i].q = e.target.value; })} aria-label="Question" style={{ marginBottom: 8 }} />
                <textarea className="textarea" value={f.a} onChange={(e) => update((d) => { d.faqs[i].a = e.target.value; })} aria-label="Answer" />
              </div>
            ))}
            <button type="button" className="btn-a b-ghost" onClick={() => update((d) => { d.faqs.push({ q: 'New question?', a: 'Answer.' }); })}><Icon name="plus" />Add question</button>
          </div>
        )}
        {tab === 'promo' && (
          <div className="panel" style={{ maxWidth: 720 }}>
            <div className="srow"><div><b>Show the promo banner</b><span className="d">The gold strip under the top bar on every page.</span></div><Toggle on={state.promo.on} onChange={(v) => update((d) => { d.promo.on = v; audit(d, 'cms.promo', `Promo banner ${v ? 'on' : 'off'}`); })} label="Promo on" /></div>
            <label className="field" style={{ marginTop: 12 }}><span>Text</span><input className="input" value={state.promo.text} onChange={(e) => update((d) => { d.promo.text = e.target.value; })} /></label>
            <label className="field"><span>Link (optional)</span><input className="input" value={state.promo.link} onChange={(e) => update((d) => { d.promo.link = e.target.value; })} placeholder="/news/undas-2026" /></label>
            <div className="row2"><label className="field"><span>Show from</span><input className="input" type="date" value={state.promo.start} onChange={(e) => update((d) => { d.promo.start = e.target.value; })} /></label><label className="field"><span>Until</span><input className="input" type="date" value={state.promo.end} onChange={(e) => update((d) => { d.promo.end = e.target.value; })} /></label></div>
            <p className="mini">Leave the dates empty to show it until switched off. Ended promos hide themselves.</p>
          </div>
        )}
      </div>
    </>
  );
}

export function CmsReviews({ menu, onSignOut }) {
  const { state, update } = useStore();
  return (
    <>
      <TopBar crumb="Website CMS" title="Reviews" menu={menu} onSignOut={onSignOut} />
      <div className="pad">
        <div className="panel">
          {state.reviews.map((r) => (
            <div className="al" key={r.id}>
              <div style={{ flex: 1 }}><Stars n={r.rating} /><b style={{ marginTop: 4 }}>“{r.text}”</b><span>{r.name} · {r.where}</span></div>
              <span className={`st ${r.approved ? 's-good' : 's-warn'}`}>{r.approved ? 'Shown' : 'Waiting'}</span>
              <Toggle on={r.approved} onChange={(v) => update((d) => { d.reviews.find((x) => x.id === r.id).approved = v; audit(d, 'cms.review', `Review ${v ? 'approved' : 'hidden'}`); })} label="Show review" />
            </div>
          ))}
          <p className="mini" style={{ marginTop: 10 }}>After each trip, passengers can get an SMS link to rate the trip, driver and bus (Phase 3). Reviews show only after approval; 4–5 star reviewers can be invited to post on Google and Facebook.</p>
        </div>
      </div>
    </>
  );
}

export function CmsBranding({ menu, onSignOut }) {
  const { state, update } = useStore();
  const b = state.brand;
  const set = (k, v) => update((d) => { d.brand[k] = v; });
  const save = (what) => update((d) => audit(d, 'cms.branding', `Branding: ${what}`));
  const f = (label, k, area) => <label className="field"><span>{label}</span>{area ? <textarea className="textarea" value={b[k]} onChange={(e) => set(k, e.target.value)} onBlur={() => save(label)} /> : <input className="input" value={b[k]} onChange={(e) => set(k, e.target.value)} onBlur={() => save(label)} />}</label>;
  return (
    <>
      <TopBar crumb="Website CMS" title="Branding & logo" menu={menu} onSignOut={onSignOut} />
      <div className="pad">
        <div className="grid" style={{ gridTemplateColumns: '1.3fr 1fr', marginTop: 0 }}>
          <div className="panel">
            <PhotoInput value={b.logo} onChange={(v) => { set('logo', v); save('logo changed'); }} label="Logo" hint="Square PNG or SVG with a transparent background works best. Until uploaded, a star mark is shown." small />
            <div className="row2">{f('Name', 'name')}{f('Second line', 'sub')}</div>
            <div className="row2">
              <label className="field"><span>Main colour</span><input className="input" type="color" value={b.primary} onChange={(e) => set('primary', e.target.value)} onBlur={() => save('main colour')} style={{ height: 42, padding: 4 }} /></label>
              <label className="field"><span>Accent colour</span><input className="input" type="color" value={b.accent} onChange={(e) => set('accent', e.target.value)} onBlur={() => save('accent colour')} style={{ height: 42, padding: 4 }} /></label>
            </div>
            {f('Tagline', 'tagline')}{f('Slogan', 'tagline2')}{f('About us', 'about', true)}{f('Our promise', 'mission', true)}
            <div className="row2">{f('Hotline', 'hotline')}{f('Email', 'email')}{f('Facebook', 'facebook')}{f('Messenger link', 'messenger')}{f('Instagram', 'instagram')}{f('TikTok', 'tiktok')}</div>
          </div>
          <div className="panel">
            <div className="ph-row"><h3>Preview</h3></div>
            <div style={{ background: 'var(--blue)', borderRadius: 16, padding: 20 }}><BrandLockup brand={b} light /><p style={{ color: 'var(--gold)', fontWeight: 800, marginTop: 12 }}>{b.tagline}</p><p style={{ color: '#C9D5F0', fontSize: 13 }}>{b.tagline2}</p></div>
            <div style={{ padding: 20, border: '1px solid var(--line)', borderRadius: 16, marginTop: 12 }}><BrandLockup brand={b} /><div style={{ display: 'flex', gap: 8, marginTop: 14 }}><span className="btn btn-gold btn-sm">Book now</span><span className="btn btn-blue btn-sm">Routes</span></div></div>
            <p className="mini" style={{ marginTop: 10 }}>Colours apply to the website, app, staff portal, e-tickets and departure screens immediately.</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function Inquiries({ menu, onSignOut }) {
  const { state, update, toast } = useStore();
  return (
    <>
      <TopBar crumb="Website CMS" title="Inquiries" menu={menu} onSignOut={onSignOut} />
      <div className="pad">
        <div className="panel">
          {state.inquiries.map((q) => (
            <div className="al" key={q.id}>
              <span className="ico" style={{ background: 'var(--blue-50)', color: 'var(--blue)' }}><Icon name="message" /></span>
              <div style={{ flex: 1 }}><b>{q.topic} · {q.name}</b><span>{q.message}</span><div className="mini">{q.mobile}{q.email ? ` · ${q.email}` : ''} · {new Date(q.at).toLocaleString('en-PH')}</div></div>
              {q.status === 'new' ? <button type="button" className="btn-a b-navy b-xs" onClick={() => { update((d) => { d.inquiries.find((x) => x.id === q.id).status = 'replied'; audit(d, 'inquiry.replied', `Inquiry from ${q.name} marked replied`); }); toast('Marked as replied.'); }}>Mark replied</button> : <span className="st s-good">Replied</span>}
            </div>
          ))}
          {!state.inquiries.length && <Empty icon="message">No inquiries.</Empty>}
        </div>
      </div>
    </>
  );
}

export function Messages({ menu, onSignOut }) {
  const { state } = useStore();
  const on = state.settings.integrations.semaphore.enabled;
  return (
    <>
      <TopBar crumb="Administration" title="SMS outbox" menu={menu} onSignOut={onSignOut}>
        <span className={`st ${on ? 's-good' : 's-warn'}`}><Icon name={on ? 'check' : 'alert'} />Semaphore {on ? 'connected' : 'not connected · messages are simulated'}</span>
      </TopBar>
      <div className="pad">
        <div className="panel">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>When</th><th>To</th><th>Message</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>{state.sms.map((m, i) => <tr key={i}><td className="mini" style={{ whiteSpace: 'nowrap' }}>{new Date(m.at).toLocaleString('en-PH')}</td><td>{m.to || '—'}</td><td>{m.kind === 'otp' ? m.text.replace(/\d{4,8}/, '••••••') : m.text}</td><td>{m.kind === 'otp' ? <span className="st s-info">OTP · priority</span> : <span className="st s-mute">Service</span>}</td><td><span className={`st ${m.status === 'sent' ? 's-good' : 's-mute'}`}>{m.status}</span></td></tr>)}</tbody>
            </table>
            {!state.sms.length && <Empty icon="send">No messages yet. Book a ticket, delay a trip or accept a parcel to see the SMS here.</Empty>}
          </div>
          <p className="mini" style={{ marginTop: 10 }}>One-time codes are masked here. Wording is set in Settings → Notifications & templates; quiet hours apply to promotional messages only.</p>
        </div>
      </div>
    </>
  );
}
