import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Trash2, MoreVertical, ArrowLeft } from "lucide-react";
import InputMask from "react-input-mask";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { canEditReanalysis } from "@/lib/access";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { dbg } from "@/lib/debug";
import { useApplicantsTestConnection } from "@/hooks/useApplicantsTestConnection";
import { usePfFichasTestConnection } from "@/hooks/usePfFichasTestConnection";
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

interface Parecer {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  created_at: string;
  text: string;
  updated_by_id?: string;
  updated_by_name?: string;
  updated_at?: string;
  parent_id?: string;
  level?: number;
  thread_id?: string;
  is_thread_starter?: boolean;
}

// Parecer salvo no banco (pode conter metadados auxiliares como deleted)
type NoteRecord = Parecer & { deleted?: boolean };

// Estrutura de campos atualizados (applicants)
type Updates = Record<string, string | number | boolean | null | undefined>;

// Schema
const schema = z.object({
  cliente: z.object({
    nome: z.string().min(1, "Obrigatório"),
    cpf: z.string().min(11, "CPF é obrigatório").max(14, "CPF inválido"),
    nasc: z.string().optional(), // yyyy-mm-dd
    id: z.string().optional(),
    tel: z.string().optional(),
    whats: z.string().optional(),
    doPs: z.string().optional(),
    naturalidade: z.string().optional(),
    uf: z.string().optional(),
    email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  }),
  endereco: z.object({
    end: z.string().optional(),
    n: z.string().optional(),
    compl: z.string().optional(),
    cep: z.string().optional(),
    bairro: z.string().optional(),
    cond: z.string().optional(),
    tempo: z.string().optional(),
    tipoMoradia: z.enum(["Propria", "Alugada", "Cedida", "Outro"]).optional(),
    tipoMoradiaObs: z.string().optional(),
    doPs: z.string().optional(),
  }),
  relacoes: z.object({
    unicaNoLote: z.enum(["Sim", "Não"]).optional(),
    unicaNoLoteObs: z.string().optional(),
    comQuemReside: z.string().optional(),
    nasOutras: z.enum(["Parentes", "Locador(a)", "Só conhecidos", "Não conhece"]).optional(),
    temContrato: z.enum(["Sim", "Não"]).default("Não"),
    enviouContrato: z.enum(["Sim", "Não"]).optional(),
    nomeDe: z.string().optional(),
    nomeLocador: z.string().optional(),
    telefoneLocador: z.string().optional(),
    enviouComprovante: z.enum(["Sim", "Não"]).optional(),
    tipoComprovante: z.enum(["Energia", "Água", "Internet", "Outro"]).optional(),
    nomeComprovante: z.string().optional(),
    temInternetFixa: z.enum(["Sim", "Não"]).optional(),
    empresaInternet: z.string().optional(),
    planoInternet: z.string().optional(),
    valorInternet: z.string().optional(),
    observacoes: z.string().optional(),
  }).superRefine((val, ctx) => {
    if (val.temContrato === "Sim") {
      if (!val.enviouContrato) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["enviouContrato"], message: "Obrigatório" });
      }
      if (!val.nomeDe?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nomeDe"], message: "Obrigatório" });
      }
      if (!val.nomeLocador?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nomeLocador"], message: "Obrigatório" });
      }
    }
    if (val.temInternetFixa === "Sim") {
      if (!val.empresaInternet?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["empresaInternet"], message: "Obrigatório" });
      }
      if (!val.planoInternet?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["planoInternet"], message: "Obrigatório" });
      }
      if (!val.valorInternet?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["valorInternet"], message: "Obrigatório" });
      }
    }
  }),
  empregoRenda: z.object({
    profissao: z.string().optional(),
    empresa: z.string().optional(),
    vinculo: z.enum([
      "Carteira Assinada",
      "Presta Serviços",
      "Contrato de trabalho",
      "Autônomo",
      "Concursado",
      "Outro",
    ]).optional(),
    vinculoObs: z.string().optional(),
    doPs: z.string().optional(),
  }),
  conjuge: z.object({
    estadoCivil: z.enum(["Solteiro(a)", "Casado(a)", "Amasiado(a)", "Separado(a)", "Viúvo(a)"]).optional(),
    obs: z.string().optional(),
    idade: z.string().optional(),
    nome: z.string().optional(),
    telefone: z.string().optional(),
    whatsapp: z.string().optional(),
    cpf: z.string().optional(),
    naturalidade: z.string().optional(),
    uf: z.string().optional(),
    obs2: z.string().optional(),
    doPs: z.string().optional(),
  }),
  spc: z.string().optional(),
  pesquisador: z.string().optional(),
  filiacao: z.object({
    pai: z.object({ nome: z.string().optional(), reside: z.string().optional(), telefone: z.string().optional() }).optional(),
    mae: z.object({ nome: z.string().optional(), reside: z.string().optional(), telefone: z.string().optional() }).optional(),
  }).optional(),
  referencias: z.object({
    ref1: z.object({ nome: z.string().optional(), parentesco: z.string().optional(), reside: z.string().optional(), telefone: z.string().optional() }).optional(),
    ref2: z.object({ nome: z.string().optional(), parentesco: z.string().optional(), reside: z.string().optional(), telefone: z.string().optional() }).optional(),
  }),
  outras: z.object({
    planoEscolhido: z.string().optional(), // aguardando lista final
    diaVencimento: z.enum(["5", "10", "15", "20", "25"]).optional(),
    carneImpresso: z.enum(["Sim", "Não"]).optional(),
    svaAvulso: z.string().optional(),
    administrativas: z.object({
      quemSolicitou: z.string().optional(),
      meio: z.enum(["Presencial", "Ligação", "WhatsApp"]).optional(),
      fone: z.string().optional(),
      via: z.enum(["Rádio", "Outdoor", "Instagram", "Facebook", "Site", "Indicação", "Já foi cliente"]).optional(),
      data: z.string().optional(),
      protocoloMk: z.string().optional(),
      representanteWbr: z.string().optional(),
    }).optional(),
  }),
  administrativas: z.object({
    quemSolicitou: z.string().optional(),
    meio: z.enum(["Presencial", "Ligação", "WhatsApp"]).optional(),
    fone: z.string().optional(),
    via: z.enum(["Rádio", "Outdoor", "Instagram", "Facebook", "Site", "Indicação", "Já foi cliente"]).optional(),
    data: z.string().optional(),
    protocoloMk: z.string().optional(),
    representanteWbr: z.string().optional(),
  }).optional(),
  infoRelevantes: z.object({
    info: z.string().optional(),
    infoMk: z.string().optional(),
    parecerAnalise: z.string().optional(), // deve permanecer em branco
  }),
});

export type ComercialFormValues = z.infer<typeof schema>;

interface NovaFichaComercialFormProps {
  onSubmit: (data: ComercialFormValues) => Promise<void>;
  onCancel?: () => void;
  initialValues?: Partial<ComercialFormValues>;
  onFormChange?: (data: ComercialFormValues) => void;
  applicationId?: string;
  applicantId?: string;
  onRefetch?: () => void;
  onExpose?: (api: { getCurrentValues: () => ComercialFormValues; flushAutosave: () => Promise<void> }) => void;
  hideInternalActions?: boolean;
  hideHeader?: boolean;
}

