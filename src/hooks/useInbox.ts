import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export type InboxPriority = 'high' | 'medium' | 'low';
export type InboxType =
  | 'task_assigned'
  | 'task_due'
  | 'task_critical'
  | 'mention'
  | 'thread_reply'
  | 'card_linked'
  | 'new_ficha'
  | 'ficha_dispute'
  | 'ficha_overdue';

export interface InboxItem {
  id: string;
  user_id: string;
  type: InboxType;
  priority: InboxPriority;
  title: string;
  body: string;
  meta?: any;
  link_url?: string | null;
  transient?: boolean;
  expires_at?: string | null;
  read_at?: string | null;
  created_at: string;
}

export function useInbox() {
  const { profile } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('inbox_notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data || []) as InboxItem[]);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const create = useCallback(async (input: Omit<InboxItem, 'id' | 'created_at' | 'user_id'>) => {
    if (!profile?.id) throw new Error('Sem usuário');
    const payload: any = { ...input, user_id: profile.id };
    const { data, error } = await supabase
      .from('inbox_notifications')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    setItems(prev => [data as InboxItem, ...prev]);
    return data as InboxItem;
  }, [profile?.id]);

  const update = useCallback(async (id: string, patch: Partial<InboxItem>) => {
    const { data, error } = await supabase
      .from('inbox_notifications')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    setItems(prev => prev.map(i => (i.id === id ? (data as InboxItem) : i)));
    return data as InboxItem;
  }, []);

  const markRead = useCallback(async (id: string) => {
    return update(id, { read_at: new Date().toISOString() } as any);
  }, [update]);

  const markAllRead = useCallback(async () => {
    if (!profile?.id) return;
    await supabase.rpc('inbox_mark_all_read', { p_user: profile.id });
    await fetchAll();
  }, [profile?.id, fetchAll]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('inbox_notifications')
      .delete()
      .eq('id', id);
    if (error) throw error;
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`inbox-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_notifications', filter: `user_id=eq.${profile.id}` }, () => {
        fetchAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, fetchAll]);

  return {
    items, loading, error,
    fetchAll, create, update, remove,
    markRead, markAllRead,
  };
}

