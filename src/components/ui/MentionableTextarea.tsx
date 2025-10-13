import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

type ProfileLite = { id: string; full_name: string | null };

interface MentionableTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
}

export function MentionableTextarea({ value, onChange, className, ...rest }: MentionableTextareaProps) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const [anchor, setAnchor] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.from('profiles').select('id, full_name').limit(100);
        if (mounted && data) setProfiles(data as ProfileLite[]);
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles.slice(0, 8);
    return profiles.filter(p => (p.full_name || '').toLowerCase().includes(q)).slice(0, 8);
  }, [profiles, query]);

  const computeAnchor = (startIndex: number) => {
    const el = taRef.current;
    if (!el) return { top: 0, left: 0 };
    // Create a hidden mirror div to measure caret position
    const div = document.createElement('div');
    const style = window.getComputedStyle(el);
    const props = [
      'boxSizing','width','height','overflowY','overflowX','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','paddingTop','paddingRight','paddingBottom','paddingLeft','fontStyle','fontVariant','fontWeight','fontStretch','fontSize','lineHeight','fontFamily','textAlign','whiteSpace','wordWrap'
    ] as const;
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    // copy important styles
    props.forEach((p) => { (div.style as any)[p] = (style as any)[p]; });
    div.style.width = style.width;
    div.style.left = '0px';
    div.style.top = '0px';
    const valueUntil = value.slice(0, startIndex);
    const caretSpan = document.createElement('span');
    caretSpan.textContent = '\u200b'; // zero-width space as marker
    const restText = value.slice(startIndex);
    // Build content
    const escape = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>')
      .replace(/\s/g, '&nbsp;');
    div.innerHTML = escape(valueUntil);
    div.appendChild(caretSpan);
    const rest = document.createElement('span');
    rest.innerHTML = escape(restText);
    div.appendChild(rest);
    el.parentElement?.appendChild(div);
    const rect = caretSpan.getBoundingClientRect();
    const hostRect = el.getBoundingClientRect();
    const top = rect.top - hostRect.top + el.scrollTop;
    const left = rect.left - hostRect.left + el.scrollLeft;
    el.parentElement?.removeChild(div);
    return { top, left };
  };

  const updateMentionState = (nextValue: string, selEnd: number) => {
    // Identify last '@' before cursor that starts a word
    const left = nextValue.slice(0, selEnd);
    const at = left.lastIndexOf('@');
    if (at === -1) {
      setOpen(false);
      setMentionStart(null);
      setQuery('');
      return;
    }
    // Ensure no whitespace between '@' and cursor
    const fragment = left.slice(at + 1);
    if (/\s/.test(fragment)) {
      setOpen(false);
      setMentionStart(null);
      setQuery('');
      return;
    }
    // Ensure '@' is at start or preceded by whitespace/punctuation
    if (at > 0) {
      const prev = left[at - 1];
      if (/[^\s\(\[\{:,]/.test(prev)) {
        setOpen(false);
        setMentionStart(null);
        setQuery('');
        return;
      }
    }
    setMentionStart(at);
    setQuery(fragment);
    setOpen(true);
    setCursor(selEnd);
    // Position menu near the '@'
    const pos = computeAnchor(at);
    setAnchor({ top: pos.top, left: pos.left });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e);
    const el = e.target;
    updateMentionState(el.value, el.selectionEnd || 0);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    updateMentionState(el.value, el.selectionEnd || 0);
  };

  const insertMention = (name: string) => {
    if (mentionStart === null || !taRef.current) return;
    const start = mentionStart;
    const end = cursor;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const insertion = `@${name}`;
    const next = `${before}${insertion} ${after}`;
    const fakeEvent = { target: { value: next, name: rest.name || '' } } as any as React.ChangeEvent<HTMLTextAreaElement>;
    onChange(fakeEvent);
    setOpen(false);
    setMentionStart(null);
    setQuery('');
    // Restore cursor after insertion
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length + 1;
      taRef.current!.selectionStart = pos;
      taRef.current!.selectionEnd = pos;
      taRef.current!.focus();
    });
  };

  const handleScroll = () => {
    if (mentionStart !== null) {
      const pos = computeAnchor(mentionStart);
      setAnchor({ top: pos.top, left: pos.left });
    }
  };

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [mentionStart]);

  return (
    <div className="relative">
      <Textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onKeyUp={handleKeyUp}
        className={className}
        {...rest}
      />
      {open && filtered.length > 0 && (
        <div
          className="absolute z-50 w-72 max-h-64 overflow-auto rounded-[12px] border border-[#018942]/30 bg-white shadow-lg"
          style={{ top: anchor.top + 20, left: Math.min(anchor.left, (taRef.current?.clientWidth || 300) - 288) }}
        >
          <div className="px-3 py-2 text-[12px] text-[#018942] font-medium border-b border-[#018942]/20">
            Mencionar colaborador
          </div>
          <div className="py-1">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(p.full_name || 'Usuário')}
                className="w-full text-left px-3 py-2 hover:bg-[#018942]/10 text-sm flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded-full bg-[#018942]/10 flex items-center justify-center text-[#018942] text-xs">
                  {(p.full_name || 'U').slice(0,1).toUpperCase()}
                </div>
                <span className="text-gray-900">@{p.full_name || 'Usuário'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
