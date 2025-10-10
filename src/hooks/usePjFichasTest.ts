import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Socio {
  nome?: string;
  cpf?: string;
  tel?: string;
}

interface PjFichaTest {
  id: string;
  applicant_id: string;
  trade_name?: string;
  contato_financeiro?: string;
  contato_tecnico?: string;
  created_at: string;
  updated_at: string;
  
  // Novos campos - Empresa
  razao_social?: string;
  cnpj?: string;
  data_abertura?: string;
  nome_fantasia?: string;
  nome_fachada?: string;
  area_atuacao?: string;
  
  // Novos campos - Endereço
  tipo_imovel?: string;
  obs_tipo_imovel?: string;
  tempo_endereco?: string;
  tipo_estabelecimento?: string;
  obs_estabelecimento?: string;
  endereco_pessoal?: string;
  
  // Novos campos - Contatos
  fones_os?: string;
  
  // Novos campos - Documentos
  comprovante_status?: string;
  tipo_comprovante?: string;
  em_nome_de?: string;
  possui_internet?: string;
  operadora_internet?: string;
  plano_internet?: string;
  valor_internet?: string;
  contrato_social?: string;
  obs_contrato?: string;
  
  // Novos campos - Sócios
  socios?: Socio[];
  
  // Novos campos - Informações
  informacoes_relevantes?: string;
  outras_pessoas?: string;
  protocolo_mk?: string;
  parecer_analise?: string;
}

export function usePjFichasTest(pjFichaId?: string) {
  const [pjFicha, setPjFicha] = useState<PjFichaTest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load PJ Ficha
  const loadPjFicha = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('pj_fichas_test')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setPjFicha(data);
    } catch (err) {
      console.error('❌ [usePjFichasTest] Erro ao carregar PJ Ficha:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  // Create PJ Ficha
  const createPjFicha = async (data: Omit<PjFichaTest, 'id' | 'created_at' | 'updated_at'>) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: newPjFicha, error } = await supabase
        .from('pj_fichas_test')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      setPjFicha(newPjFicha);
      return newPjFicha;
    } catch (err) {
      console.error('❌ [usePjFichasTest] Erro ao criar PJ Ficha:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Update PJ Ficha
  const updatePjFicha = async (id: string, updates: Partial<PjFichaTest>) => {
    setIsLoading(true);
    setError(null);
    try {
      // Optimistic update
      if (pjFicha) {
        setPjFicha({ ...pjFicha, ...updates });
      }

      const { data, error } = await supabase
        .from('pj_fichas_test')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setPjFicha(data);
      return data;
    } catch (err) {
      console.error('❌ [usePjFichasTest] Erro ao atualizar PJ Ficha:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      // Revert optimistic update
      if (pjFicha) {
        loadPjFicha(id);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete PJ Ficha
  const deletePjFicha = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('pj_fichas_test')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPjFicha(null);
    } catch (err) {
      console.error('❌ [usePjFichasTest] Erro ao deletar PJ Ficha:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    if (pjFichaId) {
      loadPjFicha(pjFichaId);
    }
  }, [pjFichaId]);

  // Realtime subscription
  useEffect(() => {
    if (!pjFichaId) return;

    const channel = supabase
      .channel(`pj-fichas-test-${pjFichaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pj_fichas_test',
          filter: `id=eq.${pjFichaId}`,
        },
        (payload) => {
          console.log('🔄 [usePjFichasTest] Realtime update:', payload);
          if (payload.eventType === 'DELETE') {
            setPjFicha(null);
          } else {
            setPjFicha(payload.new as PjFichaTest);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pjFichaId]);

  return {
    pjFicha,
    isLoading,
    error,
    loadPjFicha,
    createPjFicha,
    updatePjFicha,
    deletePjFicha,
  };
}
