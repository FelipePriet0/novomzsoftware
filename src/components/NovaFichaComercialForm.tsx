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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Trash2, MoreVertical, ArrowLeft } from "lucide-react";
import InputMask from "react-input-mask";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { canEditReanalysis } from "@/lib/access";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

// Schema
const schema = z.object({
  cliente: z.object({
    nome: z.string().min(1, "Obrigatório"),
    cpf: z.string().min(11, "CPF é obrigatório").max(14, "CPF inválido"),
    nasc: z.string().optional(), // yyyy-mm-dd
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
  onRefetch?: () => void;
}

export default function NovaFichaComercialForm({ onSubmit, onCancel, initialValues, onFormChange, applicationId, onRefetch }: NovaFichaComercialFormProps) {
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
  // Hook para conectar com a tabela pf_fichas_test
  const { savePersonalData } = usePfFichasTestConnection();
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
      const { data, error } = await supabase
        .from('kanban_cards')
        .select('reanalysis_notes')
        .eq('id', applicationId)
        .maybeSingle();
      if (error) return;
      let notes: any[] = [];
      if (data?.reanalysis_notes) {
        if (Array.isArray(data.reanalysis_notes)) notes = data.reanalysis_notes as any[];
        else if (typeof data.reanalysis_notes === 'string') {
          try { notes = JSON.parse(data.reanalysis_notes) || []; } catch {}
        }
      }
      
      // Migrar pareceres antigos que não têm estrutura hierárquica
      const migratedNotes = (Array.isArray(notes) ? notes : []).map(parecer => {
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
      const activePareceres = migratedNotes.filter((p: any) => !p.deleted);
      console.log('📊 [NovaFicha] Pareceres carregados:', migratedNotes.length, 'Ativos:', activePareceres.length);
      setPareceres(activePareceres);
    } catch {
      // ignore
    }
  }, [applicationId]);

  React.useEffect(() => {
    loadPareceres();
  }, [loadPareceres]);

  // 🔴 REALTIME: Sincronizar pareceres quando o card for atualizado
  React.useEffect(() => {
    if (!applicationId) return;
    
    console.log('🔴 [NovaFicha] Configurando Realtime para pareceres do card:', applicationId);
    
    const channel = supabase
      .channel(`pareceres-nova-ficha-${applicationId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kanban_cards', filter: `id=eq.${applicationId}` },
        (payload) => {
          console.log('🔴 [NovaFicha] Card atualizado, recarregando pareceres:', payload);
          loadPareceres();
        }
      )
      .subscribe((status) => {
        console.log('🔴 [NovaFicha] Status da subscrição Realtime de pareceres:', status);
      });
    
    return () => {
      console.log('🔴 [NovaFicha] Removendo subscrição Realtime de pareceres');
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
    let currentNotes: any[] = [];
    if (applicationId) {
      const { data } = await supabase
        .from('kanban_cards')
        .select('reanalysis_notes')
        .eq('id', applicationId)
        .maybeSingle();
      const raw = (data as any)?.reanalysis_notes;
      if (Array.isArray(raw)) currentNotes = raw as any[];
      else if (typeof raw === 'string') { try { currentNotes = JSON.parse(raw) || []; } catch {}
      }
    }
    
    // ✅ IMPORTANTE: Manter pareceres deletados no banco (soft delete) para histórico
    // mas adicionar o novo parecer à lista completa
    const next = [...currentNotes, newParecer];
    
    // ✅ Para a UI, mostrar apenas pareceres ativos (sem deleted)
    const activePareceres = next.filter((p: any) => !p.deleted);
    setPareceres(activePareceres);
    
    setNewParecerText("");

    // ✅ Salvar lista COMPLETA (incluindo deletados para histórico)
    const serialized = JSON.stringify(next);
    if (applicationId) {
      try {
        console.log('➕ [NovaFicha] Adicionando novo parecer ao banco:', newParecer.id);
        const { error } = await supabase
          .from('kanban_cards')
          .update({ reanalysis_notes: serialized })
          .eq('id', applicationId);
        if (error) throw error;
        console.log('✅ [NovaFicha] Parecer adicionado com sucesso! Realtime vai sincronizar outros modais.');
        
        // Chamar onRefetch para atualizar outros componentes
        if (onRefetch) {
          onRefetch();
        }
      } catch (e: any) {
        console.error('❌ [NovaFicha] Erro ao adicionar parecer:', e);
        toast({ title: 'Erro ao salvar parecer', description: e?.message || String(e), variant: 'destructive' });
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
    let base: any[] = [];
    if (applicationId) {
      const { data } = await supabase
        .from('kanban_cards')
        .select('reanalysis_notes')
        .eq('id', applicationId)
        .maybeSingle();
      const raw = (data as any)?.reanalysis_notes;
      if (Array.isArray(raw)) base = raw as any[];
      else if (typeof raw === 'string') { try { base = JSON.parse(raw) || []; } catch {}
      }
    }
    const source = base.length ? base : pareceres;
    
    // ✅ Editar na lista completa (incluindo deletados)
    const updated = source.map((p: any) => {
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
    const activePareceres = updated.filter((p: any) => !p.deleted);
    setPareceres(activePareceres);
    
    setEditingParecerId(null);
    setEditingText("");

    // ✅ Salvar lista COMPLETA no banco (incluindo deletados para histórico)
    const serialized = JSON.stringify(updated);
    if (applicationId) {
      try {
        console.log('✏️ [NovaFicha] Editando parecer no banco:', editingParecerId);
        const { error } = await supabase
          .from('kanban_cards')
          .update({ reanalysis_notes: serialized })
          .eq('id', applicationId);
        if (error) throw error;
        console.log('✅ [NovaFicha] Parecer editado com sucesso! Realtime vai sincronizar outros modais.');
        
        // Chamar onRefetch para atualizar outros componentes
        if (onRefetch) {
          onRefetch();
        }
      } catch (e: any) {
        console.error('❌ [NovaFicha] Erro ao editar parecer:', e);
        toast({ title: 'Erro ao editar parecer', description: e?.message || String(e), variant: 'destructive' });
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
    const threads = new Map<string, any[]>();
    
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
      const respostaGestor = {
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
      let base: any[] = [];
      const { data } = await supabase.from('kanban_cards').select('reanalysis_notes').eq('id', applicationId).maybeSingle();
      const raw = (data as any)?.reanalysis_notes;
      if (Array.isArray(raw)) base = raw as any[];
      else if (typeof raw === 'string') { try { base = JSON.parse(raw) || []; } catch {} }
      
      // ✅ IMPORTANTE: Adicionar resposta à lista completa (incluindo deletados)
      const updated = [...base, respostaGestor];
      
      // ✅ Para a UI, mostrar apenas pareceres ativos (sem deleted)
      const activePareceres = updated.filter((p: any) => !p.deleted);
      setPareceres(activePareceres);
      
      // ✅ Salvar lista COMPLETA no banco (incluindo deletados para histórico)
      const serialized = JSON.stringify(updated);
      
      const { error } = await supabase
        .from('kanban_cards')
        .update({ reanalysis_notes: serialized })
        .eq('id', applicationId);
      
      if (error) throw error;
      
      // Chamar onRefetch para atualizar outros componentes
      if (onRefetch) {
        onRefetch();
      }
      
      setReplyingToParecerId(null);
      setReplyText("");
      console.log('✅ [NovaFicha] Resposta salva com sucesso! Realtime vai sincronizar outros modais.');
      toast({ title: 'Resposta salva', description: 'Sua resposta foi adicionada ao parecer.' });
    } catch (error) {
      console.error('❌ [NovaFicha] Erro ao salvar resposta:', error);
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
      let currentNotes: any[] = [];
      const { data } = await supabase
        .from('kanban_cards')
        .select('reanalysis_notes')
        .eq('id', applicationId)
        .maybeSingle();
      const raw = (data as any)?.reanalysis_notes;
      if (Array.isArray(raw)) currentNotes = raw as any[];
      else if (typeof raw === 'string') { try { currentNotes = JSON.parse(raw) || []; } catch {} }
      
      // Marcar o parecer como deletado (soft delete)
      const updated = currentNotes.map((p: any) => {
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
      
      console.log('✅ [Comercial] Parecer marcado como deletado (soft delete):', deletingParecerId);
      
      // Preparar dados para update
      const updateData: any = { reanalysis_notes: serialized };
      
      // Salvar no banco
      const { error } = await supabase
        .from('kanban_cards')
        .update(updateData)
        .eq('id', applicationId);
      
      if (error) throw error;
      
      console.log('💾 [Comercial] Parecer excluído do banco com sucesso!', updateData);
      
      // Atualizar estado local
      setPareceres(prev => prev.filter(p => p.id !== deletingParecerId));
      setDeletingParecerId(null);
      
      // Chamar onRefetch para atualizar outros componentes
      if (onRefetch) {
        onRefetch();
      }
      
      toast({ title: 'Parecer excluído', description: 'O parecer foi removido com sucesso.' });
    } catch (e: any) {
      toast({ title: 'Erro ao excluir parecer', description: e?.message || String(e), variant: 'destructive' });
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
      form.setValue("relacoes.enviouComprovante", "Sim", { shouldValidate: true });
      form.setValue("relacoes.tipoComprovante", "Outro", { shouldValidate: true });
      if (nomeDe) {
        form.setValue("relacoes.nomeComprovante", nomeDe, { shouldValidate: false });
      }
    }
  }, [temContrato, enviouContrato, nomeDe, form]);

  // Age < 45 -> show filiacao
  const nasc = form.watch("cliente.nasc");
  const showFiliacao = React.useMemo(() => {
    if (!nasc) {
      console.log("🔍 [Filiação] Data de nascimento não preenchida");
      return false;
    }
    const parts = String(nasc).split('/');
    if (parts.length !== 3) {
      console.log("🔍 [Filiação] Formato de data inválido:", nasc);
      return false;
    }
    const [dd, mm, yyyy] = parts;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (isNaN(d.getTime())) {
      console.log("🔍 [Filiação] Data inválida:", nasc);
      return false;
    }
    const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    console.log("🔍 [Filiação] Idade calculada:", age, "anos - Mostrar filiação:", age < 45);
    return age < 45;
  }, [nasc]);

  async function submit(values: ComercialFormValues) {
    // Preserve existing pareceres during submit
    const currentParecerAnalise = values.infoRelevantes?.parecerAnalise || JSON.stringify(pareceres);
    
    values.infoRelevantes = {
      info: values.infoRelevantes?.info || "",
      infoMk: values.infoRelevantes?.infoMk || "",
      parecerAnalise: currentParecerAnalise, // Preserve pareceres instead of clearing
    };

    // Salvar dados na tabela applicants_test (experimental)
    if (applicationId) {
      try {
        // Buscar ou criar applicant na tabela teste
        const applicantTestId = await ensureApplicantExists({
          id: applicationId,
          cpf_cnpj: values.cliente.cpf,
          person_type: 'PF',
          nome: values.cliente.nome,
          telefone: values.cliente.tel,
          email: values.cliente.email,
        });
        if (!applicantTestId) {
          toast({ title: 'Erro ao garantir applicant de teste', description: 'Não foi possível criar/obter applicants_test para esta ficha (PF).', variant: 'destructive' });
          console.error('[PF submit] ensureApplicantExists retornou null');
        }

        if (applicantTestId) {
          // Salvar dados de solicitação (via id explícito)
          try {
            await saveSolicitacaoDataFor(applicantTestId, {
              quem_solicitou: values.outras?.administrativas?.quemSolicitou,
              meio: values.outras?.administrativas?.meio,
              protocolo_mk: values.outras?.administrativas?.protocoloMk,
            });
          } catch (e: any) {
            toast({ title: 'Falha ao salvar Solicitação (PF)', description: e?.message || String(e), variant: 'destructive' });
            console.error('[PF submit] saveSolicitacaoDataFor erro:', e);
          }

          // Salvar dados de análise (via id explícito)
          try {
            await saveAnaliseDataFor(applicantTestId, {
              spc: values.spc,
              pesquisador: values.pesquisador,
              plano_acesso: values.outras?.planoEscolhido,
              venc: values.outras?.diaVencimento,
              sva_avulso: values.outras?.svaAvulso,
            });
          } catch (e: any) {
            toast({ title: 'Falha ao salvar Análise (PF)', description: e?.message || String(e), variant: 'destructive' });
            console.error('[PF submit] saveAnaliseDataFor erro:', e);
          }

          // Salvar dados pessoais na tabela pf_fichas_test
          try {
            await savePersonalData(applicantTestId, values);
          } catch (e: any) {
            toast({ title: 'Falha ao salvar PF Ficha (teste)', description: e?.message || String(e), variant: 'destructive' });
            console.error('[PF submit] savePersonalData erro:', e);
          }
        }
      } catch (error) {
        console.error('❌ [PF submit] Erro ao salvar dados experimentais:', error);
        toast({ title: 'Erro ao salvar dados (teste)', description: (error as any)?.message || String(error), variant: 'destructive' });
        // Não bloquear o submit principal por erro experimental
      }
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
      <form onSubmit={form.handleSubmit(submit)} className="space-y-6 max-h-[70vh] overflow-y-auto pr-1 mz-form">
        {/* 1. Dados do Cliente */}
        <section>
          <h3 className="text-lg font-semibold mb-3">1. Dados do Cliente</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            <FormField control={form.control} name="cliente.nome" render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    placeholder="Nome completo"
                    className="placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente.tel" render={({ field }) => (
              <FormItem>
                <FormLabel>Tel</FormLabel>
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
                        className="placeholder:text-[#018942] placeholder:opacity-70"
                      />
                    )}
                  </InputMask>
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente.whats" render={({ field }) => (
              <FormItem>
                <FormLabel>Whats</FormLabel>
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
                        className="placeholder:text-[#018942] placeholder:opacity-70"
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
                  <Input {...field} placeholder="Digite aqui..." className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70" />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente.cpf" render={({ field }) => (
              <FormItem>
                <FormLabel>CPF *</FormLabel>
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
                        className="placeholder:text-[#018942] placeholder:opacity-70"
                      />
                    )}
                  </InputMask>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente.nasc" render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Nascimento</FormLabel>
                <FormControl>
                  <Input
                    placeholder="dd/mm/aaaa"
                    maxLength={10}
                    value={field.value || ''}
                    className="placeholder:text-[#018942] placeholder:opacity-70"
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
            <FormField control={form.control} name="cliente.naturalidade" render={({ field }) => (
              <FormItem>
                <FormLabel>Naturalidade</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente.uf" render={({ field }) => (
              <FormItem>
                <FormLabel>UF</FormLabel>
                <FormControl><Input maxLength={2} {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente.email" render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input type="email" {...field} placeholder="Ex: nome@empresa.com" className="placeholder:text-[#018942] placeholder:opacity-70" />
                </FormControl>
              </FormItem>
            )} />
          </div>
        </section>

        {/* 2. Endereço */}
        <section>
          <h3 className="text-lg font-semibold mb-3">2. Endereço</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            <FormField control={form.control} name="endereco.end" render={({ field }) => (
              <FormItem>
                <FormLabel>Endereço (logradouro)</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
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
                    placeholder="123"
                    className="placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.compl" render={({ field }) => (
              <FormItem>
                <FormLabel>Complemento</FormLabel>
                <FormControl><Input {...field} placeholder="Ex: Apt. 301" className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
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
                    placeholder="Bairro"
                    className="placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.cond" render={({ field }) => (
              <FormItem>
                <FormLabel>Cond</FormLabel>
                <FormControl><Input {...field} placeholder="Ex: Condomínio Jardim Europa" className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.tempo" render={({ field }) => (
              <FormItem>
                <FormLabel>Tempo</FormLabel>
                <FormControl><Input {...field} placeholder="Ex: 2 anos" className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.tipoMoradia" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de moradia</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
              <FormItem className="md:col-span-2">
                <FormLabel>Observações</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.doPs" render={({ field }) => (
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

        {/* 3. Relações de residência */}
        <section>
          <h3 className="text-lg font-semibold mb-3">3. Relações de residência</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            <FormField control={form.control} name="relacoes.unicaNoLote" render={({ field }) => (
              <FormItem>
                <FormLabel>Única no lote</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
            <FormField control={form.control} name="relacoes.unicaNoLoteObs" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Obs</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="relacoes.comQuemReside" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Com quem reside</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="relacoes.nasOutras" render={({ field }) => (
              <FormItem>
                <FormLabel>Nas Outras</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
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
            <FormField control={form.control} name="relacoes.temContrato" render={({ field }) => (
              <FormItem>
                <FormLabel>Tem contrato?</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
            {temContrato === "Sim" && (
              <>
                <FormField control={form.control} name="relacoes.enviouContrato" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enviou contrato?</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
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
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            )}
            <FormField control={form.control} name="relacoes.enviouComprovante" render={({ field }) => (
              <FormItem>
                <FormLabel>Enviou comprovante?</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
            <FormField control={form.control} name="relacoes.tipoComprovante" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de comprovante de endereço</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
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
              <FormItem className="md:col-span-2">
                <FormLabel>Nome do comprovante</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="relacoes.nomeLocador" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Locador(a)</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="relacoes.telefoneLocador" render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl><Input inputMode="tel" {...field} placeholder="Ex: (11) 99999-0000" className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="relacoes.temInternetFixa" render={({ field }) => (
              <FormItem>
                <FormLabel>Tem internet fixa atualmente?</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
            {form.watch("relacoes.temInternetFixa") === "Sim" && (
              <>
                <FormField control={form.control} name="relacoes.empresaInternet" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: Vivo"
                        className="placeholder:text-[#018942] placeholder:opacity-70"
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
                        placeholder="Ex: 300MB"
                        className="placeholder:text-[#018942] placeholder:opacity-70"
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
                        className="placeholder:text-[#018942] placeholder:opacity-70"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            )}
            <FormField control={form.control} name="relacoes.observacoes" render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea rows={3} {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
          </div>
        </section>

        {/* 4. Emprego e Renda */}
        <section>
          <h3 className="text-lg font-semibold mb-3">4. Emprego e Renda</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-4">
            <FormField control={form.control} name="empregoRenda.profissao" render={({ field }) => (
              <FormItem>
                <FormLabel>Profissão</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="empregoRenda.empresa" render={({ field }) => (
              <FormItem>
                <FormLabel>Empresa</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="empregoRenda.vinculo" render={({ field }) => (
              <FormItem>
                <FormLabel>Vínculo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
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
        <section>
          <h3 className="text-lg font-semibold mb-3">5. Cônjuge</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            <FormField control={form.control} name="conjuge.estadoCivil" render={({ field }) => (
              <FormItem>
                <FormLabel>Estado civil</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
            <FormField control={form.control} name="conjuge.nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="conjuge.telefone" render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl><Input inputMode="tel" {...field} placeholder="Ex: (11) 99999-0000" className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="conjuge.whatsapp" render={({ field }) => (
              <FormItem>
                <FormLabel>WhatsApp</FormLabel>
                <FormControl><Input inputMode="tel" {...field} placeholder="Ex: (11) 99999-0000" className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="conjuge.cpf" render={({ field }) => (
              <FormItem>
                <FormLabel>CPF</FormLabel>
                <FormControl><Input {...field} placeholder="000.000.000-00" className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="conjuge.naturalidade" render={({ field }) => (
              <FormItem>
                <FormLabel>Naturalidade</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="conjuge.uf" render={({ field }) => (
              <FormItem>
                <FormLabel>UF</FormLabel>
                <FormControl><Input maxLength={2} {...field} placeholder="Ex: MG" className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
          </div>
        </section>

        {/* 6. Informações SPC */}
        <section>
          <h3 className="text-lg font-semibold mb-3">6. Informações SPC</h3>
          <FormField control={form.control} name="spc" render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea rows={4} {...field} placeholder="Digite aqui..." className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70" />
              </FormControl>
            </FormItem>
          )} />
        </section>

        {/* 7. Informações do Pesquisador */}
        <section>
          <h3 className="text-lg font-semibold mb-3">7. Informações do Pesquisador</h3>
          <FormField control={form.control} name="pesquisador" render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea rows={4} {...field} placeholder="Digite aqui..." className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70" />
              </FormControl>
            </FormItem>
          )} />
        </section>

        {/* 8. Filiação */}
        <section>
            <h3 className="text-lg font-semibold mb-3">8. Filiação</h3>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
              <FormField control={form.control} name="filiacao.pai.nome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pai – Nome</FormLabel>
                  <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="filiacao.pai.reside" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pai – Reside</FormLabel>
                  <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="filiacao.pai.telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pai – Telefone</FormLabel>
                  <FormControl><Input inputMode="tel" {...field} placeholder="Ex: (11) 99999-0000" className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="filiacao.mae.nome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mãe – Nome</FormLabel>
                  <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="filiacao.mae.reside" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mãe – Reside</FormLabel>
                  <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="filiacao.mae.telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mãe – Telefone</FormLabel>
                  <FormControl><Input inputMode="tel" {...field} placeholder="Ex: (11) 99999-0000" className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
                </FormItem>
              )} />
            </div>
          </section>

        {/* 9. Referências pessoais */}
        <section>
          <h3 className="text-lg font-semibold mb-3">9. Referências pessoais</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-4">
            <FormField control={form.control} name="referencias.ref1.nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Ref. 1 – Nome</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref1.parentesco" render={({ field }) => (
              <FormItem>
                <FormLabel>Parentesco</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref1.reside" render={({ field }) => (
              <FormItem>
                <FormLabel>Reside</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref1.telefone" render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl><Input inputMode="tel" {...field} placeholder="Ex: (11) 99999-0000" className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref2.nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Ref. 2 – Nome</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref2.parentesco" render={({ field }) => (
              <FormItem>
                <FormLabel>Parentesco</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref2.reside" render={({ field }) => (
              <FormItem>
                <FormLabel>Reside</FormLabel>
                <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referencias.ref2.telefone" render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl><Input inputMode="tel" {...field} placeholder="Ex: (11) 99999-0000" className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-[#018942] placeholder:text-[#018942]">
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-[#018942] placeholder:text-[#018942]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-[#018942] placeholder:text-[#018942]">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="A definir">A definir</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="outras.carneImpresso" render={({ field }) => (
              <FormItem>
                <FormLabel>Carnê impresso?</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
                  <Input {...field} placeholder="Nome do colaborador" />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="outras.administrativas.fone" render={({ field }) => (
              <FormItem>
                <FormLabel>Tel</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: (11) 99999-0000" />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="outras.administrativas.protocoloMk" render={({ field }) => (
              <FormItem>
                <FormLabel>Protocolo MK</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Número do protocolo" />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="outras.administrativas.meio" render={({ field }) => (
              <FormItem>
                <FormLabel>Meio</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
                <FormControl><Textarea rows={4} {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="infoRelevantes.infoMk" render={({ field }) => (
              <FormItem>
                <FormLabel>Informações relevantes do MK</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    {...field}
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
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-[#018942] hover:bg-[#018942]/10">
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
                              <Textarea 
                                rows={3} 
                                value={replyText} 
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Digite sua resposta como Gestor..."
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

        <div className="flex justify-end pt-6">
          <Button type="submit" className="bg-[#018942] text-white hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(0,0,0,0.25)]">
            {applicationId ? 'Salvar alterações' : 'Criar ficha'}
          </Button>
        </div>
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
