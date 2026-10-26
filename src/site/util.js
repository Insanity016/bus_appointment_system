// Small helpers shared by the public pages.
export function maintenanceActive(state) {
  const m = state.settings.system.maintenance;
  if (!m.enabled) return false;
  if (m.until && new Date(m.until).getTime() < Date.now()) return false;
  return true;
}

export function promoActive(state) {
  const p = state.promo;
  const today = new Date().toISOString().slice(0, 10);
  return p.on && (!p.start || p.start <= today) && (!p.end || p.end >= today);
}

/** Link targets from the CMS: a page (/book), a full web address, or "call" (hotline). */
export function linkProps(link, brand) {
  if (!link) return null;
  if (link === 'call') return { href: `tel:${brand.hotline.replace(/\D/g, '')}` };
  if (/^https?:/.test(link)) return { href: link, target: '_blank', rel: 'noreferrer' };
  return { to: link };
}

export const searchUrl = ({ from, to, date, pax = 1 }) => `/book?from=${from}&to=${to}&date=${date}&pax=${pax}`;
