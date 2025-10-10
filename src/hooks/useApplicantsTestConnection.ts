import { useState, useCallback } from 'react';
import { useApplicantsTest } from './useApplicantsTest';
import { supabase } from '@/integrations/supabase/client';

// Tipos para os dados dos formulários
interface SolicitacaoData {
  quem_solicitou?: string;
  meio?: string;
  protocolo_mk?: string;
}

interface AnaliseData {
  spc?: string;
  pesquisador?: string;
  plano_acesso?: string;
  venc?: string;
  sva_avulso?: string;
}

export function useApplicantsTestConnection(applicantId?: string) {
  const { applicant, updateSolicitacaoFields, updateAnaliseFields } = useApplicantsTest(applicantId);
  const [isSaving, setIsSaving] = useState(false);

  // Salvar dados de solicitação na tabela applicants_test
  const saveSolicitacaoData = useCallback(async (data: SolicitacaoData): Promise<boolean> => {
    if (!applicantId) return false;

    setIsSaving(true);
    try {
      const success = await updateSolicitacaoFields(data);
      return success;
    } catch (error) {
      console.error('❌ [useApplicantsTestConnection] Erro ao salvar dados de solicitação:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [applicantId, updateSolicitacaoFields]);

  // Salvar dados de análise na tabela applicants_test
  const saveAnaliseData = useCallback(async (data: AnaliseData): Promise<boolean> => {
    if (!applicantId) return false;

    setIsSaving(true);
    try {
      const success = await updateAnaliseFields(data);
      return success;
    } catch (error) {
      console.error('❌ [useApplicantsTestConnection] Erro ao salvar dados de análise:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [applicantId, updateAnaliseFields]);

  // Buscar ou criar applicant na tabela teste baseado no card/application
  const ensureApplicantExists = useCallback(async (cardData: any): Promise<string | null> => {
    if (!cardData?.id) return null;

    try {
      // Verificar se já existe um applicant_test para este card
      const { data: existingApplicant } = await supabase
        .from('applicants_test')
        .select('id')
        .eq('cpf_cnpj', cardData.cpf_cnpj || cardData.cnpj)
        .eq('person_type', cardData.person_type || 'PF')
        .maybeSingle();

      if (existingApplicant) {
        return existingApplicant.id;
      }

      // Criar novo applicant na tabela teste
      const { data: newApplicant, error } = await supabase
        .from('applicants_test')
        .insert({
          person_type: cardData.person_type || 'PF',
          primary_name: cardData.nome || cardData.razao || cardData.primary_name,
          cpf_cnpj: cardData.cpf_cnpj || cardData.cnpj || cardData.cpf,
          phone: cardData.telefone || cardData.tel || cardData.phone,
          email: cardData.email,
          city: cardData.cidade || cardData.city,
          uf: cardData.uf,
        })
        .select('id')
        .single();

      if (error) throw error;

      return newApplicant.id;
    } catch (error) {
      console.error('❌ [useApplicantsTestConnection] Erro ao criar/verificar applicant:', error);
      return null;
    }
  }, []);

  return {
    applicant,
    isSaving,
    saveSolicitacaoData,
    saveAnaliseData,
    ensureApplicantExists,
  };
}
