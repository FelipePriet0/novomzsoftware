import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ApplicantRow {
  id: string;
  person_type: 'PF' | 'PJ';
  primary_name: string;
  cpf_cnpj: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address_line: string | null;
  address_number: string | null;
  address_complement: string | null;
  bairro: string | null;
  cep: string | null;
  city: string | null;
  plano_acesso: string | null;
  venc: number | null;
  carne_impresso: boolean | null;
  quem_solicitou: string | null;
  telefone_solicitante: string | null;
  protocolo_mk: string | null;
  meio: string | null;
  info_spc: string | null;
  info_pesquisador: string | null;
  info_relevantes: string | null;
  info_mk: string | null;
  parecer_analise: string | null;
  sva_avulso: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type ApplicantUpdates = Partial<Pick<ApplicantRow,
  | 'primary_name' | 'cpf_cnpj' | 'phone' | 'whatsapp' | 'email'
  | 'address_line' | 'address_number' | 'address_complement' | 'bairro' | 'cep' | 'city'
  | 'plano_acesso' | 'venc' | 'carne_impresso'
  | 'quem_solicitou' | 'telefone_solicitante' | 'protocolo_mk' | 'meio'
  | 'info_spc' | 'info_pesquisador' | 'info_relevantes' | 'info_mk' | 'parecer_analise'
  | 'sva_avulso'
>>;

export function useApplicants(applicantId?: string) {
  const [applicant, setApplicant] = useState<ApplicantRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!applicantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await (supabase as any)
        .from('applicants')
        .select('*')
        .eq('id', applicantId)
        .maybeSingle();
      if (error) throw error;
      setApplicant(data as ApplicantRow);
    } catch (e: any) {
      setError(e?.message || String(e));
      setApplicant(null);
    } finally {
      setLoading(false);
    }
  }, [applicantId]);

  const update = useCallback(async (updates: ApplicantUpdates) => {
    if (!applicantId) return false;
    try {
      // Optimistic
      setApplicant(prev => prev ? ({ ...prev, ...updates }) as ApplicantRow : prev);
      const { data, error } = await (supabase as any)
        .from('applicants')
        .update(updates)
        .eq('id', applicantId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (data) setApplicant(data as ApplicantRow);
      return true;
    } catch (e) {
      // Reload on failure
      load();
      return false;
    }
  }, [applicantId, load]);

  useEffect(() => { load(); }, [load]);

  // Realtime sync (optional; keeps in sync if others edit)
  useEffect(() => {
    if (!applicantId) return;
    const channel = (supabase as any)
      .channel(`applicant-${applicantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applicants', filter: `id=eq.${applicantId}` }, () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [applicantId, load]);

  return { applicant, loading, error, load, update };
}

