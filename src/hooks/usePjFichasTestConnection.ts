import { usePjFichasTest } from './usePjFichasTest';
import { supabase } from '@/integrations/supabase/client';

interface Socio {
  nome?: string;
  cpf?: string;
  tel?: string;
}

interface PjFichaFormData {
  // Empresa
  empresa?: {
    razao?: string;
    cnpj?: string;
    abertura?: string;
    fantasia?: string;
    fachada?: string;
    area?: string;
  };
  
  // Endereço
  endereco?: {
    end?: string;
    n?: string;
    compl?: string;
    tipo?: string;
    obsTipo?: string;
    cep?: string;
    bairro?: string;
    tempo?: string;
    estab?: string;
    obsEstab?: string;
    endPs?: string;
  };
  
  // Contatos
  contatos?: {
    tel?: string;
    whats?: string;
    fonesOs?: string;
    email?: string;
  };
  
  // Documentos
  docs?: {
    comprovante?: string;
    tipo?: string;
    emNomeDe?: string;
    possuiInternet?: string;
    operadora?: string;
    plano?: string;
    valor?: string;
    contratoSocial?: string;
    obsContrato?: string;
  };
  
  // Sócios
  socios?: Socio[];
  
  // Solicitação
  solicitacao?: {
    quem?: string;
    meio?: string;
    tel?: string;
    planoAcesso?: string;
    svaAvulso?: string;
    venc?: string;
    protocolo?: string;
  };
  
  // Informações
  info?: {
    relevantes?: string;
    spc?: string;
    outrasPs?: string;
    mk?: string;
    parecerAnalise?: string;
  };
}

export function usePjFichasTestConnection() {
  const { createPjFicha, updatePjFicha } = usePjFichasTest();

  // Ensure PJ Ficha exists (create if not exists)
  const ensurePjFichaExists = async (applicantId: string) => {
    try {
      // Try to find existing PJ Ficha
      const { data: existing, error: findError } = await supabase
        .from('pj_fichas_test')
        .select('id')
        .eq('applicant_id', applicantId)
        .maybeSingle();

      if (existing) {
        console.log('✅ [usePjFichasTestConnection] PJ Ficha já existe:', existing.id);
        return existing.id;
      }

      // Create new PJ Ficha
      const pjFichaData = {
        applicant_id: applicantId,
      };

      const newPjFicha = await createPjFicha(pjFichaData);
      console.log('✅ [usePjFichasTestConnection] PJ Ficha criada:', newPjFicha.id);
      return newPjFicha.id;

    } catch (error) {
      console.error('❌ [usePjFichasTestConnection] Erro ao garantir PJ Ficha:', error);
      throw error;
    }
  };

  // Save company data
  const saveCompanyData = async (applicantId: string, formData: PjFichaFormData) => {
    try {
      const pjFichaId = await ensurePjFichaExists(applicantId);

      const updateData: any = {};

      // Map empresa data
      if (formData.empresa) {
        updateData.razao_social = formData.empresa.razao;
        updateData.cnpj = formData.empresa.cnpj;
        updateData.data_abertura = formData.empresa.abertura;
        updateData.nome_fantasia = formData.empresa.fantasia;
        updateData.nome_fachada = formData.empresa.fachada;
        updateData.area_atuacao = formData.empresa.area;
      }

      // Map endereco data
      if (formData.endereco) {
        updateData.tipo_imovel = formData.endereco.tipo;
        updateData.obs_tipo_imovel = formData.endereco.obsTipo;
        updateData.tempo_endereco = formData.endereco.tempo;
        updateData.tipo_estabelecimento = formData.endereco.estab;
        updateData.obs_estabelecimento = formData.endereco.obsEstab;
        updateData.endereco_pessoal = formData.endereco.endPs;
      }

      // Map contatos data
      if (formData.contatos) {
        updateData.fones_os = formData.contatos.fonesOs;
      }

      // Map docs data
      if (formData.docs) {
        updateData.comprovante_status = formData.docs.comprovante;
        updateData.tipo_comprovante = formData.docs.tipo;
        updateData.em_nome_de = formData.docs.emNomeDe;
        updateData.possui_internet = formData.docs.possuiInternet;
        updateData.operadora_internet = formData.docs.operadora;
        updateData.plano_internet = formData.docs.plano;
        updateData.valor_internet = formData.docs.valor;
        updateData.contrato_social = formData.docs.contratoSocial;
        updateData.obs_contrato = formData.docs.obsContrato;
      }

      // Map socios data
      if (formData.socios) {
        updateData.socios = formData.socios;
      }

      // Map solicitacao data
      if (formData.solicitacao) {
        updateData.protocolo_mk = formData.solicitacao.protocolo;
      }

      // Map info data
      if (formData.info) {
        updateData.informacoes_relevantes = formData.info.relevantes;
        updateData.outras_pessoas = formData.info.outrasPs;
        updateData.parecer_analise = formData.info.parecerAnalise;
      }

      await updatePjFicha(pjFichaId, updateData);
      console.log('✅ [usePjFichasTestConnection] Dados da empresa salvos');

    } catch (error) {
      console.error('❌ [usePjFichasTestConnection] Erro ao salvar dados da empresa:', error);
      throw error;
    }
  };

  return {
    ensurePjFichaExists,
    saveCompanyData,
  };
}
