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
        // razao_social e cnpj agora são salvos em applicants (primary_name e cpf_cnpj)
        updateData.data_abertura = formData.empresa.abertura;
        updateData.nome_fantasia = formData.empresa.fantasia;
        updateData.nome_fachada = formData.empresa.fachada;
        updateData.area_atuacao = formData.empresa.area;
      }

      // Map endereco data
      if (formData.endereco) {
        // end, n, compl, cep, bairro são salvos em applicants
        updateData.tipo_imovel = formData.endereco.tipo;
        updateData.obs_tipo_imovel = formData.endereco.obsTipo;
        updateData.tempo_endereco = formData.endereco.tempo;
        updateData.tipo_estabelecimento = formData.endereco.estab;
        updateData.obs_estabelecimento = formData.endereco.obsEstab;
        updateData.end_ps = formData.endereco.endPs; // Renomeada: endereco_pessoal → end_ps
      }

      // Map contatos data
      if (formData.contatos) {
        // tel, whats, email são salvos em applicants
        updateData.fones_ps = formData.contatos.fonesOs; // Renomeada: fones_os → fones_ps
      }

      // Map docs data
      if (formData.docs) {
        updateData.enviou_comprovante = formData.docs.comprovante; // Renomeada: comprovante_status → enviou_comprovante
        updateData.tipo_comprovante = formData.docs.tipo;
        updateData.nome_comprovante = formData.docs.emNomeDe; // Renomeada: em_nome_de → nome_comprovante
        updateData.possui_internet = formData.docs.possuiInternet;
        updateData.operadora_internet = formData.docs.operadora;
        updateData.plano_internet = formData.docs.plano;
        updateData.valor_internet = formData.docs.valor;
        updateData.contrato_social = formData.docs.contratoSocial;
        updateData.obs_contrato_social = formData.docs.obsContrato; // Renomeada: obs_contrato → obs_contrato_social
      }

      // Map socios data (de JSONB array para colunas separadas)
      if (formData.socios && Array.isArray(formData.socios)) {
        // Sócio 1
        if (formData.socios[0]) {
          updateData.socio1_nome = formData.socios[0].nome;
          updateData.socio1_cpf = formData.socios[0].cpf;
          updateData.socio1_telefone = formData.socios[0].tel;
          // socio1_reside não está no formulário, manter NULL
        }
        // Sócio 2
        if (formData.socios[1]) {
          updateData.socio2_nome = formData.socios[1].nome;
          updateData.socio2_cpf = formData.socios[1].cpf;
          updateData.socio2_telefone = formData.socios[1].tel;
          // socio2_reside não está no formulário, manter NULL
        }
        // Sócio 3
        if (formData.socios[2]) {
          updateData.socio3_nome = formData.socios[2].nome;
          updateData.socio3_cpf = formData.socios[2].cpf;
          updateData.socio3_telefone = formData.socios[2].tel;
          // socio3_reside não está no formulário, manter NULL
        }
      }

      // Map solicitacao data
      // protocolo_mk, planoAcesso, venc, svaAvulso são salvos em applicants, não em pj_fichas_test

      // Map info data
      // info_relevantes, info_spc, info_mk, parecer_analise são salvos em applicants, não em pj_fichas_test
      // outrasPs não tem coluna correspondente (outras_pessoas foi dropada)

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