export default function NovaFichaComercialForm({ onSubmit, onCancel, initialValues, onFormChange, applicationId, applicantId, onRefetch, onExpose, hideInternalActions, hideHeader }: NovaFichaComercialFormProps) {
  const { name: currentUserName } = useCurrentUser();
  const { profile } = useAuth();
  
  // Plan selector state (PF)
  const [pfPlanCTA, setPfPlanCTA] = React.useState<'CGNAT' | 'DIN' | 'FIXO'>('CGNAT');
  const pfPlans = React.useMemo(() => {
    const base = {
      CGNAT: [
        '100 Mega por R$59,90',
        '250 Mega por R$69,90',
        '500 Mega por R$79,90',
        '1000 Mega (1Gb) por R$99,90',
      ],
      DIN: [
        '100 Mega + IP Dinâmico por R$74,90',
        '250 Mega + IP Dinâmico por R$89,90',
        '500 Mega + IP Dinâmico por R$94,90',
        '1000 Mega (1Gb) + IP Dinâmico por R$114,90',
      ],
      FIXO: [
        '100 Mega + IP Fixo por R$259,90',
        '250 Mega + IP Fixo por R$269,90',
        '500 Mega + IP Fixo por R$279,90',
        '1000 Mega (1Gb) + IP Fixo por R$299,90',
      ],
    } as const;
    return base[pfPlanCTA];
  }, [pfPlanCTA]);
  
  // Hook para conectar com a tabela applicants_test
  const { saveSolicitacaoDataFor, saveAnaliseDataFor, ensureApplicantExists } = useApplicantsTestConnection();
  // Hook para conectar com a tabela pf_fichas_test (usado no autosave mais abaixo)
  const [pareceres, setPareceres] = React.useState<Parecer[]>([]);
  const [newParecerText, setNewParecerText] = React.useState("");
  const [showNewParecerEditor, setShowNewParecerEditor] = React.useState(false);
  const [editingParecerId, setEditingParecerId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState<string>("");
  const [replyingToParecerId, setReplyingToParecerId] = React.useState<string | null>(null);
  const [replyText, setReplyText] = React.useState<string>("");
  const [deletingParecerId, setDeletingParecerId] = React.useState<string | null>(null);
  
  const defaultValues: Partial<ComercialFormValues> = {
    cliente: { nome: "" },
    relacoes: { temContrato: "Não" },
    ...initialValues,
  };

  const form = useForm<ComercialFormValues>({ 
    resolver: zodResolver(schema), 
    defaultValues,
  });

  // Resetar o formulário quando os valores iniciais mudarem (dados carregados do backend)
  React.useEffect(() => {
    // Se initialValues chegar/atualizar, reidratar o form para espelhar o backend
    // Evitar sobrescrever enquanto o usuário digita (isDirty)
    if (initialValues && !form.formState.isDirty) {
      const merged: Partial<ComercialFormValues> = {
        cliente: { nome: "" },
        relacoes: { temContrato: "Não" },
        ...initialValues,
      };
      // react-hook-form aceita DeepPartial; fazemos cast seguro para o tipo do formulário
      form.reset(merged as unknown as ComercialFormValues, { keepDirty: false, keepTouched: false });
    }
  }, [initialValues, applicationId, form.formState.isDirty, form]);

  // Initialize pareceres from existing data
  React.useEffect(() => {
    const existing = initialValues?.infoRelevantes?.parecerAnalise;
    if (existing && existing.trim()) {
      try {
        const parsed = JSON.parse(existing);
        if (Array.isArray(parsed)) setPareceres(parsed);
        else setPareceres([{ id: crypto.randomUUID(), author_id: 'legacy', author_name: 'Sistema', author_role: 'analista', created_at: new Date().toISOString(), text: existing }]);
      } catch {
        setPareceres([{ id: crypto.randomUUID(), author_id: 'legacy', author_name: 'Sistema', author_role: 'analista', created_at: new Date().toISOString(), text: existing }]);
      }
    }
  }, [initialValues?.infoRelevantes?.parecerAnalise]);

  // Load pareceres from kanban_cards on mount (source of truth)
  const loadPareceres = React.useCallback(async () => {
    if (!applicationId) return;
    try {
      // @ts-expect-error - 'kanban_cards' não está no types.ts gerado
      const { data, error } = await supabase
        .from('kanban_cards')
        .select('reanalysis_notes')
        .eq('id', applicationId)
        .maybeSingle();
      if (error) return;
      let notes: NoteRecord[] = [];
      if (data?.reanalysis_notes) {
        if (Array.isArray(data.reanalysis_notes)) notes = data.reanalysis_notes as NoteRecord[];
        else if (typeof data.reanalysis_notes === 'string') {
          try { notes = (JSON.parse(data.reanalysis_notes) as NoteRecord[]) || []; } catch { /* invalid JSON from legacy */ }
        }
      }
      
      // Migrar pareceres antigos que não têm estrutura hierárquica
      const migratedNotes = (Array.isArray(notes) ? notes : []).map((parecer: NoteRecord) => {
        // Se não tem estrutura hierárquica, adicionar
        if (!parecer.thread_id || parecer.level === undefined) {
          return {
            ...parecer,
            parent_id: parecer.parent_id || null,
            level: parecer.level || 0,
            thread_id: parecer.thread_id || crypto.randomUUID(),
            is_thread_starter: parecer.is_thread_starter !== undefined ? parecer.is_thread_starter : true
          };
        }
        return parecer;
      });
      
      // Filtrar pareceres deletados (soft delete)
      const activePareceres = migratedNotes.filter((p: NoteRecord) => !p.deleted);
      dbg('realtime', 'Pareceres carregados', { total: migratedNotes.length, ativos: activePareceres.length });
      setPareceres(activePareceres);
    } catch {
      // ignore errors loading notes
    }
  }, [applicationId]);

  React.useEffect(() => {
    loadPareceres();
  }, [loadPareceres]);

  // =============================
  // Autosave (debounced) como Editar Ficha
  // =============================
  const [resolvedApplicantId, setResolvedApplicantId] = React.useState<string | null>(applicantId || null);
  const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastApplicantsSavedRef = React.useRef<Updates | null>(null);
  const lastPFSavedRef = React.useRef<string | null>(null);
  const { savePersonalData } = usePfFichasTestConnection();

  // Resolver applicant_id: preferir prop applicantId; fallback para kanban_cards
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (applicantId) { setResolvedApplicantId(applicantId); return; }
        if (!applicationId) { setResolvedApplicantId(null); return; }
        // @ts-expect-error - 'kanban_cards' não está no types.ts gerado
        const { data, error } = await supabase
          .from('kanban_cards')
          .select('applicant_id')
          .eq('id', applicationId)
          .maybeSingle();
        if (error) throw error;
        const row = data as unknown as { applicant_id?: string } | null;
        if (active) setResolvedApplicantId(row?.applicant_id || null);
      } catch {
        if (active) setResolvedApplicantId(null);
      }
    })();
    return () => { active = false; };
  }, [applicationId, applicantId]);

  // Log de diagnóstico do applicantId efetivo
  React.useEffect(() => {
    if (import.meta.env.DEV) console.log('[NovaFicha][DEBUG] resolvedApplicantId =', resolvedApplicantId);
  }, [resolvedApplicantId]);

  // Helpers: construir objeto de updates para applicants a partir do form
  const buildApplicantsUpdates = React.useCallback((values: ComercialFormValues) => {
    const updates: Updates = {};
    // Cliente
    if (values?.cliente?.nome !== undefined) updates.primary_name = values.cliente.nome?.trim() || null;
    if (values?.cliente?.cpf !== undefined) {
      const digits = (values.cliente.cpf || '').replace(/\D+/g, '');
      updates.cpf_cnpj = digits || null;
    }
    if (values?.cliente?.tel !== undefined) updates.phone = values.cliente.tel || null;
    if (values?.cliente?.whats !== undefined) updates.whatsapp = values.cliente.whats || null;
    if (values?.cliente?.email !== undefined) updates.email = values.cliente.email || null;
    // Endereço
    if (values?.endereco?.end !== undefined) updates.address_line = values.endereco.end || null;
    if (values?.endereco?.n !== undefined) updates.address_number = values.endereco.n || null;
    if (values?.endereco?.compl !== undefined) updates.address_complement = values.endereco.compl || null;
    if (values?.endereco?.bairro !== undefined) updates.bairro = values.endereco.bairro || null;
    if (values?.endereco?.cep !== undefined) updates.cep = values.endereco.cep || null;
    // Preferências comerciais
    if (values?.outras?.planoEscolhido !== undefined) updates.plano_acesso = values.outras.planoEscolhido || null;
    if (values?.outras?.diaVencimento !== undefined) updates.venc = values.outras.diaVencimento ? Number(values.outras.diaVencimento) : null;
    if (values?.outras?.carneImpresso !== undefined) updates.carne_impresso = values.outras.carneImpresso === 'Sim' ? true : values.outras.carneImpresso === 'Não' ? false : null;
    if (values?.outras?.svaAvulso !== undefined) updates.sva_avulso = values.outras.svaAvulso || null;
    // Administrativas
    const adm = (values as unknown as { outras?: { administrativas?: { quemSolicitou?: string; fone?: string; protocoloMk?: string; meio?: string } } })?.outras?.administrativas;
    if (adm) {
      if (adm.quemSolicitou !== undefined) updates.quem_solicitou = adm.quemSolicitou || null;
      if (adm.fone !== undefined) updates.telefone_solicitante = adm.fone || null;
      if (adm.protocoloMk !== undefined) updates.protocolo_mk = adm.protocoloMk || null;
      if (adm.meio !== undefined) updates.meio = adm.meio || null;
    }
    // Informações relevantes
    if (values?.spc !== undefined) updates.info_spc = values.spc || null;
    if (values?.pesquisador !== undefined) updates.info_pesquisador = values.pesquisador || null;
    if (values?.infoRelevantes?.info !== undefined) updates.info_relevantes = values.infoRelevantes.info || null;
    if (values?.infoRelevantes?.infoMk !== undefined) updates.info_mk = values.infoRelevantes.infoMk || null;
    return updates;
  }, []);

  // Helpers: extrair fatia PF relevante para diff
  const pickPfSlice = React.useCallback((values: ComercialFormValues) => {
    return {
      cliente: {
        nasc: values?.cliente?.nasc || '',
        naturalidade: values?.cliente?.naturalidade || '',
        uf: values?.cliente?.uf || '',
        doPs: values?.cliente?.doPs || '',
      },
      endereco: {
        cond: values?.endereco?.cond || '',
        tempo: values?.endereco?.tempo || '',
        tipoMoradia: values?.endereco?.tipoMoradia || '',
        tipoMoradiaObs: values?.endereco?.tipoMoradiaObs || '',
        doPs: values?.endereco?.doPs || '',
      },
      relacoes: {
        unicaNoLote: values?.relacoes?.unicaNoLote || '',
        unicaNoLoteObs: values?.relacoes?.unicaNoLoteObs || '',
        comQuemReside: values?.relacoes?.comQuemReside || '',
        nasOutras: values?.relacoes?.nasOutras || '',
        temContrato: values?.relacoes?.temContrato || '',
        enviouContrato: values?.relacoes?.enviouContrato || '',
        nomeDe: values?.relacoes?.nomeDe || '',
        nomeLocador: values?.relacoes?.nomeLocador || '',
        telefoneLocador: values?.relacoes?.telefoneLocador || '',
        enviouComprovante: values?.relacoes?.enviouComprovante || '',
        tipoComprovante: values?.relacoes?.tipoComprovante || '',
        nomeComprovante: values?.relacoes?.nomeComprovante || '',
        temInternetFixa: values?.relacoes?.temInternetFixa || '',
        empresaInternet: values?.relacoes?.empresaInternet || '',
        planoInternet: values?.relacoes?.planoInternet || '',
        valorInternet: values?.relacoes?.valorInternet || '',
        observacoes: values?.relacoes?.observacoes || '',
      },
      empregoRenda: {
        profissao: values?.empregoRenda?.profissao || '',
        empresa: values?.empregoRenda?.empresa || '',
        vinculo: values?.empregoRenda?.vinculo || '',
        vinculoObs: values?.empregoRenda?.vinculoObs || '',
        doPs: values?.empregoRenda?.doPs || '',
      },
      conjuge: {
        estadoCivil: values?.conjuge?.estadoCivil || '',
        obs: values?.conjuge?.obs || '',
        idade: values?.conjuge?.idade || '',
        nome: values?.conjuge?.nome || '',
        telefone: values?.conjuge?.telefone || '',
        whatsapp: values?.conjuge?.whatsapp || '',
        cpf: values?.conjuge?.cpf || '',
        naturalidade: values?.conjuge?.naturalidade || '',
        uf: values?.conjuge?.uf || '',
        doPs: values?.conjuge?.doPs || '',
      },
      filiacao: {
        pai: {
          nome: values?.filiacao?.pai?.nome || '',
          reside: values?.filiacao?.pai?.reside || '',
          telefone: values?.filiacao?.pai?.telefone || '',
        },
        mae: {
          nome: values?.filiacao?.mae?.nome || '',
          reside: values?.filiacao?.mae?.reside || '',
          telefone: values?.filiacao?.mae?.telefone || '',
        },
      },
      referencias: {
        ref1: {
          nome: values?.referencias?.ref1?.nome || '',
          parentesco: values?.referencias?.ref1?.parentesco || '',
          reside: values?.referencias?.ref1?.reside || '',
          telefone: values?.referencias?.ref1?.telefone || '',
        },
        ref2: {
          nome: values?.referencias?.ref2?.nome || '',
          parentesco: values?.referencias?.ref2?.parentesco || '',
          reside: values?.referencias?.ref2?.reside || '',
          telefone: values?.referencias?.ref2?.telefone || '',
        },
      },
    };
  }, []);

  // Inicializar refs de comparação quando applicantId for resolvido
  React.useEffect(() => {
    if (!resolvedApplicantId) return;
    const current = form.getValues();
    lastApplicantsSavedRef.current = buildApplicantsUpdates(current as ComercialFormValues);
    lastPFSavedRef.current = JSON.stringify(pickPfSlice(current as ComercialFormValues));
  }, [resolvedApplicantId, buildApplicantsUpdates, pickPfSlice, form]);

  // Função de flush (executa o autosave imediatamente)
  const flushAutosave = React.useCallback(async () => {
    if (!resolvedApplicantId) return;
    try {
      const v = form.getValues();
      const candidate = buildApplicantsUpdates(v as ComercialFormValues);
      const last: Updates = lastApplicantsSavedRef.current || {};
      const diff: Updates = {};
      for (const k of Object.keys(candidate)) {
        const prev = last[k];
        const next = candidate[k];
        if (prev !== next) diff[k] = next;
      }
      if (Object.keys(diff).length > 0) {
        await supabase.from('applicants').update(diff).eq('id', resolvedApplicantId);
        lastApplicantsSavedRef.current = { ...last, ...diff };
        // Verbose autosave diff (opt-in)
        dbg('autosave', 'Applicants diff', diff);
      }
      const pfSliceStr = JSON.stringify(pickPfSlice(v as ComercialFormValues));
      if (pfSliceStr !== lastPFSavedRef.current) {
        try {
          // savePersonalData aceita estrutura compatível com ComercialFormValues
          await savePersonalData(resolvedApplicantId, v as unknown as Parameters<typeof savePersonalData>[1]);
          lastPFSavedRef.current = pfSliceStr;
          dbg('autosave', 'PF saved for applicant');
        } catch (e) {
          if (import.meta.env.DEV) console.error('[NovaFicha][DEBUG][FLUSH] PF save error:', e);
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('[NovaFicha][DEBUG][FLUSH] error:', e);
    }
  }, [resolvedApplicantId, form, buildApplicantsUpdates, pickPfSlice, savePersonalData]);

  // Expor API para o modal (get values + flush)
  React.useEffect(() => {
    if (onExpose) {
      onExpose({
        getCurrentValues: () => form.getValues(),
        flushAutosave,
      });
    }
  }, [onExpose, form, flushAutosave]);

  // Watch e autosave (debounced)
  React.useEffect(() => {
    const subscription = form.watch(() => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(async () => {
        await flushAutosave();
      }, 700);
    });
    return () => subscription.unsubscribe();
  }, [form, flushAutosave]);

  

  // 🔴 REALTIME: Sincronizar pareceres quando o card for atualizado
  React.useEffect(() => {
    if (!applicationId) return;
    dbg('realtime', 'Configurar pareceres Realtime');
    
    const channel = supabase
      .channel(`pareceres-nova-ficha-${applicationId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kanban_cards', filter: `id=eq.${applicationId}` },
        () => { loadPareceres(); }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          dbg('realtime', 'Pareceres Realtime error');
        }
      });
    
    return () => {
      dbg('realtime', 'Remover pareceres Realtime');
      supabase.removeChannel(channel);
    };
  }, [applicationId, loadPareceres]);

  // Sync pareceres with form (kept for compatibility)
  React.useEffect(() => {
    const serialized = JSON.stringify(pareceres);
    form.setValue('infoRelevantes.parecerAnalise', serialized, { shouldValidate: false });
  }, [pareceres, form]);

  const addNovoParecer = async () => {
    const text = newParecerText.trim();
    if (!text) return;
    const roleLabel = profile?.role ? String(profile.role) : 'colaborador';
    const newParecer: Parecer = {
      id: crypto.randomUUID(),
      author_id: profile?.id || 'current-user-id',
      author_name: currentUserName,
      author_role: roleLabel,
      created_at: new Date().toISOString(),
      text,
      parent_id: null,
      level: 0,
      thread_id: crypto.randomUUID(),
      is_thread_starter: true
    };
    // Fetch current notes from DB to avoid overwriting
    let currentNotes: NoteRecord[] = [];
    if (applicationId) {
      const { data } = await supabase
        .from('kanban_cards')
        .select('reanalysis_notes')
        .eq('id', applicationId)
        .maybeSingle();
      const raw = (data as { reanalysis_notes?: NoteRecord[] | string | null } | null)?.reanalysis_notes;
      if (Array.isArray(raw)) currentNotes = raw as NoteRecord[];
      else if (typeof raw === 'string') { try { currentNotes = (JSON.parse(raw) as NoteRecord[]) || []; } catch { /* invalid JSON */ }
      }
    }
    
    // ✅ IMPORTANTE: Manter pareceres deletados no banco (soft delete) para histórico
    // mas adicionar o novo parecer à lista completa
    const next = [...currentNotes, newParecer];
    
    // ✅ Para a UI, mostrar apenas pareceres ativos (sem deleted)
    const activePareceres = next.filter((p: NoteRecord) => !p.deleted);
    setPareceres(activePareceres);
    
    setNewParecerText("");

    // ✅ Salvar lista COMPLETA (incluindo deletados para histórico)
    const serialized = JSON.stringify(next);
    if (applicationId) {
      try {
        if (import.meta.env.DEV) console.log('➕ [NovaFicha] Adicionando novo parecer ao banco:', newParecer.id);
        const { error } = await supabase
          .from('kanban_cards')
          .update({ reanalysis_notes: serialized })
          .eq('id', applicationId);
        if (error) throw error;
        if (import.meta.env.DEV) console.log('✅ [NovaFicha] Parecer adicionado com sucesso! Realtime vai sincronizar outros modais.');
        // 🔔 Notificações de menções: procurar @nome e inserir na inbox de mencionados
        try {
          // Resolver título do card (nome/razão social)
          let cardTitle = 'Cliente';
          let applicantId: string | null = null;
          try {
            // @ts-expect-error - 'kanban_cards' não está no types.ts gerado
            const { data: kc } = await supabase
              .from('kanban_cards')
              .select('applicant:applicant_id(id, primary_name)')
              .eq('id', applicationId)
              .maybeSingle();
            const appRef = kc as unknown as { applicant?: { id?: string; primary_name?: string } } | null;
            cardTitle = appRef?.applicant?.primary_name || 'Cliente';
            applicantId = appRef?.applicant?.id || null;
          } catch (err) {
            if (import.meta.env.DEV) console.error('Falha ao carregar título do card', err);
          }

          const matches = Array.from(text.matchAll(/@(\w+)/g)).map(m => m[1]);
          const unique = Array.from(new Set(matches));
          
          if (unique.length > 0) {
            // 🚀 OTIMIZAÇÃO: Paralelizar processamento de menções
            const mentionPromises = unique.map(async (mention) => {
              try {
                const { data: profiles } = await supabase
                  .from('profiles')
                  .select('id, full_name')
                  .ilike('full_name', `${mention}%`)
                  .limit(5);
                
                const targets = (profiles || [])
                  .map((p: { id: string }) => p.id)
                  .filter((id: string) => id && id !== (profile?.id || ''));
                
                // 🚀 Paralelizar inserts de notificações
                if (targets.length > 0) {
                  await Promise.all(
                    targets.map((userId: string) =>
                      supabase.from('inbox_notifications').insert({
                        user_id: userId,
                        type: 'mention',
                        priority: 'low',
                        title: `${currentUserName || profile?.full_name || 'Colaborador'} mencionou você em um Parecer`,
                        body: `${cardTitle}\n${String(text).replace(/\s+/g,' ').slice(0,140)}`,
                        applicant_id: applicantId || undefined,
                        meta: { cardId: applicationId, applicantId, parecerId: newParecer.id },
                        transient: false,
                      })
                    )
                  );
                }
              } catch (err) {
                // Falha em uma menção não deve quebrar o salvamento
                if (import.meta.env.DEV) console.error('Erro ao processar menção:', mention, err);
              }
            });
            
            await Promise.all(mentionPromises);
          }
        } catch (_) { /* silencioso */ }
        
        // 🧪 TESTE: Comentado temporariamente para verificar se Realtime sincroniza sozinho
        // Se pareceres não aparecerem em outros modais, descomentar esta linha
        // if (onRefetch) {
        //   onRefetch();
        // }
      } catch (e: unknown) {
        console.error('❌ [NovaFicha] Erro ao adicionar parecer:', e);
        const desc = (e as { message?: string })?.message || String(e);
        toast({ title: 'Erro ao salvar parecer', description: desc, variant: 'destructive' });
      }
    }
  };

  const updateParecerText = (id: string, text: string) => {
    setPareceres(prev => prev.map(p => p.id === id ? { ...p, text } : p));
  };

  // Exclusão de pareceres desabilitada

  const startEditParecer = (id: string, currentText: string) => {
    setEditingParecerId(id);
    setEditingText(currentText);
  };

  const cancelEditParecer = () => {
    setEditingParecerId(null);
    setEditingText("");
  };

  const saveEditParecer = async () => {
    if (!editingParecerId) return;
    const text = editingText.trim();
    if (!text) return;
    // Only the creator can edit; merge with DB to avoid overwriting others
    const currentUserId = profile?.id || 'current-user-id';
    let base: NoteRecord[] = [];
    if (applicationId) {
      const { data } = await supabase
        .from('kanban_cards')
        .select('reanalysis_notes')
        .eq('id', applicationId)
        .maybeSingle();
      const raw = (data as { reanalysis_notes?: NoteRecord[] | string | null } | null)?.reanalysis_notes;
      if (Array.isArray(raw)) base = raw as NoteRecord[];
      else if (typeof raw === 'string') { try { base = (JSON.parse(raw) as NoteRecord[]) || []; } catch { /* invalid JSON */ }
      }
    }
    const source = base.length ? base : pareceres;
    
    // ✅ Editar na lista completa (incluindo deletados)
    const updated = source.map((p: NoteRecord) => {
      if (p.id !== editingParecerId) return p;
      if (p.author_id !== currentUserId) return p; // guard
      return {
        ...p,
        text,
        updated_by_id: currentUserId,
        updated_by_name: currentUserName,
        updated_at: new Date().toISOString(),
      };
    });
    
    // ✅ Para a UI, mostrar apenas pareceres ativos (sem deleted)
    const activePareceres = updated.filter((p: NoteRecord) => !p.deleted);
    setPareceres(activePareceres);
    
    setEditingParecerId(null);
    setEditingText("");

    // ✅ Salvar lista COMPLETA no banco (incluindo deletados para histórico)
    const serialized = JSON.stringify(updated);
    if (applicationId) {
      try {
        if (import.meta.env.DEV) console.log('✏️ [NovaFicha] Editando parecer no banco:', editingParecerId);
        const { error } = await supabase
          .from('kanban_cards')
          .update({ reanalysis_notes: serialized })
          .eq('id', applicationId);
        if (error) throw error;
        if (import.meta.env.DEV) console.log('✅ [NovaFicha] Parecer editado com sucesso! Realtime vai sincronizar outros modais.');
        
        // Chamar onRefetch para atualizar outros componentes
        if (onRefetch) {
          onRefetch();
        }
      } catch (e: unknown) {
        console.error('❌ [NovaFicha] Erro ao editar parecer:', e);
        const desc = (e as { message?: string })?.message || String(e);
        toast({ title: 'Erro ao editar parecer', description: desc, variant: 'destructive' });
      }
    }
  };

  const canEditParecer = (p: Parecer) => {
    // ✅ VALIDAÇÃO ROBUSTA: Profile deve existir E ter id/role válidos
    if (!profile || !profile.id || !profile.role) {
      if (import.meta?.env?.DEV) console.log('⚠️ canEditParecer (NovaFicha): Profile inválido ou incompleto', profile);
      return false;
    }
    
    // Autor pode editar/excluir seu próprio parecer
    if (p.author_id === profile.id) {
      return true;
    }
    
    // Gestor pode editar/excluir qualquer parecer
    if (profile.role === 'gestor') {
      return true;
    }
    
    return false;
  };
  
  // Funções para encadeamento de pareceres
  const canReplyToParecer = (p: {author_role?: string, level?: number}) => {
    // ✅ VALIDAÇÃO ROBUSTA: Profile deve existir E ter id/role válidos
    if (!profile || !profile.id || !profile.role) {
      if (import.meta?.env?.DEV) console.log('⚠️ canReplyToParecer (NovaFicha): Profile inválido ou incompleto', profile);
      return false;
    }
    
    // Apenas gestores podem responder pareceres, e somente se o nível for menor que 7
    const canReply = profile.role === 'gestor' && (p.level || 0) < 7;
    return canReply;
  };
  
  const getGroupedPareceres = () => {
    const threads = new Map<string, Parecer[]>();
    
    // Agrupar por thread_id
    pareceres.forEach(parecer => {
      const threadId = parecer.thread_id || parecer.id;
      if (!threads.has(threadId)) {
        threads.set(threadId, []);
      }
      threads.get(threadId)!.push(parecer);
    });
    
    // Ordenar cada thread por created_at
    threads.forEach((threadPareceres) => {
      threadPareceres.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    
    return Array.from(threads.values());
  };

  const getThreadColor = (threadId: string) => {
    const colors = [
      'border-blue-500 bg-blue-50',
      'border-green-500 bg-green-50', 
      'border-purple-500 bg-purple-50',
      'border-orange-500 bg-orange-50',
      'border-pink-500 bg-pink-50',
      'border-indigo-500 bg-indigo-50',
      'border-teal-500 bg-teal-50',
      'border-cyan-500 bg-cyan-50'
    ];
    const hash = threadId.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  const startReplyToParecer = (parecerId: string) => {
    setReplyingToParecerId(parecerId);
    setReplyText("");
  };

  const cancelReplyToParecer = () => {
    setReplyingToParecerId(null);
    setReplyText("");
  };

  const saveReplyToParecer = async () => {
    if (!replyingToParecerId || !applicationId) return;
    const text = replyText.trim();
    if (!text) return;
    
    try {
      // Buscar o parecer original
      const parecerOriginal = pareceres.find(p => p.id === replyingToParecerId);
      if (!parecerOriginal) return;
      
      // Criar resposta do gestor
      const respostaGestor: NoteRecord = {
        id: crypto.randomUUID(),
        author_id: profile?.id || 'gestor-id',
        author_name: profile?.full_name || 'Gestor',
        author_role: 'gestor',
        created_at: new Date().toISOString(),
        text: text,
        parent_id: replyingToParecerId,
        level: (parecerOriginal.level || 0) + 1,
        thread_id: parecerOriginal.thread_id || parecerOriginal.id,
        is_thread_starter: false
      };
      
      // Salvar no banco de dados
      let base: NoteRecord[] = [];
      // @ts-expect-error - 'kanban_cards' não está no types.ts gerado
      const { data } = await supabase.from('kanban_cards').select('reanalysis_notes').eq('id', applicationId).maybeSingle();
      const raw = (data as { reanalysis_notes?: NoteRecord[] | string | null } | null)?.reanalysis_notes;
      if (Array.isArray(raw)) base = raw as NoteRecord[];
      else if (typeof raw === 'string') { try { base = (JSON.parse(raw) as NoteRecord[]) || []; } catch { /* invalid JSON */ } }
      
      // ✅ IMPORTANTE: Adicionar resposta à lista completa (incluindo deletados)
      const updated = [...base, respostaGestor];
      
      // ✅ Para a UI, mostrar apenas pareceres ativos (sem deleted)
      const activePareceres = updated.filter((p: NoteRecord) => !p.deleted);
      setPareceres(activePareceres);
      
      // ✅ Salvar lista COMPLETA no banco (incluindo deletados para histórico)
      const serialized = JSON.stringify(updated);
      
      // @ts-expect-error - 'kanban_cards' não está no types.ts gerado
      const { error } = await supabase
        .from('kanban_cards')
        .update({ reanalysis_notes: serialized })
        .eq('id', applicationId);
      
      if (error) throw error;
      // 🔔 Notificações de menções na resposta (Resposta de Parecer)
      try {
        const matches = Array.from(text.matchAll(/@(\w+)/g)).map(m => m[1]);
        const unique = Array.from(new Set(matches));
        if (unique.length > 0) {
          // Resolver título do card
          let cardTitle = 'Cliente';
          try {
            // @ts-expect-error - 'kanban_cards' não está no types.ts gerado
            const { data: kc2 } = await supabase
              .from('kanban_cards')
              .select('applicant:applicant_id(id, primary_name)')
              .eq('id', applicationId)
              .maybeSingle();
            const appRef2 = kc2 as unknown as { applicant?: { id?: string; primary_name?: string } } | null;
            cardTitle = appRef2?.applicant?.primary_name || 'Cliente';
            applicantId = appRef2?.applicant?.id || applicantId;
          } catch (err) {
            if (import.meta.env.DEV) console.error('Falha ao carregar título do card (resposta)', err);
          }
          for (const mention of unique) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name')
              .ilike('full_name', `${mention}%`)
              .limit(5);
            const targets = (profiles || []).map((p: { id: string }) => p.id).filter(Boolean);
            for (const userId of targets) {
              if (userId === (profile?.id || '')) continue;
              // @ts-expect-error - 'inbox_notifications' não está no types.ts gerado
              await supabase
                .from('inbox_notifications')
                  .insert({
                    user_id: userId,
                    type: 'mention',
                    priority: 'low',
                    title: `${currentUserName || profile?.full_name || 'Colaborador'} respondeu o seu Parecer`,
                    body: `${cardTitle}\n${String(text).replace(/\s+/g,' ').slice(0,140)}`,
                    applicant_id: applicantId || undefined,
                    meta: { cardId: applicationId, applicantId, parentParecerId: replyingToParecerId },
                    transient: false,
                  });
            }
          }
        }
      } catch (_) { /* silencioso */ }
      
      // Chamar onRefetch para atualizar outros componentes
      if (onRefetch) {
        onRefetch();
      }
      
      setReplyingToParecerId(null);
      setReplyText("");
      if (import.meta.env.DEV) console.log('✅ [NovaFicha] Resposta salva com sucesso! Realtime vai sincronizar outros modais.');
      toast({ title: 'Resposta salva', description: 'Sua resposta foi adicionada ao parecer.' });
      } catch (error) {
      if (import.meta.env.DEV) console.error('❌ [NovaFicha] Erro ao salvar resposta:', error);
      toast({ title: 'Erro ao salvar resposta', variant: 'destructive' });
    }
  };

  // Funções para exclusão de pareceres
  const handleDeleteParecer = (parecerId: string) => {
    setDeletingParecerId(parecerId);
  };

  const confirmDeleteParecer = async () => {
    if (!deletingParecerId || !applicationId) return;
    
    try {
      // Buscar pareceres atuais do banco
      let currentNotes: NoteRecord[] = [];
      // @ts-expect-error - 'kanban_cards' não está no types.ts gerado
      const { data } = await supabase
        .from('kanban_cards')
        .select('reanalysis_notes')
        .eq('id', applicationId)
        .maybeSingle();
      const raw = (data as { reanalysis_notes?: NoteRecord[] | string | null } | null)?.reanalysis_notes;
      if (Array.isArray(raw)) currentNotes = raw as NoteRecord[];
      else if (typeof raw === 'string') { try { currentNotes = (JSON.parse(raw) as NoteRecord[]) || []; } catch { /* invalid JSON */ } }
      
      // Marcar o parecer como deletado (soft delete)
      const updated = currentNotes.map((p: NoteRecord) => {
        if (p.id === deletingParecerId) {
          return {
            ...p,
            deleted_at: new Date().toISOString(),
            deleted_by: profile?.id,
            deleted: true
          };
        }
        return p;
      });
      const serialized = JSON.stringify(updated);
      
      if (import.meta.env.DEV) console.log('✅ [Comercial] Parecer marcado como deletado (soft delete):', deletingParecerId);
      
      // Preparar dados para update
      const updateData: Updates = { reanalysis_notes: serialized } as unknown as Updates;
      
      // Salvar no banco
      // @ts-expect-error - 'kanban_cards' não está no types.ts gerado
      const { error } = await supabase
        .from('kanban_cards')
        .update(updateData)
        .eq('id', applicationId);
      
      if (error) throw error;
      
      if (import.meta.env.DEV) console.log('💾 [Comercial] Parecer excluído do banco com sucesso!', updateData);
      
      // Atualizar estado local
      setPareceres(prev => prev.filter(p => p.id !== deletingParecerId));
      setDeletingParecerId(null);
      
      // Chamar onRefetch para atualizar outros componentes
      if (onRefetch) {
        onRefetch();
      }
      
      toast({ title: 'Parecer excluído', description: 'O parecer foi removido com sucesso.' });
    } catch (e: unknown) {
      const desc = (e as { message?: string })?.message || String(e);
      toast({ title: 'Erro ao excluir parecer', description: desc, variant: 'destructive' });
    }
  };

  const cancelDeleteParecer = () => {
    setDeletingParecerId(null);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Side effects for contract logic
  const temContrato = form.watch("relacoes.temContrato");
  const enviouContrato = form.watch("relacoes.enviouContrato");
  const nomeDe = form.watch("relacoes.nomeDe");

  React.useEffect(() => {
    if (temContrato === "Sim" && enviouContrato === "Sim") {
      // Sempre setar estes campos
      form.setValue("relacoes.enviouComprovante", "Sim", { shouldValidate: true });
      form.setValue("relacoes.tipoComprovante", "Outro", { shouldValidate: true });
      
      // ✅ Espelhar nomeDe → nomeComprovante apenas quando nomeDe mudar
      if (nomeDe) {
        form.setValue("relacoes.nomeComprovante", nomeDe, { shouldValidate: false });
      }
    }
  }, [temContrato, enviouContrato, nomeDe, form]);

  async function submit(values: ComercialFormValues) {
    // Padronizar: parecer_analise como TEXTO simples
    const lastParecerText = Array.isArray(pareceres) && pareceres.length > 0
      ? (pareceres[pareceres.length - 1]?.text || '')
      : '';
    const currentParecerAnalise = (values.infoRelevantes?.parecerAnalise || '').trim() || lastParecerText;
    
    values.infoRelevantes = {
      info: values.infoRelevantes?.info || "",
      infoMk: values.infoRelevantes?.infoMk || "",
      parecerAnalise: currentParecerAnalise, // Preserve pareceres instead of clearing
    };

    // Removido: fluxo experimental de applicants_test (legado)

    // Atualizar applicants (produção) com campos canônicos se tivermos applicationId
    try {
      if (applicationId) {
        // @ts-expect-error - 'kanban_cards' não está no types.ts gerado
        const { data: kc } = await supabase
          .from('kanban_cards')
          .select('applicant_id')
          .eq('id', applicationId)
          .maybeSingle();
        const aid = (kc as unknown as { applicant_id?: string } | null)?.applicant_id as string | undefined;
        if (aid) {
          const appUpdates: Updates = {};
          // WhatsApp
          if (values?.cliente?.whats) appUpdates.whatsapp = values.cliente.whats;
          // Endereço
          if (values?.endereco?.end) appUpdates.address_line = values.endereco.end;
          if (values?.endereco?.n) appUpdates.address_number = values.endereco.n;
          if (values?.endereco?.compl) appUpdates.address_complement = values.endereco.compl;
          if (values?.endereco?.cep) appUpdates.cep = values.endereco.cep;
          if (values?.endereco?.bairro) appUpdates.bairro = values.endereco.bairro;
          // Preferências comerciais
          if (values?.outras?.planoEscolhido) appUpdates.plano_acesso = values.outras.planoEscolhido;
          if (values?.outras?.diaVencimento) appUpdates.venc = Number(values.outras.diaVencimento);
          if (typeof values?.outras?.carneImpresso !== 'undefined') {
            appUpdates.carne_impresso = values.outras.carneImpresso === 'Sim' ? true : values.outras.carneImpresso === 'Não' ? false : null;
          }
          if (values?.outras?.svaAvulso) appUpdates.sva_avulso = values.outras.svaAvulso;
          // Intake/solicitação
          const adm2 = values?.outras as unknown as { administrativas?: { quemSolicitou?: string; fone?: string; protocoloMk?: string; meio?: string } };
          if (adm2?.administrativas?.quemSolicitou) appUpdates.quem_solicitou = adm2.administrativas.quemSolicitou;
          if (adm2?.administrativas?.fone) appUpdates.telefone_solicitante = adm2.administrativas.fone;
          if (adm2?.administrativas?.protocoloMk) appUpdates.protocolo_mk = adm2.administrativas.protocoloMk;
          if (adm2?.administrativas?.meio) appUpdates.meio = adm2.administrativas.meio;
          // Informações/Notas
          if (values?.spc) appUpdates.info_spc = values.spc;
          if (values?.pesquisador) appUpdates.info_pesquisador = values.pesquisador;
          if (values?.infoRelevantes?.info) appUpdates.info_relevantes = values.infoRelevantes.info;
          if (values?.infoRelevantes?.infoMk) appUpdates.info_mk = values.infoRelevantes.infoMk;
          if (currentParecerAnalise) appUpdates.parecer_analise = currentParecerAnalise;
          if (Object.keys(appUpdates).length > 0) {
            await supabase.from('applicants').update(appUpdates).eq('id', aid);
          }
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('submit() update applicants error', err);
    }

    await onSubmit(values);
  }

  // Watch form changes for auto-save
  const formValues = form.watch();
  React.useEffect(() => {
    if (onFormChange && formValues) {
      // Only call onFormChange if there are actual form changes, not just parecer state changes
      onFormChange(formValues);
    }
  }, [formValues, onFormChange]);

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} autoComplete="off" className="space-y-6 sm:space-y-8 max-h-[70vh] overflow-y-auto mz-form">
        {/* Header com gradiente moderno */}
        {!hideHeader && (
          <div className="bg-gradient-to-br from-[#018942] via-[#016b35] to-[#014d28] text-white rounded-xl p-6 relative overflow-hidden">
            <div className='absolute inset-0 bg-[url("data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")] opacity-20'></div>
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <span className="text-white text-lg font-bold">👤</span>
              </div>
              <div className="flex items-center gap-3">
                <img 
                  src="/src/assets/Logo MZNET (1).png" 
                  alt="MZNET Logo" 
                  className="h-8 w-auto"
                />
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Nova Ficha Comercial - Pessoa Física
                  </h2>
                  <p className="text-green-100 text-sm mt-1">
                    Formulário completo de cadastro e análise
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 1. Dados do Cliente */}
        <section className="bg-gray-50 rounded-xl p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 sm:mb-6 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            1. Dados do Cliente
          </h3>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {/* Linha 1: Nome + CPF + Data de Nascimento + ID */}
            <FormField control={form.control} name="cliente.nome" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Nome</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Nome completo"
                    className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente.cpf" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">CPF *</FormLabel>
                <FormControl>
                  <InputMask
                    mask="999.999.999-99"
                    value={field.value || ""}
                    onChange={field.onChange}
                    maskChar=" "
                  >
                    {(inputProps) => (
                      <Input
                        {...inputProps}
                        placeholder="000.000.000-00"
                        className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                      />
                    )}
                  </InputMask>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente.nasc" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Data de Nascimento</FormLabel>
                <FormControl>
                  <Input
                    placeholder="dd/mm/aaaa"
                    maxLength={10}
                    value={field.value || ''}
                    className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      const p1 = v.slice(0,2);
                      const p2 = v.slice(2,4);
                      const p3 = v.slice(4,8);
                      let out = p1;
                      if (p2) out += '/' + p2;
                      if (p3) out += '/' + p3;
                      field.onChange(out);
                    }}
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente.id" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">ID</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Digite o ID"
                    className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                  />
                </FormControl>
              </FormItem>
            )} />
          </div>
          
          {/* Linha 2: Tel + Whats + Do PS */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-4 sm:mt-6">
            <FormField control={form.control} name="cliente.tel" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Telefone</FormLabel>
                <FormControl>
                  <InputMask
                    mask="(99) 99999-9999"
                    value={field.value || ""}
                    onChange={field.onChange}
                    maskChar=" "
                  >
                    {(inputProps) => (
                      <Input
                        {...inputProps}
                        inputMode="tel"
                        placeholder="(11) 99999-9999"
                        className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                      />
                    )}
                  </InputMask>
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente.whats" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">WhatsApp</FormLabel>
                <FormControl>
                  <InputMask
                    mask="(99) 99999-9999"
                    value={field.value || ""}
                    onChange={field.onChange}
                    maskChar=" "
                  >
                    {(inputProps) => (
                      <Input
                        {...inputProps}
                        inputMode="tel"
                        placeholder="(11) 99999-9999"
                        className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                      />
                    )}
                  </InputMask>
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente.doPs" render={({ field }) => (
              <FormItem>
                <FormLabel>Do PS</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Digite aqui..."
                    className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
              </FormItem>
            )} />
          </div>
          
          {/* Linha 3: Naturalidade + UF + E-mail */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-4 sm:mt-6">
            <FormField control={form.control} name="cliente.naturalidade" render={({ field }) => (
              <FormItem>
                <FormLabel>Naturalidade</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Digite a naturalidade"
                    className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente.uf" render={({ field }) => (
              <FormItem>
                <FormLabel>UF</FormLabel>
                <FormControl>
                  <Input
                    maxLength={2}
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Ex: SP"
                    className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente.email" render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Ex: nome@empresa.com"
                    className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </FormControl>
              </FormItem>
            )} />
          </div>
        </section>

        {/* 2. Endereço */}
        <section className="bg-white rounded-lg border border-gray-100 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">2. Endereço</h3>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <FormField control={form.control} name="endereco.end" render={({ field }) => (
              <FormItem>
                <FormLabel>Endereço (logradouro)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Ex: Rua das Flores"
                    className="placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.n" render={({ field }) => (
              <FormItem>
                <FormLabel>Nº</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="123"
                    className="placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.compl" render={({ field }) => (
              <FormItem>
                <FormLabel>Complemento</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Ex: Apt. 301"
                    className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.cep" render={({ field }) => (
              <FormItem>
                <FormLabel>CEP</FormLabel>
                <FormControl>
                  <InputMask
                    mask="99999-999"
                    value={field.value || ""}
                    onChange={field.onChange}
                    maskChar=" "
                  >
                    {(inputProps) => (
                      <Input
                        {...inputProps}
                        placeholder="12345-678"
                        className="placeholder:text-[#018942] placeholder:opacity-70"
                      />
                    )}
                  </InputMask>
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.bairro" render={({ field }) => (
              <FormItem>
                <FormLabel>Bairro</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Bairro"
                    className="placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.cond" render={({ field }) => (
              <FormItem>
                <FormLabel>Cond</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Ex: Condomínio Jardim Europa"
                    className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.doPs" render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>Do PS</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Digite aqui..."
                    className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.tempo" render={({ field }) => (
              <FormItem>
                <FormLabel>Tempo</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Ex: 2 anos"
                    className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.tipoMoradia" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de moradia</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Propria">Própria</SelectItem>
                    <SelectItem value="Alugada">Alugada</SelectItem>
                    <SelectItem value="Cedida">Cedida</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Se "Outro", descreva em Observações</FormDescription>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.tipoMoradiaObs" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Digite aqui..."
                    className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </FormControl>
              </FormItem>
            )} />
          </div>
        </section>

        {/* 3. Relações de residência */}
        <section className="bg-white rounded-lg border border-gray-100 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">3. Relações de residência</h3>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Linha 1: Única no lote + Obs */}
            <FormField control={form.control} name="relacoes.unicaNoLote" render={({ field }) => (
              <FormItem>
                <FormLabel>Única no lote</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="relacoes.unicaNoLoteObs" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Obs</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ''} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            
            {/* Linha 2: Com quem reside + Nas outras */}
            <FormField control={form.control} name="relacoes.comQuemReside" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Com quem reside</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ''} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="relacoes.nasOutras" render={({ field }) => (
              <FormItem>
                <FormLabel>Nas Outras</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Parentes">Parentes</SelectItem>
                    <SelectItem value="Locador(a)">Locador(a)</SelectItem>
                    <SelectItem value="Só conhecidos">Só conhecidos</SelectItem>
                    <SelectItem value="Não conhece">Não conhece</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            
            {/* Linha 3: Tem contrato + Enviou contrato? (condicional) + Nome de (condicional) */}
            <FormField control={form.control} name="relacoes.temContrato" render={({ field }) => (
              <FormItem className={temContrato === "Sim" ? "" : "md:col-span-3"}>
                <FormLabel>Tem contrato?</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            {temContrato === "Sim" && (
              <>
                <FormField control={form.control} name="relacoes.enviouContrato" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enviou contrato?</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Sim">Sim</SelectItem>
                        <SelectItem value="Não">Não</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="relacoes.nomeDe" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome de</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} autoComplete="off" placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            )}
            
            {/* Linha 4: Enviou comprovante? + Tipo de comprovante + Nome do comprovante (sempre aparecem) */}
            <FormField control={form.control} name="relacoes.enviouComprovante" render={({ field }) => (
              <FormItem>
                <FormLabel>Enviou comprovante?</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="relacoes.tipoComprovante" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de comprovante de endereço</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Energia">Energia</SelectItem>
                    <SelectItem value="Água">Água</SelectItem>
                    <SelectItem value="Internet">Internet</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="relacoes.nomeComprovante" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do comprovante</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ''} autoComplete="off" placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            
            {/* Linha 5: Nome do Locador(a) + Telefone */}
            <FormField control={form.control} name="relacoes.nomeLocador" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Nome do Locador(a)</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ''} autoComplete="off" placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="relacoes.telefoneLocador" render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl><Input inputMode="tel" {...field} value={field.value ?? ''} placeholder="Ex: (11) 99999-0000" className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            
          </div>
          
          {/* Linha 6: Tem internet fixa + Empresa + Plano + Valor (grid de 4 colunas quando Sim) */}
          <div className={`grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 ${form.watch("relacoes.temInternetFixa") === "Sim" ? "lg:grid-cols-4" : "lg:grid-cols-3"} mt-4 sm:mt-6`}>
            <FormField control={form.control} name="relacoes.temInternetFixa" render={({ field }) => (
              <FormItem className={form.watch("relacoes.temInternetFixa") === "Sim" ? "" : "md:col-span-3"}>
                <FormLabel>Tem internet fixa atualmente?</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            {form.watch("relacoes.temInternetFixa") === "Sim" && (
              <>
                <FormField control={form.control} name="relacoes.empresaInternet" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder="Ex: Vivo"
                        className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="relacoes.planoInternet" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plano</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder="Ex: 300MB"
                        className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="relacoes.valorInternet" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: R$ 99,90"
                        className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            )}
          </div>
          
          {/* Linha 7: Observações */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-4 sm:mt-6">
            <FormField control={form.control} name="relacoes.observacoes" render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>Obs</FormLabel>
                <FormControl><Textarea rows={3} {...field} placeholder="Digite aqui..." className="flex w-full rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
          </div>
        </section>

        {/* 4. Emprego e Renda */}
        <section className="bg-white rounded-lg border border-gray-100 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">4. Emprego e Renda</h3>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <FormField control={form.control} name="empregoRenda.profissao" render={({ field }) => (
              <FormItem>
                <FormLabel>Profissão</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="empregoRenda.empresa" render={({ field }) => (
              <FormItem>
                <FormLabel>Empresa</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="empregoRenda.vinculo" render={({ field }) => (
              <FormItem>
                <FormLabel>Vínculo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Carteira Assinada">Carteira Assinada</SelectItem>
                    <SelectItem value="Presta Serviços">Presta Serviços</SelectItem>
                    <SelectItem value="Contrato de trabalho">Contrato de trabalho</SelectItem>
                    <SelectItem value="Autônomo">Autônomo</SelectItem>
                    <SelectItem value="Concursado">Concursado</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="empregoRenda.vinculoObs" render={({ field }) => (
              <FormItem>
                <FormLabel>Obs</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="empregoRenda.doPs" render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>Do PS</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Digite aqui..."
                    className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
              </FormItem>
            )} />
          </div>
        </section>

        {/* 5. Cônjuge */}
        <section className="bg-white rounded-lg border border-gray-100 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">5. Cônjuge</h3>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Linha 1: Estado civil + Obs (Obs com estilo Do PS) */}
            <FormField control={form.control} name="conjuge.estadoCivil" render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>Estado civil</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                    <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                    <SelectItem value="Amasiado(a)">Amasiado(a)</SelectItem>
                    <SelectItem value="Separado(a)">Separado(a)</SelectItem>
                    <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="conjuge.obs" render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>Obs</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Digite aqui..." className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70" />
                </FormControl>
              </FormItem>
            )} />

            {/* Linha 2: Nome (maior) + Telefone + WhatsApp */}
            <FormField control={form.control} name="conjuge.nome" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Nome</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="conjuge.telefone" render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>Telefone</FormLabel>
                <FormControl><Input inputMode="tel" {...field} placeholder="Ex: (11) 99999-0000" className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="conjuge.whatsapp" render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>WhatsApp</FormLabel>
                <FormControl><Input inputMode="tel" {...field} placeholder="Ex: (11) 99999-0000" className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />

            {/* Linha 3: CPF + Naturalidade + UF + Idade */}
            <FormField control={form.control} name="conjuge.cpf" render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>CPF</FormLabel>
                <FormControl><Input {...field} placeholder="000.000.000-00" className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="conjuge.naturalidade" render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>Naturalidade</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="conjuge.uf" render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>UF</FormLabel>
                <FormControl><Input maxLength={2} {...field} placeholder="Ex: MG" className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="conjuge.idade" render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>Idade</FormLabel>
                <FormControl><Input inputMode="numeric" {...field} placeholder="Ex: 35" className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />

            {/* Linha 4: Do PS (full width) */}
            <FormField control={form.control} name="conjuge.doPs" render={({ field }) => (
              <FormItem className="md:col-span-4">
                <FormLabel>Do PS</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Digite aqui..."
                    className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
              </FormItem>
            )} />
          </div>
        </section>

        {/* 6. Informações SPC */}
        <section className="bg-white rounded-lg border border-gray-100 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">6. Informações SPC</h3>
          <FormField control={form.control} name="spc" render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  rows={4}
                  {...field}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Digite aqui..."
                  className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70"
                />
              </FormControl>
            </FormItem>
          )} />
        </section>

        {/* 7. Informações do Pesquisador */}
        <section className="bg-white rounded-lg border border-gray-100 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">7. Informações do Pesquisador</h3>
          <FormField control={form.control} name="pesquisador" render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  rows={4}
                  {...field}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Digite aqui..."
                  className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70"
                />
              </FormControl>
            </FormItem>
          )} />
        </section>

        {/* 8. Filiação */}
        <section className="bg-white rounded-lg border border-gray-100 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">8. Filiação</h3>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <FormField control={form.control} name="filiacao.pai.nome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pai – Nome</FormLabel>
                  <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="filiacao.pai.reside" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pai – Reside</FormLabel>
                  <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="filiacao.pai.telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pai – Telefone</FormLabel>
                  <FormControl><Input inputMode="tel" {...field} placeholder="Ex: (11) 99999-0000" className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="filiacao.mae.nome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mãe – Nome</FormLabel>
                  <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="filiacao.mae.reside" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mãe – Reside</FormLabel>
                  <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="filiacao.mae.telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mãe – Telefone</FormLabel>
                  <FormControl><Input inputMode="tel" {...field} placeholder="Ex: (11) 99999-0000" className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
                </FormItem>
              )} />
            </div>
          </section>

        {/* 9. Referências pessoais */}
        <section className="bg-white rounded-lg border border-gray-100 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">9. Referências pessoais</h3>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <FormField control={form.control} name="referencias.ref1.nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Ref. 1 – Nome</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref1.parentesco" render={({ field }) => (
              <FormItem>
                <FormLabel>Parentesco</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref1.reside" render={({ field }) => (
              <FormItem>
                <FormLabel>Reside</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref1.telefone" render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl><Input inputMode="tel" {...field} placeholder="Ex: (11) 99999-0000" className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref2.nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Ref. 2 – Nome</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref2.parentesco" render={({ field }) => (
              <FormItem>
                <FormLabel>Parentesco</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref2.reside" render={({ field }) => (
              <FormItem>
                <FormLabel>Reside</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref2.telefone" render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl><Input inputMode="tel" {...field} placeholder="Ex: (11) 99999-0000" className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
              </FormItem>
            )} />
          </div>
        </section>

        {/* 10. Outras informações */}
        <section>
          <h3 className="text-lg font-semibold mb-3">10. Outras informações</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <FormField control={form.control} name="outras.planoEscolhido" render={({ field }) => (
              <FormItem>
                <FormLabel>Plano escolhido</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50">
                      <SelectValue placeholder="Selecionar plano" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {/* CTAs verdes dentro do dropdown */}
                    <div className="flex gap-2 px-2 py-1 sticky top-0 bg-white/95 border-b">
                      {([
                        { key: 'CGNAT', label: 'CGNAT' },
                        { key: 'DIN', label: 'DINÂMICO' },
                        { key: 'FIXO', label: 'FIXO' },
                      ] as const).map(({ key, label }) => {
                        const active = pfPlanCTA === key;
                        return (
                          <Button
                            key={key}
                            type="button"
                            variant="outline"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => { e.stopPropagation(); setPfPlanCTA(key); field.onChange(undefined); }}
                            className={
                              (active
                                ? 'bg-[#018942] text-white border-[#018942] hover:bg-[#018942]/90 '
                                : 'border-[#018942] text-[#018942] hover:bg-[#018942]/10 ') +
                              'h-7 px-2 text-xs rounded-[30px]'
                            }
                            size="sm"
                          >
                            {label}
                          </Button>
                        );
                      })}
                    </div>
                    {pfPlans.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="outras.diaVencimento" render={({ field }) => (
              <FormItem>
                <FormLabel>Dia de vencimento</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="outras.svaAvulso" render={({ field }) => (
              <FormItem>
                <FormLabel>SVA Avulso</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="A definir">A definir</SelectItem>
                    <SelectItem value="MZ TV+ (MZPLAY PLUS - ITTV): R$29,90 (01 TELA)">MZ TV+ (MZPLAY PLUS - ITTV): R$29,90 (01 TELA)</SelectItem>
                    <SelectItem value="DEZZER: R$15,00">DEZZER: R$15,00</SelectItem>
                    <SelectItem value="MZ CINE-PLAY: R$19,90">MZ CINE-PLAY: R$19,90</SelectItem>
                    <SelectItem value="SETUP BOX MZNET: R$100,00">SETUP BOX MZNET: R$100,00</SelectItem>
                    <SelectItem value="01 WI-FI EXTEND (SEM FIO): R$25,90">01 WI-FI EXTEND (SEM FIO): R$25,90</SelectItem>
                    <SelectItem value="02 WI-FI EXTEND (SEM FIO): R$49,90">02 WI-FI EXTEND (SEM FIO): R$49,90</SelectItem>
                    <SelectItem value="03 WI-FI EXTEND (SEM FIO): R$74,90">03 WI-FI EXTEND (SEM FIO): R$74,90</SelectItem>
                    <SelectItem value="01 WI-FI EXTEND (CABEADO): R$35,90">01 WI-FI EXTEND (CABEADO): R$35,90</SelectItem>
                    <SelectItem value="02 WI-FI EXTEND (CABEADO): R$69,90">02 WI-FI EXTEND (CABEADO): R$69,90</SelectItem>
                    <SelectItem value="03 WI-FI EXTEND (CABEADO): R$100,00">03 WI-FI EXTEND (CABEADO): R$100,00</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="outras.carneImpresso" render={({ field }) => (
              <FormItem>
                <FormLabel>Carnê impresso?</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </div>

          {/* NOVOS CAMPOS EXPERIMENTAIS - APLICANTS_TEST */}
          <div className="grid gap-3 grid-cols-1 md:grid-cols-4 mt-4">
            <FormField control={form.control} name="outras.administrativas.quemSolicitou" render={({ field }) => (
              <FormItem>
                <FormLabel>Quem Solicitou</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} placeholder="Nome do colaborador" />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="outras.administrativas.fone" render={({ field }) => (
              <FormItem>
                <FormLabel>Tel</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} placeholder="Ex: (11) 99999-0000" />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="outras.administrativas.protocoloMk" render={({ field }) => (
              <FormItem>
                <FormLabel>Protocolo MK</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} placeholder="Número do protocolo" />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="outras.administrativas.meio" render={({ field }) => (
              <FormItem>
                <FormLabel>Meio</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Ligação">Ligação</SelectItem>
                    <SelectItem value="Whatsapp">Whatsapp</SelectItem>
                    <SelectItem value="Presencial">Presencial</SelectItem>
                    <SelectItem value="Whats - Uber">Whats - Uber</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </div>

        </section>


        {/* 12. Informações relevantes */}
        <section>
          <h3 className="text-lg font-semibold mb-3">11. Informações relevantes</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <FormField control={form.control} name="infoRelevantes.info" render={({ field }) => (
              <FormItem>
                <FormLabel>Informações relevantes</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Digite aqui..."
                    className="placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="infoRelevantes.infoMk" render={({ field }) => (
              <FormItem>
                <FormLabel>Informações relevantes do MK</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    {...field}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Digite aqui..."
                    className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
              </FormItem>
            )} />
          </div>
          
          {/* Pareceres Section */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <FormLabel className="text-base font-medium">Pareceres da Análise</FormLabel>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowNewParecerEditor(true)}
                  className="flex items-center gap-2 bg-[#018942] text-white hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(0,0,0,0.25)]"
                >
                  + Adicionar Parecer
                </Button>
              </div>
            </div>
            
            {/* Editor de novo parecer - agora aparece acima dos pareceres existentes */}
            {showNewParecerEditor && (
              <div className="mt-4">
                <Textarea
                  rows={3}
                  value={newParecerText}
                  onChange={(e) => setNewParecerText(e.target.value)}
                  placeholder="Escreva um novo parecer..."
                />
                <div className="flex justify-end mt-2 gap-2">
                  <Button type="button" variant="secondary" onClick={() => { setShowNewParecerEditor(false); setNewParecerText(""); }}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={async () => { await addNovoParecer(); setShowNewParecerEditor(false); }} className="bg-[#018942] text-white">
                    Salvar Parecer
                  </Button>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              {getGroupedPareceres().map((threadPareceres, threadIndex) => {
                const threadId = threadPareceres[0]?.thread_id || threadPareceres[0]?.id;
                const threadColor = getThreadColor(threadId);
                const mainParecer = threadPareceres[0]; // Primeiro parecer é sempre o principal
                
                return (
                  <div key={threadId} className={`rounded-lg border-2 ${threadColor} p-3`}>
                    <div className="space-y-3">
                      {threadPareceres.map((p, index) => {
                        const level = p.level || 0;
                        const indentClass = level > 0 ? `ml-${Math.min(level * 4, 16)} border-l-2 border-gray-300 pl-3` : '';
                        
                        return (
                          <div key={p.id} className={indentClass}>
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTime(p.created_at)}
                                </span>
                                <span className="text-sm font-medium text-gray-900">{p.author_name}</span>
                                {p.author_role && (
                                  <span className="text-xs px-2 py-0.5 bg-gray-200 rounded-full">
                                    {p.author_role}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {/* Botão de Resposta (seta de retorno) - sempre visível para Gestor */}
                                {canReplyToParecer(p) && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      startReplyToParecer(p.id);
                                    }}
                                    className="h-6 w-6 p-0 hover:bg-[#018942]/10 rounded-full"
                                    title="Responder ao parecer (apenas Gestor)"
                                  >
                                    <ArrowLeft className="h-3 w-3 rotate-180 text-[#018942]" />
                                  </Button>
                                )}
                                {/* Botão de Edição (3 pontinhos) - sempre visível para o autor */}
                                {canEditParecer(p) && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-[#018942] hover:bg-[#018942]/10">
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => startEditParecer(p.id, p.text)}>
                                        Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => handleDeleteParecer(p.id)}
                                        className="text-red-600 focus:text-red-600"
                                      >
                                        Excluir
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          
                          {editingParecerId === p.id ? (
                            <div>
                              <Textarea rows={3} value={editingText} onChange={(e) => setEditingText(e.target.value)} className="text-sm text-[#018942]" />
                              <div className="flex justify-end mt-2 gap-2">
                                <Button size="sm" type="button" variant="secondary" onClick={cancelEditParecer} className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500 hover:border-gray-600">Cancelar</Button>
                                <Button size="sm" type="button" onClick={saveEditParecer} className="bg-[#018942] hover:bg-[#018942]/90 text-white border-[#018942] hover:border-[#018942]/90">Salvar</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[13px] whitespace-pre-wrap">{p.text}</div>
                          )}
                          
                          {/* Interface de Resposta */}
                          {replyingToParecerId === p.id && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg border-l-4 border-[#018942]">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 bg-[#018942] rounded-full"></div>
                                <span className="text-sm font-medium text-gray-700">
                                  Respondendo a {p.author_name} ({p.author_role})
                                </span>
                              </div>
                              <MentionableTextarea 
                                rows={3} 
                                value={replyText} 
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Digite sua resposta... Use @ para mencionar"
                                className="text-sm resize-none [&::placeholder]:text-[#018942]"
                                style={{ color: '#018942' }}
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    cancelReplyToParecer();
                                  }}
                                  className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500 hover:border-gray-600"
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    saveReplyToParecer();
                                  }}
                                  disabled={!replyText.trim()}
                                  className="bg-[#018942] hover:bg-[#018942]/90 text-white border-[#018942] hover:border-[#018942]/90 disabled:opacity-50"
                                >
                                  <ArrowLeft className="h-3 w-3 mr-1 rotate-180" />
                                  Responder
                                </Button>
                              </div>
                            </div>
                          )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {pareceres.length === 0 && (
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                  Nenhum parecer adicionado.
                </div>
              )}
            </div>
          </div>
        </section>

        {!hideInternalActions && (
          <div className="flex justify-end pt-6">
            <Button type="submit" className="bg-[#018942] text-white hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(0,0,0,0.25)]">
              {applicationId ? 'Salvar alterações' : 'Criar ficha'}
            </Button>
          </div>
        )}
      </form>
    </Form>

    {/* Confirmação de exclusão de parecer */}
    <AlertDialog open={deletingParecerId !== null} onOpenChange={() => setDeletingParecerId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Parecer</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir este parecer? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelDeleteParecer} className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500 hover:border-gray-600">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={confirmDeleteParecer} className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700">
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
