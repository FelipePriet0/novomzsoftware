import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import NovaFichaComercialForm, { ComercialFormValues } from '@/components/NovaFichaComercialForm';
import { BasicInfoData } from './BasicInfoModal';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDraftForm } from '@/hooks/useDraftForm';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, SaveIcon, CheckIcon, X } from 'lucide-react';
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
  onStatusChange?: (cardId: string, newStatus: string) => void;
  onRefetch?: () => void;
}

export function ExpandedFichaModal({ 
  open, 
  onClose, 
  onSubmit, 
  basicInfo,
  applicationId,
  onStatusChange,
  onRefetch
}: ExpandedFichaModalProps) {
  const { isAutoSaving, lastSaved, saveDraft, clearEditingSession } = useDraftForm();
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [showFirstConfirmDialog, setShowFirstConfirmDialog] = useState(false);
  const [showSecondConfirmDialog, setShowSecondConfirmDialog] = useState(false);
  const [formData, setFormData] = useState<ComercialFormValues | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [pendingAction, setPendingAction] = useState<'close' | 'save' | null>(null);
  const [initialFormData, setInitialFormData] = useState<ComercialFormValues | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadedDraftData, setLoadedDraftData] = useState<any>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [lastFormSnapshot, setLastFormSnapshot] = useState<ComercialFormValues | null>(null);
  // Dev-safe CRUD state (test tables)
  const [applicantTestId, setApplicantTestId] = useState<string | null>(null);
  const { savePersonalData } = usePfFichasTestConnection();
  // Removido: fluxo applicants_test (legado)

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
  const SaveStatus = () => {
    if (isAutoSaving) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Salvando...
        </Badge>
      );
    }

    if (lastSaved) {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <CheckIcon className="h-3 w-3 text-green-500" />
          Salvo às {lastSaved.toLocaleTimeString()}
        </Badge>
      );
    }

    return null;
  };

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
    setLastFormSnapshot(formData);
    
    // Only set hasChanges if we're initialized and there are actual changes
    if (isInitialized && initialFormData) {
      setHasChanges(true);
    } else if (!isInitialized) {
      // Store initial form data on first change (after form initialization)
      setInitialFormData(formData);
      setIsInitialized(true);
      setHasChanges(false); // No changes on initialization
    }
    
    // Clear existing timer
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    // Set new timer for auto-save
    const timer = setTimeout(async () => {
      const draftData = {
        customer_data: {
          ...basicInfo,
          ...formData.cliente,
        },
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
      
      if (applicationId) {
        await ensureCommercialFeitas(applicationId);
        await saveDraft(draftData, applicationId, 'full', false);

        // Campos do cliente agora são salvos em applicants, não em kanban_cards
        // (removida atualização redundante de title, phone, email, cpf_cnpj)

        // Atualizar applicants com campos canônicos (whatsapp, endereço, plano/venc/carnê, intake e infos)
        try {
          const { data: kc } = await supabase
            .from('kanban_cards')
            .select('applicant_id')
            .eq('id', applicationId)
            .maybeSingle();
          const aid = (kc as any)?.applicant_id as string | undefined;
          if (aid) {
            const appUpdates: any = {};
            // WhatsApp
            if (formData?.cliente?.whats) appUpdates.whatsapp = formData.cliente.whats;
            // Endereço
            if (formData?.endereco?.end) appUpdates.address_line = formData.endereco.end;
            if (formData?.endereco?.n) appUpdates.address_number = formData.endereco.n;
            if (formData?.endereco?.compl) appUpdates.address_complement = formData.endereco.compl;
            if (formData?.endereco?.cep) appUpdates.cep = formData.endereco.cep;
            if (formData?.endereco?.bairro) appUpdates.bairro = formData.endereco.bairro;
            // Preferências comerciais
            if (formData?.outras?.planoEscolhido) appUpdates.plano_acesso = formData.outras.planoEscolhido;
            if (formData?.outras?.diaVencimento) appUpdates.venc = Number(formData.outras.diaVencimento);
            if (typeof formData?.outras?.carneImpresso !== 'undefined') {
              appUpdates.carne_impresso = formData.outras.carneImpresso === 'Sim' ? true : formData.outras.carneImpresso === 'Não' ? false : null;
            }
            if (formData?.outras?.svaAvulso) appUpdates.sva_avulso = formData.outras.svaAvulso;
            // Intake/solicitação
            if ((formData as any)?.outras?.administrativas?.quemSolicitou) appUpdates.quem_solicitou = (formData as any).outras.administrativas.quemSolicitou;
            if ((formData as any)?.outras?.administrativas?.fone) appUpdates.telefone_solicitante = (formData as any).outras.administrativas.fone;
            if ((formData as any)?.outras?.administrativas?.protocoloMk) appUpdates.protocolo_mk = (formData as any).outras.administrativas.protocoloMk;
            if ((formData as any)?.outras?.administrativas?.meio) appUpdates.meio = (formData as any).outras.administrativas.meio;
            // Informações/Notas
            if (formData?.spc) appUpdates.info_spc = formData.spc;
            if (formData?.pesquisador) appUpdates.info_pesquisador = formData.pesquisador;
            if (formData?.infoRelevantes?.info) appUpdates.info_relevantes = formData.infoRelevantes.info;
            if (formData?.infoRelevantes?.infoMk) appUpdates.info_mk = formData.infoRelevantes.infoMk;
            if (formData?.infoRelevantes?.parecerAnalise) appUpdates.parecer_analise = formData.infoRelevantes.parecerAnalise;
            if (Object.keys(appUpdates).length > 0) {
              await supabase.from('applicants').update(appUpdates).eq('id', aid);
            }
          }
        } catch (_) {}

        // Removido: fluxo experimental de applicants_test/pf_fichas_test (legado)
      }
    }, 300); // Save after 300ms of inactivity (faster debounce)

    setAutoSaveTimer(timer);
  };

  const handleClose = async () => {
    // Se não há alterações, pode fechar direto
    if (!hasChanges) {
      onClose();
      return;
    }

    // Há alterações: abrir fluxo de confirmação em duas etapas
    setPendingAction('close');
    setShowFirstConfirmDialog(true);
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
            await saveDraft(draftData, applicationId, 'full', false);
          // Campos do cliente agora são salvos em applicants, não em kanban_cards
          // (removida atualização redundante de title, phone, email, cpf_cnpj)
          // Atualizar applicants com campos canônicos ao confirmar
          try {
            const { data: kc } = await supabase
              .from('kanban_cards')
              .select('applicant_id')
              .eq('id', applicationId)
              .maybeSingle();
            const aid = (kc as any)?.applicant_id as string | undefined;
            if (aid) {
              const appUpdates: any = {};
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
            }
          } catch (_) {}
          }
          // Chamar fluxo original de submissão do formulário PF
          await onSubmit(formData);
          onRefetch?.();
        } catch (_) {
          // ignore errors, manter UX
        } finally {
          await clearEditingSession();
        }
      }
      onClose();
    }
    
    setPendingAction(null);
  };

  const handleDiscardChanges = async () => {
    await clearEditingSession();
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
      await clearEditingSession();
      // Fechar modal após submissão
      onClose();
    }
  };

  // Deleção de pareceres desativada por regra de negócio

  // Load existing draft data when modal opens
  useEffect(() => {
    const loadExistingDraft = async () => {
      if (open && applicationId) {
        setIsLoadingDraft(true);
        try {
          const { data: draft, error } = await supabase
            .from('applications_drafts')
            .select('*')
            .eq('application_id', applicationId)
            .maybeSingle();

          if (!error && draft) {
            if (import.meta?.env?.DEV) console.log('Loaded existing draft data:', draft);
            setLoadedDraftData(draft);
          } else {
            if (import.meta?.env?.DEV) console.log('No existing draft found for applicationId:', applicationId);
            setLoadedDraftData(null);
          }
        } catch (error) {
          if (import.meta?.env?.DEV) console.error('Error loading draft data:', error);
          setLoadedDraftData(null);
        } finally {
          setIsLoadingDraft(false);
        }
      } else if (open) {
        // Reset state for new applications
        setLoadedDraftData(null);
        setIsLoadingDraft(false);
      }
    };

    loadExistingDraft();
  }, [open, applicationId]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setHasChanges(false);
      setIsInitialized(false);
      setInitialFormData(null);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [autoSaveTimer]);

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
  const transformedFormData: Partial<ComercialFormValues> = loadedDraftData 
    ? mapDraftToFormData(loadedDraftData) 
    : {
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

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
        <DialogContent 
          aria-describedby={undefined}
          className="max-w-[1200px] max-h-[95vh] overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()} // Prevent closing on outside click
        >
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">
                Ficha Comercial - {basicInfo.nome}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <SaveStatus />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-8 w-8 p-0 text-[#018942] hover:bg-[#018942]/0.08"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div
            className="flex-1 overflow-hidden"
            onBlurCapture={async () => {
              if (!applicationId || !lastFormSnapshot) return;
              const formData = lastFormSnapshot;
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
              try {
                await ensureCommercialFeitas(applicationId);
                await saveDraft(draftData, applicationId, 'full', false);
              } catch {}
            }}
          >
            {isLoadingDraft ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Carregando dados da ficha...</span>
              </div>
            ) : (
              <NovaFichaComercialForm
                onSubmit={handleSubmitWrapper}
                initialValues={transformedFormData}
                onFormChange={handleFormChange}
                applicationId={applicationId}
                onRefetch={onRefetch}
              />
            )}
          </div>
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
