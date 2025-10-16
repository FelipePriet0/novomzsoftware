import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import NovaFichaComercialForm, { ComercialFormValues } from '@/components/NovaFichaComercialForm';
import { BasicInfoData } from './BasicInfoModal';
import { Button } from "@/components/ui/button";
// Drafts desativados temporariamente
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X, Maximize2, Minimize2 } from 'lucide-react';
import { usePfFichasTestConnection } from '@/hooks/usePfFichasTestConnection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface Parecer {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  created_at: string;
  text: string;
}

interface ExpandedFichaModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ComercialFormValues) => Promise<void>;
  basicInfo: BasicInfoData;
  applicationId?: string;
  applicantId?: string;
  onStatusChange?: (cardId: string, newStatus: string) => void;
  onRefetch?: () => void;
}

export function ExpandedFichaModal({ 
  open, 
  onClose, 
  onSubmit, 
  basicInfo,
  applicationId,
  applicantId,
  onStatusChange,
  onRefetch
}: ExpandedFichaModalProps) {
  // Drafts desativados: remover auto-save e estados relacionados
  const [showFirstConfirmDialog, setShowFirstConfirmDialog] = useState(false);
  const [showSecondConfirmDialog, setShowSecondConfirmDialog] = useState(false);
  const [formData, setFormData] = useState<ComercialFormValues | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [pendingAction, setPendingAction] = useState<'close' | 'save' | null>(null);
  const [initialFormData, setInitialFormData] = useState<ComercialFormValues | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  // Drafts desativados: não carregamos/salvamos drafts por enquanto
  // PF ficha (fonte específica PF)
  const [pfInitial, setPfInitial] = useState<Partial<ComercialFormValues> | null>(null);
  // Applicants (fonte primária)
  const [applicantInitial, setApplicantInitial] = useState<Partial<ComercialFormValues> | null>(null);
  // Dev-safe CRUD state (test tables)
  const [applicantTestId, setApplicantTestId] = useState<string | null>(null);
  const { savePersonalData } = usePfFichasTestConnection();
  const [formApi, setFormApi] = useState<{ getCurrentValues: () => ComercialFormValues; flushAutosave: () => Promise<void> } | null>(null);
  // Removido: fluxo applicants_test (legado)
  const [expanded, setExpanded] = useState(false);

  const ensureCommercialFeitas = async (appId?: string) => {
    if (!appId) return;
    try {
      await supabase
        .from('kanban_cards')
        .update({ area: 'comercial', stage: 'feitas' })
        .eq('id', appId);
    } catch (_) {
      // ignore
    }
  };

  // Auto-save status component
  // Drafts desativados: indicador de auto-save removido

  // Function to normalize values for comparison
  const normalizeValue = (value: any): any => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      const normalized: any = {};
      for (const key in value) {
        normalized[key] = normalizeValue(value[key]);
      }
      return normalized;
    }
    if (Array.isArray(value)) {
      return value.map(normalizeValue);
    }
    return value;
  };

  // Function to compare form data with initial values
  const compareFormData = (_current: ComercialFormValues, _initial: ComercialFormValues): boolean => {
    // Simplified: any edit after initialization marks as changed.
    // Deep compares here are costly and cause jank while typing.
    return true;
  };

  const handleFormChange = (formData: any) => {
    setFormData(formData);
    // Only set hasChanges if we're initialized and there are actual changes
    if (isInitialized && initialFormData) {
      setHasChanges(true);
    } else if (!isInitialized) {
      // Store initial form data on first change (after form initialization)
      setInitialFormData(formData);
      setIsInitialized(true);
      setHasChanges(false); // No changes on initialization
    }
  };

  const handleClose = async () => {
    // Salvar rapidamente (flush do autosave do form) antes de fechar
    try {
      if (formApi?.flushAutosave) {
        await formApi.flushAutosave();
      }
      if (formData) {
        let aid: string | undefined = applicantId;
        if (!aid && applicationId) {
          const { data: kc } = await (supabase as any)
            .from('kanban_cards')
            .select('applicant_id')
            .eq('id', applicationId)
            .maybeSingle();
          aid = (kc as any)?.applicant_id as string | undefined;
        }
        if (aid) {
          const appUpdates: any = {};
          if (formData?.cliente?.nome) appUpdates.primary_name = formData.cliente.nome;
          if (formData?.cliente?.cpf) appUpdates.cpf_cnpj = formData.cliente.cpf;
          if (formData?.cliente?.tel) appUpdates.phone = formData.cliente.tel;
          if (formData?.cliente?.email) appUpdates.email = formData.cliente.email;
          if (formData?.cliente?.whats) appUpdates.whatsapp = formData.cliente.whats;
          if (formData?.endereco?.end) appUpdates.address_line = formData.endereco.end;
          if (formData?.endereco?.n) appUpdates.address_number = formData.endereco.n;
          if (formData?.endereco?.compl) appUpdates.address_complement = formData.endereco.compl;
          if (formData?.endereco?.cep) appUpdates.cep = formData.endereco.cep;
          if (formData?.endereco?.bairro) appUpdates.bairro = formData.endereco.bairro;
          if (formData?.outras?.planoEscolhido) appUpdates.plano_acesso = formData.outras.planoEscolhido;
          if (formData?.outras?.diaVencimento) appUpdates.venc = Number(formData.outras.diaVencimento);
          if (typeof formData?.outras?.carneImpresso !== 'undefined') {
            appUpdates.carne_impresso = formData.outras.carneImpresso === 'Sim' ? true : formData.outras.carneImpresso === 'Não' ? false : null;
          }
          if (formData?.outras?.svaAvulso) appUpdates.sva_avulso = formData.outras.svaAvulso;
          if ((formData as any)?.outras?.administrativas?.quemSolicitou) appUpdates.quem_solicitou = (formData as any).outras.administrativas.quemSolicitou;
          if ((formData as any)?.outras?.administrativas?.fone) appUpdates.telefone_solicitante = (formData as any).outras.administrativas.fone;
          if ((formData as any)?.outras?.administrativas?.protocoloMk) appUpdates.protocolo_mk = (formData as any).outras.administrativas.protocoloMk;
          if ((formData as any)?.outras?.administrativas?.meio) appUpdates.meio = (formData as any).outras.administrativas.meio;
          if (formData?.spc) appUpdates.info_spc = formData.spc;
          if (formData?.pesquisador) appUpdates.info_pesquisador = formData.pesquisador;
          if (formData?.infoRelevantes?.info) appUpdates.info_relevantes = formData.infoRelevantes.info;
          if (formData?.infoRelevantes?.infoMk) appUpdates.info_mk = formData.infoRelevantes.infoMk;
          if (formData?.infoRelevantes?.parecerAnalise) appUpdates.parecer_analise = formData.infoRelevantes.parecerAnalise;
          if (Object.keys(appUpdates).length > 0) {
            await (supabase as any).from('applicants').update(appUpdates).eq('id', aid);
          }
          try {
            await savePersonalData(aid, formData as any);
          } catch (_) { /* silencioso */ }
        }
      }
    } catch (_) {
      // silencioso para não travar fechamento
    }
    onClose();
  };

  const handleFirstConfirm = () => {
    setShowFirstConfirmDialog(false);
    setShowSecondConfirmDialog(true);
  };

  const handleSecondConfirm = async () => {
    setShowSecondConfirmDialog(false);
    
    if (pendingAction === 'close' || pendingAction === 'save') {
      if (formData) {
        try {
          if (applicationId) {
            const draftData = {
              customer_data: { ...basicInfo, ...formData.cliente },
              address_data: formData.endereco,
              employment_data: formData.empregoRenda,
              household_data: formData.relacoes,
              spouse_data: formData.conjuge,
              references_data: formData.referencias,
              other_data: {
                spc: formData.spc,
                pesquisador: formData.pesquisador,
                filiacao: formData.filiacao,
                outras: formData.outras,
                infoRelevantes: formData.infoRelevantes,
              },
            };
            await ensureCommercialFeitas(applicationId);
          // Campos do cliente agora são salvos em applicants, não em kanban_cards
          // (removida atualização redundante de title, phone, email, cpf_cnpj)
          // Atualizar applicants com campos canônicos ao confirmar
          try {
            let aid: string | undefined = applicantId;
            if (!aid && applicationId) {
              const { data: kc } = await supabase
                .from('kanban_cards')
                .select('applicant_id')
                .eq('id', applicationId)
                .maybeSingle();
              aid = (kc as any)?.applicant_id as string | undefined;
            }
            if (aid) {
              const appUpdates: any = {};
              // Campos principais (Applicants como fonte primária)
              if (formData?.cliente?.nome) appUpdates.primary_name = formData.cliente.nome;
              if (formData?.cliente?.cpf) appUpdates.cpf_cnpj = formData.cliente.cpf;
              if (formData?.cliente?.tel) appUpdates.phone = formData.cliente.tel;
              if (formData?.cliente?.email) appUpdates.email = formData.cliente.email;
              if (formData?.cliente?.whats) appUpdates.whatsapp = formData.cliente.whats;
              if (formData?.endereco?.end) appUpdates.address_line = formData.endereco.end;
              if (formData?.endereco?.n) appUpdates.address_number = formData.endereco.n;
              if (formData?.endereco?.compl) appUpdates.address_complement = formData.endereco.compl;
              if (formData?.endereco?.cep) appUpdates.cep = formData.endereco.cep;
              if (formData?.endereco?.bairro) appUpdates.bairro = formData.endereco.bairro;
              if (formData?.outras?.planoEscolhido) appUpdates.plano_acesso = formData.outras.planoEscolhido;
              if (formData?.outras?.diaVencimento) appUpdates.venc = Number(formData.outras.diaVencimento);
              if (typeof formData?.outras?.carneImpresso !== 'undefined') {
                appUpdates.carne_impresso = formData.outras.carneImpresso === 'Sim' ? true : formData.outras.carneImpresso === 'Não' ? false : null;
              }
              if (formData?.outras?.svaAvulso) appUpdates.sva_avulso = formData.outras.svaAvulso;
              if ((formData as any)?.outras?.administrativas?.quemSolicitou) appUpdates.quem_solicitou = (formData as any).outras.administrativas.quemSolicitou;
              if ((formData as any)?.outras?.administrativas?.fone) appUpdates.telefone_solicitante = (formData as any).outras.administrativas.fone;
              if ((formData as any)?.outras?.administrativas?.protocoloMk) appUpdates.protocolo_mk = (formData as any).outras.administrativas.protocoloMk;
              if ((formData as any)?.outras?.administrativas?.meio) appUpdates.meio = (formData as any).outras.administrativas.meio;
              if (formData?.spc) appUpdates.info_spc = formData.spc;
              if (formData?.pesquisador) appUpdates.info_pesquisador = formData.pesquisador;
              if (formData?.infoRelevantes?.info) appUpdates.info_relevantes = formData.infoRelevantes.info;
              if (formData?.infoRelevantes?.infoMk) appUpdates.info_mk = formData.infoRelevantes.infoMk;
              if (formData?.infoRelevantes?.parecerAnalise) appUpdates.parecer_analise = formData.infoRelevantes.parecerAnalise;
              if (Object.keys(appUpdates).length > 0) {
                await supabase.from('applicants').update(appUpdates).eq('id', aid);
              }

              // Persistir PF (pf_fichas_test) a partir do formulário (espelho do backend)
              try {
                await savePersonalData(aid, formData as any);
              } catch (_) { /* silencioso para UX */ }
            }
          } catch (_) {}
          }
          // Chamar fluxo original de submissão do formulário PF
          await onSubmit(formData);
          onRefetch?.();
        } catch (_) {
          // ignore errors, manter UX
        } finally {
          // Drafts desativados
        }
      }
      onClose();
    }
    
    setPendingAction(null);
  };

  const handleDiscardChanges = async () => {
    setShowFirstConfirmDialog(false);
    setShowSecondConfirmDialog(false);
    setPendingAction(null);
    onClose();
  };

  const handleSubmitWrapper = async (data: ComercialFormValues) => {
    if (applicationId) {
      // Show double confirmation for editing existing ficha
      setFormData(data);
      setPendingAction('save');
      setShowFirstConfirmDialog(true);
    } else {
      // Direct submit for new ficha
      await onSubmit(data);
          // Drafts desativados
      // Fechar modal após submissão
      onClose();
    }
  };

  // Deleção de pareceres desativada por regra de negócio

  // Drafts desativados: sem carregamento de drafts

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setHasChanges(false);
      setIsInitialized(false);
      setInitialFormData(null);
      setPfInitial(null);
    }
  }, [open]);

  // Carregar Applicants (primário) e PF (pf_fichas_test) e mapear para o form
  useEffect(() => {
    (async () => {
      try {
        if (!open) return;
        // Resolver applicant_id: usar prop se disponível; senão buscar via kanban_cards
        let finalApplicantId: string | undefined = applicantId;
        if (!finalApplicantId && applicationId) {
          const { data: kc } = await (supabase as any)
            .from('kanban_cards')
            .select('applicant_id')
            .eq('id', applicationId)
            .maybeSingle();
          finalApplicantId = (kc as any)?.applicant_id as string | undefined;
        }
        if (!finalApplicantId) return;
        // 1) Carregar Applicants (PRIMÁRIO)
        try {
          const { data: applicant } = await (supabase as any)
            .from('applicants')
            .select('*')
            .eq('id', finalApplicantId)
            .maybeSingle();
          if (applicant) {
            const vencStr = typeof applicant.venc === 'number' && !isNaN(applicant.venc) ? String(applicant.venc) : undefined;
            const carneStr = typeof applicant.carne_impresso === 'boolean'
              ? (applicant.carne_impresso ? 'Sim' : 'Não')
              : undefined;
            const mappedApplicant: Partial<ComercialFormValues> = {
              cliente: {
                nome: applicant.primary_name || '',
                cpf: applicant.cpf_cnpj || '',
                tel: applicant.phone || '',
                whats: applicant.whatsapp || '',
                email: applicant.email || '',
              },
              endereco: {
                end: applicant.address_line || '',
                n: applicant.address_number || '',
                compl: applicant.address_complement || '',
                cep: applicant.cep || '',
                bairro: applicant.bairro || '',
              },
              outras: {
                planoEscolhido: applicant.plano_acesso || '',
                diaVencimento: vencStr as any,
                carneImpresso: carneStr as any,
                svaAvulso: applicant.sva_avulso || '',
                administrativas: {
                  quemSolicitou: applicant.quem_solicitou || '',
                  fone: applicant.telefone_solicitante || '',
                  protocoloMk: applicant.protocolo_mk || '',
                  meio: applicant.meio || undefined,
                }
              },
              infoRelevantes: {
                info: applicant.info_relevantes || '',
                infoMk: applicant.info_mk || '',
                parecerAnalise: applicant.parecer_analise || '',
              },
            };
            setApplicantInitial(mappedApplicant);
          }
        } catch (_) { /* silencioso */ }

        // 2) Carregar PF como complemento
        const { data: pf } = await (supabase as any)
          .from('pf_fichas_test')
          .select('*')
          .eq('applicant_id', finalApplicantId)
          .maybeSingle();
        if (!pf) return;
        const toISO = (d?: string | null) => (d ? String(d) : '');
        const mapped: Partial<ComercialFormValues> = {
          cliente: {
            nasc: toISO(pf.birth_date),
            naturalidade: pf.naturalidade || '',
            uf: pf.uf_naturalidade || '',
            doPs: pf.do_ps || '',
          },
          endereco: {
            cond: pf.cond || '',
            tempo: pf.tempo_endereco || '',
            tipoMoradia: pf.tipo_moradia || undefined,
            tipoMoradiaObs: pf.tipo_moradia_obs || '',
            doPs: pf.endereco_do_ps || '',
          },
          relacoes: {
            unicaNoLote: pf.unica_no_lote || undefined,
            unicaNoLoteObs: pf.unica_no_lote_obs || '',
            comQuemReside: pf.com_quem_reside || '',
            nasOutras: pf.nas_outras || undefined,
            temContrato: pf.tem_contrato || 'Não',
            enviouContrato: pf.enviou_contrato || undefined,
            nomeDe: pf.nome_de || '',
            nomeLocador: pf.nome_locador || '',
            telefoneLocador: pf.telefone_locador || '',
            enviouComprovante: pf.enviou_comprovante || undefined,
            tipoComprovante: pf.tipo_comprovante || undefined,
            nomeComprovante: pf.nome_comprovante || '',
            temInternetFixa: pf.tem_internet_fixa || undefined,
            empresaInternet: pf.empresa_internet || '',
            observacoes: pf.observacoes || '',
          },
          empregoRenda: {
            profissao: pf.profissao || '',
            empresa: pf.empresa || '',
            vinculo: pf.vinculo || '',
            vinculoObs: pf.vinculo_obs || '',
            doPs: pf.emprego_do_ps || '',
          },
          conjuge: {
            estadoCivil: pf.estado_civil || undefined,
            obs: pf.conjuge_obs || '',
            idade: typeof pf.conjuge_idade === 'number' ? String(pf.conjuge_idade) : '',
            nome: pf.conjuge_nome || '',
            telefone: pf.conjuge_telefone || '',
            whatsapp: pf.conjuge_whatsapp || '',
            cpf: pf.conjuge_cpf || '',
            naturalidade: pf.conjuge_naturalidade || '',
            uf: pf.conjuge_uf || '',
            doPs: pf.conjuge_do_ps || '',
          },
          filiacao: {
            pai: { nome: pf.pai_nome || '', reside: pf.pai_reside || '', telefone: pf.pai_telefone || '' },
            mae: { nome: pf.mae_nome || '', reside: pf.mae_reside || '', telefone: pf.mae_telefone || '' },
          },
          referencias: {
            ref1: { nome: pf.ref1_nome || '', parentesco: pf.ref1_parentesco || '', reside: pf.ref1_reside || '', telefone: pf.ref1_telefone || '' },
            ref2: { nome: pf.ref2_nome || '', parentesco: pf.ref2_parentesco || '', reside: pf.ref2_reside || '', telefone: pf.ref2_telefone || '' },
          },
        };
        setPfInitial(mapped);
      } catch (_) { /* silencioso */ }
    })();
  }, [open, applicationId]);

  // Drafts desativados: sem timers de auto-save

  // Map loaded draft data to form format
  const mapDraftToFormData = (draft: any): Partial<ComercialFormValues> => {
    return {
      cliente: {
        nome: draft?.customer_data?.nome || basicInfo.nome,
        cpf: draft?.customer_data?.cpf || basicInfo.cpf,
        nasc: ((): string => {
          const raw = (draft?.customer_data?.nasc ?? basicInfo.nascimento) as unknown;
          if (raw instanceof Date && !isNaN((raw as Date).getTime())) {
            const d = String((raw as Date).getDate()).padStart(2,'0');
            const m = String((raw as Date).getMonth()+1).padStart(2,'0');
            const y = String((raw as Date).getFullYear());
            return `${y}-${m}-${d}`;
          }
          if (typeof raw === 'string') {
            const [d,m,y] = raw.split('/');
            return (d && m && y) ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : '';
          }
          return '';
        })(),
        tel: draft?.customer_data?.tel || basicInfo.telefone,
        whats: draft?.customer_data?.whats || basicInfo.whatsapp || '',
        naturalidade: draft?.customer_data?.naturalidade || basicInfo.naturalidade,
        uf: draft?.customer_data?.uf || basicInfo.uf,
        email: draft?.customer_data?.email || basicInfo.email || '',
        doPs: draft?.customer_data?.doPs || '',
      },
      endereco: {
        end: draft?.address_data?.end || '',
        n: draft?.address_data?.n || '',
        compl: draft?.address_data?.compl || '',
        cep: draft?.address_data?.cep || '',
        bairro: draft?.address_data?.bairro || '',
        cond: draft?.address_data?.cond || '',
        tempo: draft?.address_data?.tempo || '',
        tipoMoradia: draft?.address_data?.tipoMoradia || undefined,
        tipoMoradiaObs: draft?.address_data?.tipoMoradiaObs || '',
        doPs: draft?.address_data?.doPs || '',
      },
      relacoes: {
        unicaNoLote: draft?.household_data?.unicaNoLote || undefined,
        unicaNoLoteObs: draft?.household_data?.unicaNoLoteObs || '',
        comQuemReside: draft?.household_data?.comQuemReside || '',
        nasOutras: draft?.household_data?.nasOutras || undefined,
        temContrato: draft?.household_data?.temContrato || 'Não',
        enviouContrato: draft?.household_data?.enviouContrato || undefined,
        nomeDe: draft?.household_data?.nomeDe || '',
        nomeLocador: draft?.household_data?.nomeLocador || '',
        telefoneLocador: draft?.household_data?.telefoneLocador || '',
        enviouComprovante: draft?.household_data?.enviouComprovante || undefined,
        tipoComprovante: draft?.household_data?.tipoComprovante || undefined,
        nomeComprovante: draft?.household_data?.nomeComprovante || '',
        temInternetFixa: draft?.household_data?.temInternetFixa || undefined,
        empresaInternet: draft?.household_data?.empresaInternet || '',
        observacoes: draft?.household_data?.observacoes || '',
      },
      empregoRenda: {
        profissao: draft?.employment_data?.profissao || '',
        empresa: draft?.employment_data?.empresa || '',
        vinculo: draft?.employment_data?.vinculo || undefined,
        vinculoObs: draft?.employment_data?.vinculoObs || '',
        doPs: draft?.employment_data?.doPs || '',
      },
      conjuge: {
        estadoCivil: draft?.spouse_data?.estadoCivil || undefined,
        obs: draft?.spouse_data?.obs || '',
        nome: draft?.spouse_data?.nome || '',
        telefone: draft?.spouse_data?.telefone || '',
        whatsapp: draft?.spouse_data?.whatsapp || '',
        cpf: draft?.spouse_data?.cpf || '',
        naturalidade: draft?.spouse_data?.naturalidade || '',
        uf: draft?.spouse_data?.uf || '',
        obs2: draft?.spouse_data?.obs2 || '',
        doPs: draft?.spouse_data?.doPs || '',
      },
      spc: draft?.other_data?.spc || '',
      pesquisador: draft?.other_data?.pesquisador || '',
      filiacao: {
        pai: { 
          nome: draft?.other_data?.filiacao?.pai?.nome || '', 
          reside: draft?.other_data?.filiacao?.pai?.reside || '', 
          telefone: draft?.other_data?.filiacao?.pai?.telefone || '' 
        },
        mae: { 
          nome: draft?.other_data?.filiacao?.mae?.nome || '', 
          reside: draft?.other_data?.filiacao?.mae?.reside || '', 
          telefone: draft?.other_data?.filiacao?.mae?.telefone || '' 
        },
      },
      referencias: {
        ref1: { 
          nome: draft?.references_data?.ref1?.nome || '', 
          telefone: draft?.references_data?.ref1?.telefone || '', 
          reside: draft?.references_data?.ref1?.reside || '', 
          parentesco: draft?.references_data?.ref1?.parentesco || '' 
        },
        ref2: { 
          nome: draft?.references_data?.ref2?.nome || '', 
          telefone: draft?.references_data?.ref2?.telefone || '', 
          reside: draft?.references_data?.ref2?.reside || '', 
          parentesco: draft?.references_data?.ref2?.parentesco || '' 
        },
      },
      outras: {
        planoEscolhido: draft?.other_data?.outras?.planoEscolhido || '',
        diaVencimento: draft?.other_data?.outras?.diaVencimento || undefined,
        carneImpresso: draft?.other_data?.outras?.carneImpresso || undefined,
        svaAvulso: draft?.other_data?.outras?.svaAvulso || '',
      },
      infoRelevantes: {
        info: draft?.other_data?.infoRelevantes?.info || '',
        infoMk: draft?.other_data?.infoRelevantes?.infoMk || '',
        parecerAnalise: draft?.other_data?.infoRelevantes?.parecerAnalise || '',
      },
    };
  };

  // Generate transformed form data based on loaded draft or defaults
  const baseDefaults: Partial<ComercialFormValues> = {
    cliente: {
      nome: basicInfo.nome,
      cpf: basicInfo.cpf,
      nasc: ((): string => {
        const raw = basicInfo.nascimento as unknown;
        if (raw instanceof Date && !isNaN((raw as Date).getTime())) {
          const d = String((raw as Date).getDate()).padStart(2,'0');
          const m = String((raw as Date).getMonth()+1).padStart(2,'0');
          const y = String((raw as Date).getFullYear());
          return `${y}-${m}-${d}`;
        }
        if (typeof raw === 'string') {
          const [d,m,y] = raw.split('/');
          return (d && m && y) ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : '';
        }
        return '';
      })(),
      tel: basicInfo.telefone,
      whats: basicInfo.whatsapp || '',
      naturalidade: basicInfo.naturalidade,
      uf: basicInfo.uf,
      email: basicInfo.email || '',
      doPs: '',
    },
    endereco: {
      end: '',
      n: '',
      compl: '',
      cep: '',
      bairro: '',
      cond: '',
      tempo: '',
      tipoMoradia: undefined,
      tipoMoradiaObs: '',
      doPs: '',
    },
    relacoes: {
      unicaNoLote: undefined,
      unicaNoLoteObs: '',
      comQuemReside: '',
      nasOutras: undefined,
      temContrato: 'Não',
      enviouContrato: undefined,
      nomeDe: '',
      nomeLocador: '',
      telefoneLocador: '',
      enviouComprovante: undefined,
      tipoComprovante: undefined,
      nomeComprovante: '',
      temInternetFixa: undefined,
      empresaInternet: '',
      observacoes: '',
    },
    empregoRenda: {
      profissao: '',
      empresa: '',
      vinculo: undefined,
      vinculoObs: '',
      doPs: '',
    },
    conjuge: {
      estadoCivil: undefined,
      obs: '',
      nome: '',
      telefone: '',
      whatsapp: '',
      cpf: '',
      naturalidade: '',
      uf: '',
      obs2: '',
      doPs: '',
    },
    spc: '',
    pesquisador: '',
    filiacao: {
      pai: { nome: '', reside: '', telefone: '' },
      mae: { nome: '', reside: '', telefone: '' },
    },
    referencias: {
      ref1: { nome: '', telefone: '', reside: '', parentesco: '' },
      ref2: { nome: '', telefone: '', reside: '', parentesco: '' },
    },
    outras: {
      planoEscolhido: '',
      diaVencimento: undefined,
      carneImpresso: undefined,
      svaAvulso: '',
    },
    infoRelevantes: {
      info: '',
      infoMk: '',
      parecerAnalise: '',
    },
  };
  // Precedência: Applicants (primário) → PF (complementar) → Defaults
  // Mapeamento direto por seção (sem merge genérico)
  const transformedFormData: Partial<ComercialFormValues> = useMemo(() => {
    const out: any = JSON.parse(JSON.stringify(baseDefaults));
    if (applicantInitial) {
      if (applicantInitial.cliente) out.cliente = { ...out.cliente, ...applicantInitial.cliente };
      if (applicantInitial.endereco) out.endereco = { ...out.endereco, ...applicantInitial.endereco };
      if (applicantInitial.outras) out.outras = { ...out.outras, ...applicantInitial.outras };
      if (applicantInitial.infoRelevantes) out.infoRelevantes = { ...out.infoRelevantes, ...applicantInitial.infoRelevantes };
    }
    if (pfInitial) {
      if (pfInitial.cliente) out.cliente = { ...out.cliente, ...pfInitial.cliente };
      if (pfInitial.endereco) out.endereco = { ...out.endereco, ...pfInitial.endereco };
      if (pfInitial.relacoes) out.relacoes = { ...out.relacoes, ...pfInitial.relacoes };
      if (pfInitial.empregoRenda) out.empregoRenda = { ...out.empregoRenda, ...pfInitial.empregoRenda };
      if (pfInitial.conjuge) out.conjuge = { ...out.conjuge, ...pfInitial.conjuge };
      if (pfInitial.filiacao) out.filiacao = { ...out.filiacao, ...pfInitial.filiacao };
      if (pfInitial.referencias) out.referencias = { ...out.referencias, ...pfInitial.referencias };
    }
    return out as Partial<ComercialFormValues>;
  }, [applicantInitial, pfInitial]);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
        <DialogContent 
          aria-describedby={undefined}
          className={expanded 
            ? "!max-w-none w-[100vw] h-[100vh] sm:rounded-none overflow-hidden gap-0" 
            : "max-w-[1200px] max-h-[95vh] overflow-hidden gap-0"
          }
          onInteractOutside={(e) => e.preventDefault()} // Prevent closing on outside click
        >
          {/* Header com espaçamento otimizado */}
          <DialogHeader className={expanded ? "px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 bg-white" : "px-6 py-4 border-b border-gray-100"}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="/src/assets/Logo MZNET (1).png" 
                  alt="MZNET Logo" 
                  className="h-8 w-auto"
                />
                <DialogTitle className="text-lg sm:text-xl font-semibold text-gray-900">
                  Ficha Comercial - {basicInfo.nome}
                </DialogTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(e => !e)}
                  className="h-8 w-8 p-0 text-[#018942] hover:bg-[#018942]/10"
                  aria-label={expanded ? 'Minimizar' : 'Expandir'}
                  title={expanded ? 'Minimizar' : 'Expandir'}
                >
                  {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-8 w-8 p-0 text-[#018942] hover:bg-[#018942]/10"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          {/* Container principal com espaçamento responsivo otimizado */}
          <div className={expanded 
            ? "flex-1 overflow-hidden px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 bg-white" 
            : "flex-1 overflow-hidden px-6 py-6"
          }>
            <NovaFichaComercialForm
                onSubmit={handleSubmitWrapper}
                initialValues={transformedFormData}
                onFormChange={handleFormChange}
                applicationId={applicationId}
                applicantId={applicantId}
                onExpose={(api) => setFormApi(api)}
                onRefetch={onRefetch}
                hideInternalActions={expanded}
              />
          </div>
           {expanded && (
             <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 sm:px-6 md:px-8 py-3 flex items-center justify-end">
               <Button
                 className="bg-[#018942] hover:bg-[#018942]/90 text-white"
                 onClick={async () => {
                   try {
                     if (!formApi) return;
                     await formApi.flushAutosave?.();
                     const values = formApi.getCurrentValues();
                     await handleSubmitWrapper(values);
                   } catch (_) {}
                 }}
               >
                 Salvar Alterações
               </Button>
             </div>
           )}
        </DialogContent>
      </Dialog>

      {/* First confirmation dialog */}
      <AlertDialog open={showFirstConfirmDialog} onOpenChange={setShowFirstConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você deseja alterar as informações dessa ficha?</AlertDialogTitle>
            <AlertDialogDescription>
              As alterações serão aplicadas permanentemente à ficha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardChanges} className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700">
              Descartar alterações
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleFirstConfirm} className="bg-[#018942] hover:bg-[#018942]/90 text-white border-[#018942] hover:border-[#018942]/90">
              Sim, alterar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Second confirmation dialog */}
      <AlertDialog open={showSecondConfirmDialog} onOpenChange={setShowSecondConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja alterar as informações?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowSecondConfirmDialog(false);
              setPendingAction(null);
            }} className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500 hover:border-gray-600">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSecondConfirm} className="bg-[#018942] hover:bg-[#018942]/90 text-white border-[#018942] hover:border-[#018942]/90">
              Confirmar alteração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exclusão de pareceres removida */}
    </>
  );
}
