import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../lib/icons.jsx';
import { SECTION_LABELS } from '../lib/data.js';
import { audit, useStore } from '../lib/store.jsx';
import { Modal, PhotoInput, Toggle } from '../components.jsx';
import { BusArt } from '../shared.jsx';
import { TopBar } from './AdminApp.jsx';

const ICONS = ['flag', 'pin', 'bus', 'clock', 'star', 'users', 'shield', 'qr', 'seat', 'nav', 'ticket', 'heart', 'route', 'wifi', 'gift', 'package'];

export default function CmsHome({ menu, onSignOut }) {
  const { state, update, toast } = useStore();
  const draft = state.homeDraft;
  const [sel, setSel] = useState('hero');
  const [slide, setSlide] = useState(0);
  const [versions, setVersions] = useState(false);
  const dirty = JSON.stringify(state.home) !== JSON.stringify(draft);

  const edit = (fn) => update((d) => fn(d.homeDraft));
  const move = (i, dir) => edit((h) => { const j = i + dir; if (j < 0 || j >= h.sections.length) return; [h.sections[i], h.sections[j]] = [h.sections[j], h.sections[i]]; });
  const publish = () => {
    update((d) => {
      d.homeVersions.unshift({ at: new Date().toISOString(), by: d.staffSession.name, home: d.home });
      d.homeVersions = d.homeVersions.slice(0, 10);
      d.home = structuredClone(d.homeDraft);
      audit(d, 'cms.homepage.published', 'Homepage published');
    });
    toast('Published. The homepage is live.');
  };
  const discard = () => { update((d) => { d.homeDraft = structuredClone(d.home); }); toast('Draft discarded.'); };
  const restore = (v) => { update((d) => { d.homeDraft = structuredClone(v.home); audit(d, 'cms.homepage.restored', `Draft restored from the version of ${new Date(v.at).toLocaleString('en-PH')}`); }); setVersions(false); toast('Version restored into the draft. Publish to make it live.'); };

  const field = (label, value, set, opts = {}) => (
    <label className="field">
      <span>{label}</span>
      {opts.area ? <textarea className="textarea" value={value} onChange={(e) => set(e.target.value)} /> : <input className="input" style={opts.accent ? { color: 'var(--gold-d)', fontWeight: 800 } : undefined} value={value} onChange={(e) => set(e.target.value)} />}
      {opts.hint && <small>{opts.hint}</small>}
    </label>
  );
  const title = (key, label = 'Title') => field(label, draft[key], (v) => edit((h) => { h[key] = v; }));

  const s = draft.hero.slides[Math.min(slide, draft.hero.slides.length - 1)];
  const editors = {
    hero: () => (
      <>
        <div className="slides">
          {draft.hero.slides.map((x, i) => (
            <button type="button" key={x.id} className={`slide ${i === slide ? 'on' : ''}`} onClick={() => setSlide(i)}>
              {x.photo ? <img src={x.photo} alt="" /> : <div className="slide-art"><BusArt mode={x.art} brand={state.brand} /></div>}
              <div className="bd"><b>{x.headline} {x.accent}</b><br /><span className={`st ${x.on ? 's-good' : 's-mute'}`}>{x.on ? 'Shown' : 'Hidden'}</span></div>
            </button>
          ))}
          {draft.hero.slides.length < 5 && <button type="button" className="slide add" onClick={() => { edit((h) => h.hero.slides.push({ id: `s${Date.now()}`, on: true, eyebrow: '', headline: 'New headline', accent: 'in gold.', text: 'Short text for this slide.', photo: null, art: 'day', alt: '', btn1: 'Book a trip', link1: '/book', btn2: '', link2: '' })); setSlide(draft.hero.slides.length); }}><span><Icon name="plus" /> Add slide</span></button>}
        </div>
        {s && (
          <div style={{ marginTop: 16 }}>
            <div className="ph-row"><h3>Slide {slide + 1}</h3><span className="sp" /><span className="mini">Show</span><Toggle on={s.on} onChange={(v) => edit((h) => { h.hero.slides[slide].on = v; })} label="Show slide" />
              {draft.hero.slides.length > 1 && <button type="button" className="btn-a b-ghost b-xs" onClick={() => { edit((h) => { h.hero.slides.splice(slide, 1); }); setSlide(0); }}><Icon name="trash" />Delete</button>}</div>
            <PhotoInput value={s.photo} onChange={(v) => edit((h) => { h.hero.slides[slide].photo = v; })} label="Photo (optional)" hint="Upload a real photo of your buses or terminals. Without a photo, the built-in artwork below is shown." />
            {!s.photo && <label className="field"><span>Built-in artwork</span><div className="chips">{[['day', 'Sunrise'], ['night', 'Night trip'], ['group', 'Two buses']].map(([k, l]) => <button type="button" key={k} className={`chip ${s.art === k ? 'on' : ''}`} onClick={() => edit((h) => { h.hero.slides[slide].art = k; })}>{l}</button>)}</div></label>}
            <div className="row2">
              {field('Small label above the headline', s.eyebrow, (v) => edit((h) => { h.hero.slides[slide].eyebrow = v; }))}
              {field('Photo description (for screen readers and Google)', s.alt, (v) => edit((h) => { h.hero.slides[slide].alt = v; }))}
              {field('Headline', s.headline, (v) => edit((h) => { h.hero.slides[slide].headline = v; }))}
              {field('Headline, second line (gold)', s.accent, (v) => edit((h) => { h.hero.slides[slide].accent = v; }), { accent: true })}
            </div>
            {field('Text', s.text, (v) => edit((h) => { h.hero.slides[slide].text = v; }), { area: true })}
            <div className="row2">
              {field('Main button', s.btn1, (v) => edit((h) => { h.hero.slides[slide].btn1 = v; }))}
              {field('Main button goes to', s.link1, (v) => edit((h) => { h.hero.slides[slide].link1 = v; }), { hint: 'A page like /book or /rent-a-bus, a full web address, or "call" (hotline).' })}
              {field('Second button (optional)', s.btn2, (v) => edit((h) => { h.hero.slides[slide].btn2 = v; }))}
              {field('Second button goes to', s.link2, (v) => edit((h) => { h.hero.slides[slide].link2 = v; }))}
            </div>
            <label className="field" style={{ maxWidth: 260 }}><span>Change slide every</span><div className="num"><input type="number" min="3" max="20" value={draft.hero.autoplay} onChange={(e) => edit((h) => { h.hero.autoplay = Number(e.target.value); })} /><span>seconds</span></div></label>
          </div>
        )}
      </>
    ),
    search: () => <>{title('searchTitle', 'Tab label')}<p className="mini">Which terminals and destinations appear comes from Routes, fares & schedules. Online sales cut-off is in Settings → Ticketing rules.</p></>,
    advisories: () => <><p className="mini" style={{ marginBottom: 10 }}>Shows the two latest travel advisories (pinned first).</p><Link to="/admin/cms/content" className="btn-a b-ghost"><Icon name="megaphone" />Write or pin an advisory</Link></>,
    popular: () => <>{title('popularTitle')}{field('Text', draft.popularText, (v) => edit((h) => { h.popularText = v; }))}<Link to="/admin/cms/routes" className="btn-a b-ghost"><Icon name="route" />Choose featured routes and fares</Link></>,
    departures: () => <>{title('departuresTitle')}<p className="mini">Live from the schedule and the dispatch board (delays, boarding).</p></>,
    network: () => <>{title('networkTitle')}{field('Text', draft.networkText, (v) => edit((h) => { h.networkText = v; }))}<Link to="/admin/cms/terminals" className="btn-a b-ghost"><Icon name="pin" />Edit terminals and map pins</Link></>,
    classes: () => <>{title('classesTitle')}<Link to="/admin/cms/classes" className="btn-a b-ghost"><Icon name="seat" />Edit bus classes and amenities</Link></>,
    why: () => (
      <>
        {title('whyTitle')}
        <span className="label">Counters</span>
        {draft.stats.map((x, i) => (
          <div className="row3" key={i}>
            {field(`Fact ${i + 1}`, x.value, (v) => edit((h) => { h.stats[i].value = v; }))}
            {field('Label', x.label, (v) => edit((h) => { h.stats[i].label = v; }))}
            <label className="field"><span>Icon</span><select className="select" value={x.icon} onChange={(e) => edit((h) => { h.stats[i].icon = e.target.value; })}>{ICONS.map((ic) => <option key={ic}>{ic}</option>)}</select></label>
          </div>
        ))}
        <span className="label">Promises</span>
        {draft.promises.map((x, i) => (
          <div className="row3" key={i}>
            {field('Title', x.title, (v) => edit((h) => { h.promises[i].title = v; }))}
            {field('Text', x.text, (v) => edit((h) => { h.promises[i].text = v; }))}
            <label className="field"><span>Icon</span><select className="select" value={x.icon} onChange={(e) => edit((h) => { h.promises[i].icon = e.target.value; })}>{ICONS.map((ic) => <option key={ic}>{ic}</option>)}</select></label>
          </div>
        ))}
      </>
    ),
    app: () => <>{title('appTitle')}{field('Text', draft.appText, (v) => edit((h) => { h.appText = v; }), { area: true })}</>,
    services: () => <>{title('servicesTitle')}<p className="mini">Cards link to Rent a bus, Parcels and Help.</p></>,
    reviews: () => <>{title('reviewsTitle')}<Link to="/admin/cms/reviews" className="btn-a b-ghost"><Icon name="star" />Approve or hide reviews</Link></>,
    news: () => <>{title('newsTitle')}<Link to="/admin/cms/content" className="btn-a b-ghost"><Icon name="book" />Edit news and FAQs</Link></>,
  };

  return (
    <>
      <TopBar crumb="Website CMS" title="Homepage" menu={menu} onSignOut={onSignOut}
        after={dirty ? <span className="st s-warn" style={{ marginLeft: 6 }}><Icon name="file" />Draft · unpublished changes</span> : <span className="st s-good" style={{ marginLeft: 6 }}><Icon name="check" />Published</span>}>
        <a href="/?preview=1" target="_blank" rel="noreferrer" className="btn-a b-ghost"><Icon name="eye" />Preview</a>
        <button type="button" className="btn-a b-ghost" onClick={() => setVersions(true)}><Icon name="history" />Versions</button>
        {dirty && <button type="button" className="btn-a b-ghost" onClick={discard}>Discard</button>}
        <button type="button" className="btn-a b-gold" disabled={!dirty} onClick={publish}><Icon name="send" />Publish</button>
      </TopBar>
      <div className="pad">
        <div className="cmsgrid">
          <div className="panel">
            <div className="ph-row"><h3>Sections</h3><span className="sub">reorder with the arrows · switch to show or hide</span></div>
            <div className="secl">
              {draft.sections.map((x, i) => (
                <div key={x.id} className={`sec ${sel === x.id ? 'on' : ''} ${x.on ? '' : 'off'}`} onClick={() => setSel(x.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setSel(x.id); }}>
                  <span className="mv" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}><Icon name="up" /></button>
                    <button type="button" onClick={() => move(i, 1)} aria-label="Move down" disabled={i === draft.sections.length - 1}><Icon name="down" /></button>
                  </span>
                  <div className="grow"><b>{SECTION_LABELS[x.id][0]}</b><span className="m">{SECTION_LABELS[x.id][1]}</span></div>
                  <span onClick={(e) => e.stopPropagation()}><Toggle on={x.on} onChange={(v) => edit((h) => { h.sections[i].on = v; })} label={`Show ${SECTION_LABELS[x.id][0]}`} /></span>
                </div>
              ))}
            </div>
            <p className="mini" style={{ marginTop: 10 }}>The top bar, header, footer and promo banner are always present; the promo banner is set in News, FAQs & promo.</p>
          </div>
          <div className="panel">
            <div className="ph-row"><h3>{SECTION_LABELS[sel][0]}</h3><span className="sp" /><span className="sub">Changes are saved as a draft until you publish.</span></div>
            {editors[sel]()}
          </div>
        </div>
      </div>
      {versions && (
        <Modal title="Published versions" onClose={() => setVersions(false)}>
          {state.homeVersions.length ? state.homeVersions.map((v, i) => (
            <div className="al" key={i}><div style={{ flex: 1 }}><b>{new Date(v.at).toLocaleString('en-PH')}</b><span>replaced when {v.by} published</span></div><button type="button" className="btn-a b-ghost b-xs" onClick={() => restore(v)}>Restore</button></div>
          )) : <p className="mini">No earlier versions yet. Each time you publish, the previous homepage is kept here (last 10).</p>}
        </Modal>
      )}
    </>
  );
}
