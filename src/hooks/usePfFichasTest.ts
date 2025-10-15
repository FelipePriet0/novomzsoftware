import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PfFichaTest {
  id: string;
  applicant_id: string;
  birth_date?: string;
  naturalidade?: string;
  uf_naturalidade?: string;
  cond?: string;
  tempo_endereco?: string;
  tipo_moradia?: string;
  tipo_moradia_obs?: string;
  endereco_do_ps?: string;
  unica_no_lote?: string;
  unica_no_lote_obs?: string;
  com_quem_reside?: string;
  nas_outras?: string;
  tem_contrato?: string;
  enviou_contrato?: string;
  nome_de?: string;
  nome_locador?: string;
  telefone_locador?: string;
  enviou_comprovante?: string;
  tipo_comprovante?: string;
  nome_comprovante?: string;
  tem_internet_fixa?: string;
  empresa_internet?: string;
  plano_internet?: string;
  valor_internet?: string;
  observacoes?: string;
  profissao?: string;
  empresa?: string;
  vinculo?: string;
  vinculo_obs?: string;
  emprego_do_ps?: string;
  estado_civil?: string;
  conjuge_obs?: string;
  conjuge_idade?: number;
  conjuge_nome?: string;
  conjuge_telefone?: string;
  conjuge_whatsapp?: string;
  conjuge_cpf?: string;
  conjuge_naturalidade?: string;
  conjuge_uf?: string;
  conjuge_do_ps?: string;
  pai_nome?: string;
  pai_reside?: string;
  pai_telefone?: string;
  mae_nome?: string;
  mae_reside?: string;
  mae_telefone?: string;
  ref1_nome?: string;
  ref1_parentesco?: string;
  ref1_reside?: string;
  ref1_telefone?: string;
  ref2_nome?: string;
  ref2_parentesco?: string;
  ref2_reside?: string;
  ref2_telefone?: string;
  plano_escolhido?: string;
  dia_vencimento?: string;
  carne_impresso?: string;
  sva_avulso?: string;
  info?: string;
  info_mk?: string;
  parecer_analise?: string;
  created_at: string;
  updated_at: string;
}

export function usePfFichasTest(pfFichaId?: string) {
  const [pfFicha, setPfFicha] = useState<PfFichaTest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load PF Ficha
  const loadPfFicha = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('pf_fichas_test')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setPfFicha(data);
    } catch (err) {
      console.error('❌ [usePfFichasTest] Erro ao carregar PF Ficha:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  // Create PF Ficha
  const createPfFicha = async (data: Omit<PfFichaTest, 'id' | 'created_at' | 'updated_at'>) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: newPfFicha, error } = await supabase
        .from('pf_fichas_test')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      setPfFicha(newPfFicha);
      return newPfFicha;
    } catch (err) {
      console.error('❌ [usePfFichasTest] Erro ao criar PF Ficha:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Update PF Ficha
  const updatePfFicha = async (id: string, updates: Partial<PfFichaTest>) => {
    setIsLoading(true);
    setError(null);
    try {
      // Optimistic update
      if (pfFicha) {
        setPfFicha({ ...pfFicha, ...updates });
      }

      const { data, error } = await supabase
        .from('pf_fichas_test')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setPfFicha(data);
      return data;
    } catch (err) {
      console.error('❌ [usePfFichasTest] Erro ao atualizar PF Ficha:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      // Revert optimistic update
      if (pfFicha) {
        loadPfFicha(id);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete PF Ficha
  const deletePfFicha = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('pf_fichas_test')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPfFicha(null);
    } catch (err) {
      console.error('❌ [usePfFichasTest] Erro ao deletar PF Ficha:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    if (pfFichaId) {
      loadPfFicha(pfFichaId);
    }
  }, [pfFichaId]);

  // Realtime subscription
  useEffect(() => {
    if (!pfFichaId) return;

    const channel = supabase
      .channel(`pf-fichas-test-${pfFichaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pf_fichas_test',
          filter: `id=eq.${pfFichaId}`,
        },
        (payload) => {
          console.log('🔄 [usePfFichasTest] Realtime update:', payload);
          if (payload.eventType === 'DELETE') {
            setPfFicha(null);
          } else {
            setPfFicha(payload.new as PfFichaTest);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pfFichaId]);

  return {
    pfFicha,
    isLoading,
    error,
    loadPfFicha,
    createPfFicha,
    updatePfFicha,
    deletePfFicha,
  };
}
