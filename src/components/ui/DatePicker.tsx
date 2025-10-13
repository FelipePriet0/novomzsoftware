import React from 'react';
import { Input } from '@/components/ui/input';
import InputMask from 'react-input-mask';

type DatePickerProps = {
  value?: string; // expected format: YYYY-MM-DD
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  allowTyping?: boolean; // defaults to true; when false, prevents manual typing
  showIcon?: boolean; // show calendar icon button to open picker
  preferNativeFallback?: boolean; // when flatpickr unavailable, use native date input instead of mask
  forceFlatpickr?: boolean; // never use fallback paths; only enhance with flatpickr
};

function injectOnce(tagId: string, el: HTMLElement) {
  const existing = document.getElementById(tagId);
  if (!existing) document.head.appendChild(el);
}

function ensureFlatpickrAssetsLoaded(): Promise<void> {
  return new Promise((resolve) => {
    const w = window as any;
    // If already loaded, resolve immediately
    if (w.flatpickr) {
      resolve();
      return;
    }
    // Inject CSS once
    const cssLink = document.createElement('link');
    cssLink.id = 'flatpickr-css';
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
    injectOnce(cssLink.id, cssLink);
    // Ensure calendar overlays above dialogs
    const styleId = 'flatpickr-zindex-override';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `.flatpickr-calendar { z-index: 99999 !important; }`;
      document.head.appendChild(style);
    }

    const loadLocale = () => {
      // Load Portuguese locale
      if (w.flatpickr?.l10ns?.pt) return resolve();
      const localeScript = document.createElement('script');
      localeScript.id = 'flatpickr-locale-pt';
      localeScript.src = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/pt.js';
      localeScript.async = true;
      localeScript.onload = () => resolve();
      localeScript.onerror = () => resolve();
      if (!document.getElementById(localeScript.id)) document.body.appendChild(localeScript);
      else resolve();
    };

    // Inject script
    const scriptId = 'flatpickr-js';
    if (document.getElementById(scriptId)) {
      const existing = document.getElementById(scriptId) as HTMLScriptElement;
      if ((window as any).flatpickr) loadLocale();
      else existing.addEventListener('load', loadLocale);
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
    script.async = true;
    script.onload = () => loadLocale();
    script.onerror = () => resolve(); // graceful fallback
    document.body.appendChild(script);
  });
}

function parseISODateToDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return undefined;
  // Create date in local time at noon to avoid TZ flips when flatpickr formats
  return new Date(y, (m - 1), d, 12, 0, 0, 0);
}

