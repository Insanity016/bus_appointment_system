import { useEffect, useRef } from 'react';
import Icon from './lib/icons.jsx';
import { readPhoto, useStore } from './lib/store.jsx';

/** Clinic logo from the CMS, or a "Your logo" placeholder until one is uploaded. */
export function Logo({ brand, className = '', style }) {
  if (brand.logo) return <span className={`logo ${className}`} style={style}><img src={brand.logo} alt={`${brand.name} logo`} /></span>;
  return <span className={`logo ph-logo ${className}`} style={style} aria-label="Logo placeholder">YOUR<br />LOGO</span>;
}

export function BrandName({ brand, light }) {
  const [a, b] = brand.name.split('|');
  return (
    <span className="brand-txt">
      <b style={light ? { color: '#fff' } : undefined}>{b !== undefined ? <>{a.trim()} <span>|</span> {b.trim()}</> : brand.name}</b>
      <small style={light ? { color: '#c8d3f0' } : undefined}>{brand.sub}</small>
    </span>
  );
}

export function Stars({ n = 5 }) {
  return (
    <span className="stars" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" className={i > n ? 'off' : ''} />)}
    </span>
  );
}

export function Toggle({ on, onChange, disabled, label }) {
  return <button type="button" role="switch" aria-checked={!!on} aria-label={label} disabled={disabled} className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

export function Modal({ title, onClose, children, footer, width }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector('input, select, textarea, button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <div className="modal-h"><h3>{title}</h3><button type="button" className="btn-a b-ghost b-xs" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

/** Photo picker used everywhere in the CMS: upload, replace or remove. */
export function PhotoInput({ value, onChange, label = 'Photo', hint, small, allowRemove = true }) {
  const { toast } = useStore();
  const input = useRef(null);
  const pick = async (file) => {
    try {
      onChange(await readPhoto(file));
      toast('Photo uploaded and resized automatically.');
    } catch (e) {
      toast(e.message, 'err');
    }
  };
  return (
    <div className="field">
      <span>{label}</span>
      <div
        className={`drop ${small ? 'small' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) pick(e.dataTransfer.files[0]); }}
      >
        {value ? <img className="th" src={value} alt="" /> : <span className="th"><Icon name="image" size={26} /></span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mini">{hint || 'Drag a photo here or choose one. JPG, PNG or WebP; resized automatically.'}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-a b-ghost" onClick={() => input.current.click()}><Icon name="upload" />{value ? 'Replace' : 'Upload'}</button>
            {value && allowRemove && <button type="button" className="btn-a b-ghost" onClick={() => onChange(null)}><Icon name="trash" />Remove</button>}
          </div>
        </div>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files[0]) pick(e.target.files[0]); e.target.value = ''; }} />
      </div>
    </div>
  );
}

export function Empty({ icon = 'search', children }) {
  return <div className="empty"><Icon name={icon} />{children}</div>;
}

export function StatusPill({ status, map }) {
  const s = map[status] || { label: status, cls: 's-mute', icon: 'clock' };
  return <span className={`st ${s.cls}`}><Icon name={s.icon} />{s.label}</span>;
}
