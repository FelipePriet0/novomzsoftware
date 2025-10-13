import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

// Tipos para a tabela applicants_test
export interface ApplicantTest {
  id: string;
  person_type: 'PF' | 'PJ';
  primary_name: string;
  cpf_cnpj: string;
  phone?: string;
  email?: string;
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  cep?: string;
  complement?: string;
  uf?: string;
  created_at: string;
  updated_at: string;
  
  // Novos campos solicitados
  quem_solicitou?: string;
  meio?: string;
  protocolo_mk?: string;
  
  // Campos que já existem no front e serão conectados
  spc?: string;
  pesquisador?: string;
  plano_acesso?: string;
  venc?: string;
  sva_avulso?: string;
}

export interface CreateApplicantTestInput {
  person_type: 'PF' | 'PJ';
  primary_name: string;
  cpf_cnpj: string;
  phone?: string;
  email?: string;
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  cep?: string;
  complement?: string;
  uf?: string;
  quem_solicitou?: string;
  meio?: string;
  protocolo_mk?: string;
  spc?: string;
  pesquisador?: string;
  plano_acesso?: string;
  venc?: string;
  sva_avulso?: string;
}

export interface UpdateApplicantTestInput {
  primary_name?: string;
  phone?: string;
  email?: string;
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  cep?: string;
  complement?: string;
  uf?: string;
  quem_solicitou?: string;
  meio?: string;
  protocolo_mk?: string;
  spc?: string;
  pesquisador?: string;
  plano_acesso?: string;
  venc?: string;
  sva_avulso?: string;
}

export function useApplicantsTest(applicantId?: string) {
  const [applicant, setApplicant] = useState<ApplicantTest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  // Carregar dados do applicant específico
  const loadApplicant = useCallback(async () => {
    if (!applicantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('applicants_test')
        .select('*')
        .eq('id', applicantId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setApplicant(null);
          return;
        }
        throw fetchError;
      }

      setApplicant(data);
    } catch (err: any) {
      console.error('❌ [useApplicantsTest] Erro ao carregar applicant:', err);
      setError(err.message || 'Erro ao carregar dados do applicant');
      setApplicant(null);
    } finally {
      setIsLoading(false);
    }
  }, [applicantId]);

  // Criar novo applicant
  const createApplicant = async (input: CreateApplicantTestInput): Promise<ApplicantTest | null> => {
    if (!profile) {
      setError('Usuário não autenticado');
      return null;
    }

    try {
      const { data: result, error: createError } = await supabase
        .from('applicants_test')
        .insert(input)
        .select()
        .single();

      if (createError) throw createError;

      setApplicant(result);
      return result;
    } catch (err: any) {
      console.error('❌ [useApplicantsTest] Erro ao criar applicant:', err);
      setError(err.message || 'Erro ao criar applicant');
      return null;
    }
  };

  // Atualizar applicant
  const updateApplicant = async (updates: UpdateApplicantTestInput): Promise<boolean> => {
    if (!applicant?.id) {
      setError('ID do applicant não encontrado');
      return false;
    }

    try {
      // 1. Atualização otimista (UI instantânea)
      setApplicant(prev => prev ? { ...prev, ...updates } : null);

      // 2. Salvar no banco
      const { data: updatedData, error: updateError } = await supabase
        .from('applicants_test')
        .update(updates)
        .eq('id', applicant.id)
        .select()
        .single();

      if (updateError) {
        // Reverter em caso de erro
        await loadApplicant();
        throw updateError;
      }

      setApplicant(updatedData);
      return true;
    } catch (err: any) {
      console.error('❌ [useApplicantsTest] Erro ao atualizar applicant:', err);
      setError(err.message || 'Erro ao atualizar applicant');
      return false;
    }
  };

  // Atualizar campos específicos (conveniência)
  const updateSolicitacaoFields = async (fields: {
    quem_solicitou?: string;
    meio?: string;
    protocolo_mk?: string;
  }): Promise<boolean> => {
    return updateApplicant(fields);
  };

  const updateAnaliseFields = async (fields: {
    spc?: string;
    pesquisador?: string;
    plano_acesso?: string;
    venc?: string;
    sva_avulso?: string;
  }): Promise<boolean> => {
    return updateApplicant(fields);
  };

  // Deletar applicant (soft delete)
  const deleteApplicant = async (): Promise<boolean> => {
    if (!applicant?.id) {
      setError('ID do applicant não encontrado');
      return false;
    }

    try {
      const { error: deleteError } = await supabase
        .from('applicants_test')
        .delete()
        .eq('id', applicant.id);

      if (deleteError) throw deleteError;

      setApplicant(null);
      return true;
    } catch (err: any) {
      console.error('❌ [useApplicantsTest] Erro ao deletar applicant:', err);
      setError(err.message || 'Erro ao deletar applicant');
      return false;
    }
  };

  // Carregar quando applicantId mudar
  useEffect(() => {
    if (applicantId) {
      loadApplicant();
    }
  }, [applicantId, loadApplicant]);

  // 🔥 SUPABASE REALTIME: Sincronização automática de applicants_test
  useEffect(() => {
    if (!applicantId) return;

    const channel = supabase
      .channel(`applicants-test-${applicantId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'applicants_test',
          filter: `id=eq.${applicantId}`
        },
        (payload) => {
          // Recarregar applicant automaticamente quando houver qualquer mudança
          loadApplicant();
        }
      )
      .subscribe();

    // Cleanup ao desmontar
    return () => {
      supabase.removeChannel(channel);
    };
  }, [applicantId, loadApplicant]);

  return {
    applicant,
    isLoading,
    error,
    loadApplicant,
    createApplicant,
    updateApplicant,
    updateSolicitacaoFields,
    updateAnaliseFields,
    deleteApplicant,
  };
}
