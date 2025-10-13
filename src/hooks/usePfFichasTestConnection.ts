import { usePfFichasTest } from './usePfFichasTest';
import { supabase } from '@/integrations/supabase/client';

interface PfFichaFormData {
  // Cliente
  cliente: {
    nome?: string;
    cpf?: string;
    nasc?: string;
    tel?: string;
    whats?: string;
    naturalidade?: string;
    uf?: string;
    email?: string;
    doPs?: string;
  };
  
  // Endereço
  endereco: {
    end?: string;
    n?: string;
    compl?: string;
    cep?: string;
    bairro?: string;
    cond?: string;
    tempo?: string;
    tipoMoradia?: string;
    tipoMoradiaObs?: string;
    doPs?: string;
  };
  
  // Relações
  relacoes: {
    unicaNoLote?: string;
    unicaNoLoteObs?: string;
    comQuemReside?: string;
    nasOutras?: string;
    temContrato?: string;
    enviouContrato?: string;
    nomeDe?: string;
    nomeLocador?: string;
    telefoneLocador?: string;
    enviouComprovante?: string;
    tipoComprovante?: string;
    nomeComprovante?: string;
    temInternetFixa?: string;
    empresaInternet?: string;
    planoInternet?: string;
    valorInternet?: string;
    observacoes?: string;
  };
  
  // Emprego/Renda
  empregoRenda: {
    profissao?: string;
    empresa?: string;
    vinculo?: string;
    vinculoObs?: string;
    doPs?: string;
  };
  
  // Cônjuge
  conjuge: {
    estadoCivil?: string;
    obs?: string;
    nome?: string;
    telefone?: string;
    whatsapp?: string;
    cpf?: string;
    naturalidade?: string;
    uf?: string;
    obs2?: string;
    doPs?: string;
  };
  
  // Filiação
  filiacao: {
    pai?: {
      nome?: string;
      reside?: string;
      telefone?: string;
    };
    mae?: {
      nome?: string;
      reside?: string;
      telefone?: string;
    };
  };
  
  // Referências
  referencias: {
    ref1?: {
      nome?: string;
      parentesco?: string;
      reside?: string;
      telefone?: string;
    };
    ref2?: {
      nome?: string;
      parentesco?: string;
      reside?: string;
      telefone?: string;
    };
  };
  
  // Outras informações
  outras: {
    planoEscolhido?: string;
    diaVencimento?: string;
    carneImpresso?: string;
    svaAvulso?: string;
  };
  
  // Informações relevantes
  infoRelevantes: {
    info?: string;
    infoMk?: string;
    parecerAnalise?: string;
  };
}

