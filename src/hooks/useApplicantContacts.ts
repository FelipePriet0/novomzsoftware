import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ApplicantContacts {
  phone: string | null;
  whatsapp: string | null;
  quem_solicitou: string | null;
  telefone_solicitante: string | null;
}

export type ApplicantContactsUpdates = Partial<ApplicantContacts>;

export function useApplicantContacts(applicantId?: string) {
  const [contacts, setContacts] = useState<ApplicantContacts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!applicantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await (supabase as any)
        .from('applicants')
        .select('phone, whatsapp, quem_solicitou, telefone_solicitante')
        .eq('id', applicantId)
        .maybeSingle();
      if (error) throw error;
      setContacts((data || null) as ApplicantContacts | null);
    } catch (e: any) {
      setError(e?.message || String(e));
      setContacts(null);
    } finally {
      setLoading(false);
    }
  }, [applicantId]);

  const update = useCallback(async (updates: ApplicantContactsUpdates) => {
    if (!applicantId) return false;
    const payload: any = {};
    if (typeof updates.phone !== 'undefined') payload.phone = updates.phone;
    if (typeof updates.whatsapp !== 'undefined') payload.whatsapp = updates.whatsapp;
    if (typeof updates.quem_solicitou !== 'undefined') payload.quem_solicitou = updates.quem_solicitou;
    if (typeof updates.telefone_solicitante !== 'undefined') payload.telefone_solicitante = updates.telefone_solicitante;
    if (!Object.keys(payload).length) return true;

    // Optimistic update
    setContacts(prev => prev ? { ...prev, ...updates } as ApplicantContacts : prev);
    try {
      const { error } = await (supabase as any)
        .from('applicants')
        .update(payload)
        .eq('id', applicantId);
      if (error) throw error;
      return true;
    } catch (_) {
      await load();
      return false;
    }
  }, [applicantId, load]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!applicantId) return;
    const channel = (supabase as any)
      .channel(`applicant-contacts-${applicantId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'applicants', filter: `id=eq.${applicantId}` }, () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [applicantId, load]);

  return { contacts, loading, error, load, update };
}

