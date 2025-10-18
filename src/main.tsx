import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './lib/flatpickr-preload.ts'

// Suprimir/filtrar logs de console
(() => {
  const dropIfIncludes = (msg: any, patterns: string[]) => {
    try {
      const text = typeof msg === 'string' ? msg : (msg?.toString?.() ?? '');
      return patterns.some(p => text.includes(p));
    } catch { return false; }
  };
  const noops = { log: console.log, warn: console.warn, info: console.info, error: console.error };
  const noisy = [
    'Download the React DevTools',
    'findDOMNode is deprecated',
    'Missing `Description` or `aria-describedby',
  ];
  if (import.meta.env.PROD) {
    console.log = () => {};
    console.warn = () => {};
    console.info = () => {};
  } else {
    console.info = (...args: any[]) => { if (!dropIfIncludes(args[0], noisy)) noops.info(...args); };
    console.warn = (...args: any[]) => { if (!dropIfIncludes(args[0], noisy)) noops.warn(...args); };
    console.error = (...args: any[]) => { if (!dropIfIncludes(args[0], noisy)) noops.error(...args); };
  }
})();

createRoot(document.getElementById("root")!).render(<App />);

// Garantir remoção do splash caso exista
(() => {
  const el = document.getElementById('loading-screen');
  if (el) {
    el.style.opacity = '0';
    el.style.display = 'none';
  }
})();
