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
        <div className="absolute z-50 mt-1 w-64 max-h-56 overflow-auto rounded-md border bg-white shadow">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertMention(p.full_name || 'Usuário')}
              className="w-full text-left px-3 py-2 hover:bg-[#018942]/10 text-sm"
            >
              @{p.full_name || 'Usuário'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

