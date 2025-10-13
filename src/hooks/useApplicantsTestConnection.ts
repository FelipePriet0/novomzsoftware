import { useState, useCallback, useRef } from 'react';
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
  const lastApplicantIdRef = useRef<string | null>(applicantId || null);

  // Salvar dados de solicitação na tabela applicants_test
  const saveSolicitacaoData = useCallback(async (data: SolicitacaoData): Promise<boolean> => {
    // Prefer hook-bound applicantId; fallback to last ensured id
    const targetId = applicantId || lastApplicantIdRef.current;
    if (!targetId) return false;

    setIsSaving(true);
    try {
      // If hook is bound to this id, use hook updater for optimistic UI
      if (applicant?.id === targetId && applicantId) {
        const success = await updateSolicitacaoFields(data);
        return success;
      }
      // Direct update as fallback
      const { error } = await supabase
        .from('applicants_test')
        .update(data)
        .eq('id', targetId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ [useApplicantsTestConnection] Erro ao salvar dados de solicitação:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [applicantId, applicant, updateSolicitacaoFields]);

  // Salvar dados de análise na tabela applicants_test
  const saveAnaliseData = useCallback(async (data: AnaliseData): Promise<boolean> => {
    const targetId = applicantId || lastApplicantIdRef.current;
    if (!targetId) return false;

    setIsSaving(true);
    try {
      if (applicant?.id === targetId && applicantId) {
        const success = await updateAnaliseFields(data);
        return success;
      }
      const { error } = await supabase
        .from('applicants_test')
        .update(data)
        .eq('id', targetId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ [useApplicantsTestConnection] Erro ao salvar dados de análise:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [applicantId, applicant, updateAnaliseFields]);

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
        lastApplicantIdRef.current = existingApplicant.id;
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

      lastApplicantIdRef.current = newApplicant.id;
      return newApplicant.id;
    } catch (error) {
      console.error('❌ [useApplicantsTestConnection] Erro ao criar/verificar applicant:', error);
      return null;
    }
  }, []);

  // Direct helpers with explicit id
  const saveSolicitacaoDataFor = useCallback(async (targetId: string, data: SolicitacaoData): Promise<boolean> => {
    if (!targetId) return false;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('applicants_test')
        .update(data)
        .eq('id', targetId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ [useApplicantsTestConnection] Erro (for) ao salvar solicitação:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const saveAnaliseDataFor = useCallback(async (targetId: string, data: AnaliseData): Promise<boolean> => {
    if (!targetId) return false;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('applicants_test')
        .update(data)
        .eq('id', targetId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ [useApplicantsTestConnection] Erro (for) ao salvar análise:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    applicant,
    isSaving,
    saveSolicitacaoData,
    saveAnaliseData,
    ensureApplicantExists,
    saveSolicitacaoDataFor,
    saveAnaliseDataFor,
  };
}
