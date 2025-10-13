// Preload flatpickr core + pt locale early to reduce race conditions
(function preload() {
  if (typeof window === 'undefined') return;
  const w = window as any;
  // If already present, do nothing
  if (w.flatpickr && w.flatpickr?.l10ns?.pt) return;
  // CSS
  if (!document.getElementById('flatpickr-css')) {
    const link = document.createElement('link');
    link.id = 'flatpickr-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
    document.head.appendChild(link);
  }
  // Core
  const coreId = 'flatpickr-js';
  const localeId = 'flatpickr-locale-pt';
  const ensureLocale = () => {
    if (w.flatpickr?.l10ns?.pt || document.getElementById(localeId)) return;
    const s2 = document.createElement('script');
    s2.id = localeId;
    s2.async = true;
    s2.src = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/pt.js';
    document.body.appendChild(s2);
  };
  if (!document.getElementById(coreId)) {
    const s = document.createElement('script');
    s.id = coreId;
    s.async = true;
    s.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
    s.onload = ensureLocale;
    document.body.appendChild(s);
  } else {
    ensureLocale();
  }
})();