function formatDateToISO(date: Date | undefined): string {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DatePicker({ value, onChange, placeholder, className, disabled, name, id, min, max, allowTyping = true, showIcon = false, preferNativeFallback = false, forceFlatpickr = false }: DatePickerProps) {
  const fpInputRef = React.useRef<HTMLInputElement | null>(null);
  const nativeInputRef = React.useRef<HTMLInputElement | null>(null);
  const fpInstance = React.useRef<any>(null);
  const [useFlatpickr, setUseFlatpickr] = React.useState(false);
  const ph = placeholder || 'dd/mm/aaaa';

  // Initialize flatpickr if available; fallback to native date input
  const initFlatpickr = React.useCallback(() => {
    const w = window as any;
    if (!fpInputRef.current || !w.flatpickr || disabled) return;
    if (fpInstance.current) {
      try { fpInstance.current.destroy(); } catch {}
      fpInstance.current = null;
    }
    try {
      const mergedClass = `${className ? className + ' ' : ''}text-[#018942] placeholder-[#018942]`;
      const brDefault = (() => {
        if (!value) return undefined;
        const [yy, mm, dd] = value.split('-');
        if (!yy || !mm || !dd) return undefined;
        return `${dd}/${mm}/${yy}`;
      })();
      fpInstance.current = w.flatpickr(fpInputRef.current, {
        locale: w.flatpickr?.l10ns?.pt || undefined,
        dateFormat: 'd/m/Y',
        allowInput: !!allowTyping,
        defaultDate: brDefault,
        minDate: min || undefined,
        maxDate: max || undefined,
        clickOpens: true,
        appendTo: document.body,
        positionElement: fpInputRef.current,
        onChange: (dates: Date[], _dateStr: string, instance: any) => {
          const iso = dates?.[0] ? instance.formatDate(dates[0], 'Y-m-d') : '';
          onChange?.(iso);
        },
        onReady: (_dates: Date[], _str: string, inst: any) => {
          try { if (fpInputRef.current) fpInputRef.current.placeholder = ph; } catch {}
          if (!allowTyping) {
            try { fpInputRef.current?.setAttribute('readonly', 'true'); } catch {}
          }
          // Ensure opening on click/focus of the input
          try {
            const open = () => { try { inst.open(); } catch {} };
            fpInputRef.current?.addEventListener('click', open);
            fpInputRef.current?.addEventListener('focus', open);
          } catch {}
        }
      });
    } catch {}
  }, [allowTyping, className, disabled, max, min, onChange, ph, value]);

  React.useEffect(() => {
    let mounted = true;
    if (disabled) return () => { mounted = false; };
    ensureFlatpickrAssetsLoaded().then(() => {
      if (!mounted) return;
      const w = window as any;
      if (!w.flatpickr) {
        setUseFlatpickr(false);
        return;
      }
      setUseFlatpickr(true);
      requestAnimationFrame(() => initFlatpickr());
    });
    return () => {
      mounted = false;
      if (fpInstance.current) {
        try { fpInstance.current.destroy(); } catch {}
        fpInstance.current = null;
      }
    };
  }, [disabled, initFlatpickr]);

  // Keep instance in sync when value changes externally
  React.useEffect(() => {
    if (!fpInstance.current) return;
    try {
      if (value) {
        const [yy, mm, dd] = value.split('-');
        const br = (yy && mm && dd) ? `${dd}/${mm}/${yy}` : '';
        if (br) fpInstance.current.setDate(br, true, 'd/m/Y');
      } else fpInstance.current.clear();
    } catch {}
  }, [value]);

  // Fallback handler (native date input)
  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };

  // If disabled, render a simple read-only input with the ISO value
  if (disabled) {
    const mergedClass = `${className ? className + ' ' : ''}text-[#018942] placeholder-[#018942]`;
    const displayBR = (() => {
      if (!value) return '';
      const d = parseISODateToDate(value);
      if (!d) return value || '';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear());
      return `${dd}/${mm}/${yy}`;
    })();
    return (
      <Input
        ref={nativeInputRef}
        type="text"
        className={mergedClass}
        value={displayBR}
        placeholder={placeholder}
        disabled
        readOnly
        name={name}
        id={id}
      />
    );
  }

  // Conditional render to avoid double fields: use native date OR flatpickr text, not both.
  if (!forceFlatpickr && !useFlatpickr && preferNativeFallback) {
    const mergedClass = `${className ? className + ' ' : ''}text-[#018942] placeholder-[#018942]`;
    const handleIconClick = () => {
      try {
        nativeInputRef.current?.focus();
        // @ts-ignore
        if (nativeInputRef.current && typeof (nativeInputRef.current as any).showPicker === 'function') {
          // @ts-ignore
          (nativeInputRef.current as any).showPicker();
        }
      } catch {}
    };
    const onKeyBlock = (e: any) => { if (!allowTyping) e.preventDefault(); };
    return (
      <div className="relative">
        <Input
          ref={nativeInputRef}
          type="date"
          className={mergedClass + (showIcon ? ' pr-10' : '')}
          value={value || ''}
          onChange={handleNativeChange}
          placeholder={placeholder}
          name={name}
          id={id}
          min={min}
          max={max}
          readOnly={!allowTyping}
          onKeyDown={onKeyBlock}
          onBeforeInput={onKeyBlock as any}
        />
        {showIcon && (
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#018942]" onClick={handleIconClick} aria-label="Abrir calendário">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </button>
        )}
      </div>
    );
  }

  if (!forceFlatpickr && !useFlatpickr) {
    const mergedClass = `${className ? className + ' ' : ''}text-[#018942] placeholder-[#018942]`;
    const displayBR = (() => {
      if (!value) return '';
      const d = parseISODateToDate(value);
      if (!d) return '';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear());
      return `${dd}/${mm}/${yy}`;
    })();
    const toISO = (v: string) => {
      const digits = v.replace(/\D+/g, '');
      if (digits.length !== 8) return '';
      const dd = parseInt(digits.slice(0,2));
      const mm = parseInt(digits.slice(2,4));
      const yy = parseInt(digits.slice(4,8));
      if (!dd || !mm || !yy) return '';
      const dt = new Date(yy, mm-1, dd, 12, 0, 0, 0);
      if (isNaN(dt.getTime())) return '';
      return formatDateToISO(dt);
    };
    return (
      <div className="relative">
      <InputMask
        mask="99/99/9999"
        value={displayBR}
        onChange={(e) => {
          const iso = toISO(e.target.value);
          onChange?.(iso);
        }}
        maskChar={null}
      >
        {(inputProps: any) => (
          <Input
            {...inputProps}
            ref={nativeInputRef}
            type="text"
            className={mergedClass + (showIcon ? ' pr-10' : '')}
            placeholder={ph}
            name={name}
            id={id}
          />
        )}
      </InputMask>
      {showIcon && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#018942]">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        </span>
      )}
      </div>
    );
  }
  // flatpickr path
  const mergedClass = `${className ? className + ' ' : ''}text-[#018942] placeholder-[#018942]`;
  const handleIconClick = () => {
    try {
      if (fpInstance.current) fpInstance.current.open();
      else {
        // Lazy init if not initialized yet
        ensureFlatpickrAssetsLoaded().then(() => {
          setUseFlatpickr(true);
          requestAnimationFrame(() => { initFlatpickr(); fpInstance.current?.open(); });
        });
      }
    } catch {}
  };
  return (
    <div className="relative">
      <Input
        ref={fpInputRef}
        type="text"
        className={mergedClass + (showIcon ? ' pr-10' : '')}
        defaultValue={value ? (() => { const [yy, mm, dd] = value.split('-'); return (yy && mm && dd) ? `${dd}/${mm}/${yy}` : ''; })() : ''}
        placeholder={ph}
        name={name}
        id={id}
        readOnly={!allowTyping}
      />
      {showIcon && (
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#018942]" onClick={handleIconClick} aria-label="Abrir calendário">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        </button>
      )}
    </div>
  );
}

export default DatePicker;