export function usePfFichasTestConnection() {
  const { createPfFicha, updatePfFicha } = usePfFichasTest();

  // Ensure PF Ficha exists (create if not exists)
  const ensurePfFichaExists = async (applicantId: string) => {
    try {
      // Try to find existing PF Ficha
      const { data: existing, error: findError } = await supabase
        .from('pf_fichas_test')
        .select('id')
        .eq('applicant_id', applicantId)
        .maybeSingle();

      if (existing) {
        console.log('✅ [usePfFichasTestConnection] PF Ficha já existe:', existing.id);
        return existing.id;
      }

      // Create new PF Ficha
      const pfFichaData = {
        applicant_id: applicantId,
      };

      const newPfFicha = await createPfFicha(pfFichaData);
      console.log('✅ [usePfFichasTestConnection] PF Ficha criada:', newPfFicha.id);
      return newPfFicha.id;

    } catch (error) {
      console.error('❌ [usePfFichasTestConnection] Erro ao garantir PF Ficha:', error);
      throw error;
    }
  };

  // Save personal data
  const savePersonalData = async (applicantId: string, formData: PfFichaFormData) => {
    try {
      const pfFichaId = await ensurePfFichaExists(applicantId);

      const updateData: any = {};

      // Helper para datas (evita enviar string vazia para colunas DATE)
      const normalizeDate = (v?: string | null) => {
        const t = (v || '').trim();
        if (!t) return null;
        // Aceita apenas YYYY-MM-DD por segurança
        return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
      };

      // Map cliente data
      if (formData.cliente) {
        updateData.birth_date = normalizeDate(formData.cliente.nasc);
        updateData.naturalidade = formData.cliente.naturalidade;
        updateData.uf_naturalidade = formData.cliente.uf;
      }

      // Map endereco data
      if (formData.endereco) {
        updateData.cond = formData.endereco.cond;
        updateData.tempo_endereco = formData.endereco.tempo;
        updateData.tipo_moradia = formData.endereco.tipoMoradia;
        updateData.tipo_moradia_obs = formData.endereco.tipoMoradiaObs;
        updateData.endereco_do_ps = formData.endereco.doPs;
      }

      // Map relacoes data
      if (formData.relacoes) {
        updateData.unica_no_lote = formData.relacoes.unicaNoLote;
        updateData.unica_no_lote_obs = formData.relacoes.unicaNoLoteObs;
        updateData.com_quem_reside = formData.relacoes.comQuemReside;
        updateData.nas_outras = formData.relacoes.nasOutras;
        updateData.tem_contrato = formData.relacoes.temContrato;
        updateData.enviou_contrato = formData.relacoes.enviouContrato;
        updateData.nome_de = formData.relacoes.nomeDe;
        updateData.nome_locador = formData.relacoes.nomeLocador;
        updateData.telefone_locador = formData.relacoes.telefoneLocador;
        updateData.enviou_comprovante = formData.relacoes.enviouComprovante;
        updateData.tipo_comprovante = formData.relacoes.tipoComprovante;
        updateData.nome_comprovante = formData.relacoes.nomeComprovante;
        updateData.tem_internet_fixa = formData.relacoes.temInternetFixa;
        updateData.empresa_internet = formData.relacoes.empresaInternet;
        updateData.plano_internet = formData.relacoes.planoInternet;
        updateData.valor_internet = formData.relacoes.valorInternet;
        updateData.observacoes = formData.relacoes.observacoes;
      }

      // Map emprego/renda data
      if (formData.empregoRenda) {
        updateData.profissao = formData.empregoRenda.profissao;
        updateData.empresa = formData.empregoRenda.empresa;
        updateData.vinculo = formData.empregoRenda.vinculo;
        updateData.vinculo_obs = formData.empregoRenda.vinculoObs;
        updateData.emprego_do_ps = formData.empregoRenda.doPs;
      }

      // Map conjuge data
      if (formData.conjuge) {
        updateData.estado_civil = formData.conjuge.estadoCivil;
        updateData.conjuge_obs = formData.conjuge.obs;
        updateData.conjuge_nome = formData.conjuge.nome;
        updateData.conjuge_telefone = formData.conjuge.telefone;
        updateData.conjuge_whatsapp = formData.conjuge.whatsapp;
        updateData.conjuge_cpf = formData.conjuge.cpf;
        updateData.conjuge_naturalidade = formData.conjuge.naturalidade;
        updateData.conjuge_uf = formData.conjuge.uf;
        updateData.conjuge_obs2 = formData.conjuge.obs2;
        updateData.conjuge_do_ps = formData.conjuge.doPs;
      }

      // Map filiacao data
      if (formData.filiacao) {
        updateData.pai_nome = formData.filiacao.pai?.nome;
        updateData.pai_reside = formData.filiacao.pai?.reside;
        updateData.pai_telefone = formData.filiacao.pai?.telefone;
        updateData.mae_nome = formData.filiacao.mae?.nome;
        updateData.mae_reside = formData.filiacao.mae?.reside;
        updateData.mae_telefone = formData.filiacao.mae?.telefone;
      }

      // Map referencias data
      if (formData.referencias) {
        updateData.ref1_nome = formData.referencias.ref1?.nome;
        updateData.ref1_parentesco = formData.referencias.ref1?.parentesco;
        updateData.ref1_reside = formData.referencias.ref1?.reside;
        updateData.ref1_telefone = formData.referencias.ref1?.telefone;
        updateData.ref2_nome = formData.referencias.ref2?.nome;
        updateData.ref2_parentesco = formData.referencias.ref2?.parentesco;
        updateData.ref2_reside = formData.referencias.ref2?.reside;
        updateData.ref2_telefone = formData.referencias.ref2?.telefone;
      }

      // Map outras informacoes
      if (formData.outras) {
        updateData.plano_escolhido = formData.outras.planoEscolhido;
        updateData.dia_vencimento = formData.outras.diaVencimento;
        updateData.carne_impresso = formData.outras.carneImpresso;
        updateData.sva_avulso = formData.outras.svaAvulso;
      }

      // Map informacoes relevantes
      if (formData.infoRelevantes) {
        updateData.info = formData.infoRelevantes.info;
        updateData.info_mk = formData.infoRelevantes.infoMk;
        updateData.parecer_analise = formData.infoRelevantes.parecerAnalise;
      }

      await updatePfFicha(pfFichaId, updateData);
      console.log('✅ [usePfFichasTestConnection] Dados pessoais salvos');

    } catch (error) {
      console.error('❌ [usePfFichasTestConnection] Erro ao salvar dados pessoais:', error);
      throw error;
    }
  };

  return {
    ensurePfFichaExists,
    savePersonalData,
  };
}
