import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FichaPJForm, PJFormValues } from "@/components/ficha/FichaPJForm";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, X, Loader2, ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useDraftForm } from "@/hooks/useDraftForm";
// Removido: conexões de teste
// import { useApplicantsTestConnection } from "@/hooks/useApplicantsTestConnection";
// import { usePjFichasTestConnection } from "@/hooks/usePjFichasTestConnection";
import { useApplicantContacts } from "@/hooks/useApplicantContacts";
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

interface ExpandedFichaPJModalProps {
  open: boolean;
  onClose: () => void;
  companyName?: string;
  applicationId?: string;
  onRefetch?: () => void;
  applicantId?: string;
}

type Parecer = {
  id: string;
  author_id?: string;
  author_name: string;
  author_role?: string;
  created_at: string;
  text: string;
  updated_by_id?: string;
  updated_by_name?: string;
  updated_at?: string;
  parent_id?: string;
  level?: number;
  thread_id?: string;
  is_thread_starter?: boolean;
};

import { usePjFichasTestConnection } from '@/hooks/usePjFichasTestConnection';

export function ExpandedFichaPJModal({ open, onClose, applicationId, onRefetch, applicantId: applicantIdProp }: ExpandedFichaPJModalProps) {
  const { profile } = useAuth();
  const { name: currentUserName } = useCurrentUser();
  const [pareceres, setPareceres] = useState<Parecer[]>([]);
  const [showNewParecerEditor, setShowNewParecerEditor] = useState(false);
  const [newParecerText, setNewParecerText] = useState("");
  const [editingParecerId, setEditingParecerId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [deletingParecerId, setDeletingParecerId] = useState<string | null>(null);
  const [replyingToParecerId, setReplyingToParecerId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  // PF-like confirmation flow state
  const [formData, setFormData] = useState<PJFormValues | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showFirstConfirmDialog, setShowFirstConfirmDialog] = useState(false);
  const [showSecondConfirmDialog, setShowSecondConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'close' | 'save' | null>(null);
  const [initialValues, setInitialValues] = useState<Partial<PJFormValues> | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const { isAutoSaving, lastSaved, saveDraft, clearEditingSession } = useDraftForm();
  const [lastFormSnapshot, setLastFormSnapshot] = useState<PJFormValues | null>(null);
  // Removido: estado e hooks de tabelas de teste

  // Descobrir applicant_id e preparar hook de contatos (preferir prop)
  const [applicantId, setApplicantId] = useState<string | null>(applicantIdProp || null);
  useEffect(() => {
    (async () => {
      if (applicantIdProp) { setApplicantId(applicantIdProp); return; }
      if (!applicationId) { setApplicantId(null); return; }
      const { data } = await (supabase as any)
        .from('kanban_cards')
        .select('applicant_id')
        .eq('id', applicationId)
        .maybeSingle();
      setApplicantId((data as any)?.applicant_id || null);
    })();
  }, [applicationId, applicantIdProp]);
  const { update: updateApplicantContacts } = useApplicantContacts(applicantId || undefined);
  const { saveCompanyData } = usePjFichasTestConnection();
  const [expanded, setExpanded] = useState(false);
  const [pjSubmit, setPjSubmit] = useState<(() => void) | null>(null);

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

  // Load notes from kanban_cards
  const loadPareceres = useCallback(async () => {
    if (!open || !applicationId) return;
    try {
      const { data } = await supabase
        .from('kanban_cards')
        .select('reanalysis_notes')
        .eq('id', applicationId)
        .maybeSingle();
      let notes: any[] = [];
      const raw = (data as any)?.reanalysis_notes;
      if (Array.isArray(raw)) notes = raw as any[];
      else if (typeof raw === 'string') { try { notes = JSON.parse(raw) || []; } catch {}
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
      console.log('📊 [ExpandedPJ] Pareceres carregados:', migratedNotes.length, 'Ativos:', activePareceres.length);
      setPareceres(activePareceres as Parecer[]);
    } catch {
      // ignore
    }
  }, [open, applicationId]);

  useEffect(() => {
    loadPareceres();
  }, [loadPareceres]);

  // 🔴 REALTIME: Sincronizar pareceres quando o card for atualizado
  useEffect(() => {
    if (!open || !applicationId) return;
    
    console.log('🔴 [ExpandedPJ] Configurando Realtime para pareceres do card:', applicationId);
    
    const channel = supabase
      .channel(`pareceres-expanded-pj-${applicationId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kanban_cards', filter: `id=eq.${applicationId}` },
        (payload) => {
          console.log('🔴 [ExpandedPJ] Card atualizado, recarregando pareceres:', payload);
          loadPareceres();
        }
      )
      .subscribe((status) => {
        console.log('🔴 [ExpandedPJ] Status da subscrição Realtime de pareceres:', status);
      });
    
    return () => {
      console.log('🔴 [ExpandedPJ] Removendo subscrição Realtime de pareceres');
      supabase.removeChannel(channel);
    };
  }, [open, applicationId, loadPareceres]);

  // Load initial basic data from kanban_cards/applicants/pj_fichas (robust with timeout + mount guard)
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const loadInitial = async () => {
      if (!open || !applicationId) return;
      if (!mounted) return;
      setIsLoadingInitial(true);

      // Fallback: if something stalls, stop loading after 3s to avoid lock
      timeoutId = setTimeout(() => {
        if (!mounted) return;
        setIsLoadingInitial(false);
        if (!initialValues) setInitialValues({} as any);
      }, 3000);

      try {
        if (import.meta?.env?.DEV) console.log('[PJ] Loading initial data for applicationId', applicationId);
        const cardPromise = supabase
          .from('kanban_cards')
          .select('id, applicant_id')
          .eq('id', applicationId)
          .maybeSingle();

        const { data: card } = await cardPromise;

        let tradeName: string | undefined = undefined;
        if ((card as any)?.applicant_id) {
          const { data: pjFicha } = await supabase
            .from('pj_fichas')
            .select('trade_name')
            .eq('applicant_id', (card as any).applicant_id)
            .maybeSingle();
          if (pjFicha && (pjFicha as any).trade_name) tradeName = (pjFicha as any).trade_name as string;
        }

        if (!mounted) return;
        let defaults: Partial<PJFormValues> = {
          empresa: {
            razao: '',
            cnpj: '',
            fantasia: tradeName || '',
          },
          contatos: {
            tel: '',
            whats: '',
            email: '',
          },
        } as any;
        // Prefill com Applicants (quem_solicitou, telefone_solicitante, parecer_analise)
        try {
          if ((card as any)?.applicant_id) {
            const { data: appl } = await supabase
              .from('applicants')
              .select('primary_name, cpf_cnpj, quem_solicitou, telefone_solicitante, parecer_analise, phone, whatsapp, email, carne_impresso, venc, plano_acesso, sva_avulso, meio, protocolo_mk, info_spc, info_pesquisador, info_relevantes, info_mk')
              .eq('id', (card as any).applicant_id)
              .maybeSingle();
            if (appl) {
              defaults = {
                ...defaults,
                empresa: {
                  razao: (appl as any).primary_name || (defaults as any)?.empresa?.razao || '',
                  cnpj: (appl as any).cpf_cnpj || (defaults as any)?.empresa?.cnpj || '',
                  fantasia: (defaults as any)?.empresa?.fantasia || '',
                },
                contatos: {
                  tel: (appl as any).phone || defaults.contatos?.tel || '',
                  whats: (appl as any).whatsapp || defaults.contatos?.whats || '',
                  email: (appl as any).email || defaults.contatos?.email || '',
                },
                solicitacao: {
                  quem: (appl as any).quem_solicitou || '',
                  tel: (appl as any).telefone_solicitante || '',
                  meio: (appl as any).meio || '',
                  protocolo: (appl as any).protocolo_mk || '',
                  planoAcesso: (appl as any).plano_acesso || undefined,
                  svaAvulso: (appl as any).sva_avulso || '',
                  venc: typeof (appl as any).venc === 'number' ? String((appl as any).venc) : undefined,
                  carneImpresso: typeof (appl as any).carne_impresso === 'boolean' ? ((appl as any).carne_impresso ? 'Sim' : 'Não') : undefined,
                },
                info: {
                  ...(defaults as any).info,
                  parecerAnalise: (appl as any).parecer_analise || (defaults as any)?.info?.parecerAnalise || '',
                  relevantes: (appl as any).info_relevantes || (defaults as any)?.info?.relevantes || '',
                  spc: (appl as any).info_spc || (defaults as any)?.info?.spc || '',
                  outrasPs: (appl as any).info_pesquisador || (defaults as any)?.info?.outrasPs || '',
                  mk: (appl as any).info_mk || (defaults as any)?.info?.mk || '',
                },
              } as any;
            }
          }
        } catch (_) {}
        // Tentar carregar rascunho salvo para esta aplicação e usuário
        try {
          const { data: draft } = await supabase
            .from('applications_drafts')
            .select('other_data, application_id, user_id')
            .eq('application_id', applicationId)
            .maybeSingle();
          const pjDraft = (draft as any)?.other_data?.pj as Partial<PJFormValues> | undefined;
          if (pjDraft && typeof pjDraft === 'object') {
            defaults = { ...defaults, ...pjDraft } as Partial<PJFormValues>;
          }
        } catch (_) {
          // ignore
        }
        setInitialValues(defaults);
        if (import.meta?.env?.DEV) console.log('[PJ] Initial defaults ready');
        setIsInitialized(false);
        setHasChanges(false);
      } catch (_e) {
        if (import.meta?.env?.DEV) console.error('[PJ] Failed to load initial data', _e);
        if (!mounted) return;
        setInitialValues({} as any);
      } finally {
        if (!mounted) return;
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
        setIsLoadingInitial(false);
        if (import.meta?.env?.DEV) console.log('[PJ] Loading done');
      }
    };
    loadInitial();
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [open, applicationId]);

  const appendParecer = async () => {
    const text = newParecerText.trim();
    if (!text || !applicationId) return;
    // merge from DB to avoid overwrite
    let base: any[] = [];
    const { data } = await supabase.from('kanban_cards').select('reanalysis_notes').eq('id', applicationId).maybeSingle();
    const raw = (data as any)?.reanalysis_notes;
    if (Array.isArray(raw)) base = raw as any[]; else if (typeof raw === 'string') { try { base = JSON.parse(raw) || []; } catch {} }
    const newP: Parecer = { 
      id: crypto.randomUUID(), 
      author_id: profile?.id || 'current-user-id', 
      author_name: currentUserName, 
      author_role: String(profile?.role || 'colaborador'), 
      created_at: new Date().toISOString(), 
      text,
      parent_id: null,
      level: 0, // Parecer principal
      thread_id: crypto.randomUUID(), // Novo thread para cada parecer principal
      is_thread_starter: true
    };
    // ✅ IMPORTANTE: Manter pareceres deletados no banco (soft delete) para histórico
    // mas adicionar o novo parecer à lista completa
    const next = [...base, newP];
    
    // ✅ Para a UI, mostrar apenas pareceres ativos (sem deleted)
    const activePareceres = next.filter((p: any) => !p.deleted);
    setPareceres(activePareceres as Parecer[]);
    
    setNewParecerText("");
    setShowNewParecerEditor(false);
    try {
      console.log('➕ [ExpandedPJ] Adicionando novo parecer ao banco:', newP.id);
      
      // ✅ Salvar lista COMPLETA (incluindo deletados para histórico)
      const serialized = JSON.stringify(next);
      const { error } = await supabase.from('kanban_cards').update({ reanalysis_notes: serialized }).eq('id', applicationId);
      if (error) throw error;
      console.log('✅ [ExpandedPJ] Parecer adicionado com sucesso! Realtime vai sincronizar outros modais.');

      // 🔁 Espelhar texto do parecer mais recente em applicants.parecer_analise
      try {
        const { data: kc } = await supabase
          .from('kanban_cards')
          .select('applicant_id')
          .eq('id', applicationId)
          .maybeSingle();
        const aid = (kc as any)?.applicant_id as string | undefined;
        if (aid) {
          await supabase
            .from('applicants')
            .update({ parecer_analise: text })
            .eq('id', aid);
        }
      } catch (_) {}
      // 🔔 Notificações de menções no parecer
      try {
        const matches = Array.from(text.matchAll(/@(\w+)/g)).map(m => m[1]);
        const unique = Array.from(new Set(matches));
        if (unique.length > 0) {
          for (const mention of unique) {
            const { data: profiles } = await (supabase as any)
              .from('profiles')
              .select('id, full_name')
              .ilike('full_name', `${mention}%`)
              .limit(5);
            const targets = (profiles || []).map((p: any) => p.id).filter(Boolean);
            for (const userId of targets) {
              if (userId === (profile?.id || '')) continue;
              // Resolver título do card
              let cardTitle = 'Cliente';
              let applicantId: string | null = null;
              try {
                const { data: kc } = await (supabase as any)
                  .from('kanban_cards')
                  .select('applicant:applicant_id(id, primary_name)')
                  .eq('id', applicationId)
                  .maybeSingle();
                cardTitle = (kc as any)?.applicant?.primary_name || 'Cliente';
                applicantId = (kc as any)?.applicant?.id || null;
              } catch (_) {}
              await (supabase as any)
                .from('inbox_notifications')
                .insert({
                  user_id: userId,
                  type: 'mention',
                  priority: 'low',
                  title: `${profile?.full_name || 'Colaborador'} mencionou você em um Parecer`,
                  body: `${cardTitle}\n${String(text).replace(/\s+/g,' ').slice(0,140)}`,
                  applicant_id: applicantId || undefined,
                  meta: { cardId: applicationId, applicantId, parecerId: newP.id },
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
      
      toast({ title: 'Parecer adicionado' });
    } catch (e: any) {
      console.error('❌ [ExpandedPJ] Erro ao adicionar parecer:', e);
      toast({ title: 'Erro ao salvar parecer', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const canEdit = (p: Parecer) => {
    // ✅ VALIDAÇÃO ROBUSTA: Profile deve existir E ter id/role válidos
    if (!profile || !profile.id || !profile.role) {
      if (import.meta?.env?.DEV) console.log('⚠️ canEdit (ExpandedFicha): Profile inválido ou incompleto', profile);
      return false;
    }
    
    // Autor pode editar/excluir seu próprio parecer
    if ((p.author_id ?? '') === profile.id) {
      return true;
    }
    
    // Gestor pode editar/excluir qualquer parecer
    if (profile.role === 'gestor') {
      return true;
    }
    
    return false;
  };
  
  const canReplyToParecer = (p: Parecer) => {
    // ✅ VALIDAÇÃO ROBUSTA: Profile deve existir E ter id/role válidos
    if (!profile || !profile.id || !profile.role) {
      if (import.meta?.env?.DEV) console.log('⚠️ canReplyToParecer (ExpandedFicha): Profile inválido ou incompleto', profile);
      return false;
    }
    
    // Apenas gestores podem responder pareceres, e somente se o nível for menor que 7
    const canReply = profile.role === 'gestor' && (p.level || 0) < 7;
    return canReply;
  };

  // Função para organizar pareceres em grupos hierárquicos
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

  // Função para obter cor do thread
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
    const hash = threadId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };
  const startEdit = (id: string, currentText: string) => { setEditingParecerId(id); setEditingText(currentText); };
  const cancelEdit = () => { setEditingParecerId(null); setEditingText(""); };
  const startReplyToParecer = (id: string) => { setReplyingToParecerId(id); setReplyText(""); };
  const cancelReplyToParecer = () => { setReplyingToParecerId(null); setReplyText(""); };
  
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
        text: text, // Remover prefixo, será tratado na interface
        parent_id: replyingToParecerId,
        level: (parecerOriginal.level || 0) + 1, // Incrementar nível baseado no parecer pai
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
      setPareceres(activePareceres as Parecer[]);
      
      // ✅ Salvar lista COMPLETA no banco (incluindo deletados para histórico)
      const serialized = JSON.stringify(updated);
      
      const { error } = await supabase
        .from('kanban_cards')
        .update({ reanalysis_notes: serialized })
        .eq('id', applicationId);
        
      if (error) throw error;
      // 🔔 Notificações de menções na resposta de parecer
      try {
        const matches = Array.from(text.matchAll(/@(\w+)/g)).map(m => m[1]);
        const unique = Array.from(new Set(matches));
        if (unique.length > 0) {
          for (const mention of unique) {
            const { data: profiles } = await (supabase as any)
              .from('profiles')
              .select('id, full_name')
              .ilike('full_name', `${mention}%`)
              .limit(5);
            const targets = (profiles || []).map((p: any) => p.id).filter(Boolean);
            for (const userId of targets) {
              if (userId === (profile?.id || '')) continue;
              // Resolver título do card
              let cardTitle = 'Cliente';
              let applicantId: string | null = null;
              try {
                const { data: kc } = await (supabase as any)
                  .from('kanban_cards')
                  .select('applicant:applicant_id(id, primary_name)')
                  .eq('id', applicationId)
                  .maybeSingle();
                cardTitle = (kc as any)?.applicant?.primary_name || 'Cliente';
                applicantId = (kc as any)?.applicant?.id || null;
              } catch (_) {}
              await (supabase as any)
                .from('inbox_notifications')
                .insert({
                  user_id: userId,
                  type: 'mention',
                  priority: 'low',
                  title: `${profile?.full_name || 'Colaborador'} respondeu o seu Parecer`,
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
      console.log('✅ [ExpandedPJ] Resposta salva com sucesso! Realtime vai sincronizar outros modais.');
      toast({ title: 'Resposta salva', description: 'Sua resposta foi adicionada ao parecer.' });
    } catch (e: any) {
      console.error('❌ [ExpandedPJ] Erro ao salvar resposta:', e);
      toast({ title: 'Erro ao salvar resposta', description: e?.message || String(e), variant: 'destructive' });
    }
  };
  
  const saveEdit = async () => {
    if (!editingParecerId || !applicationId) return;
    const text = editingText.trim(); if (!text) return;
    let base: any[] = [];
    const { data } = await supabase.from('kanban_cards').select('reanalysis_notes').eq('id', applicationId).maybeSingle();
    const raw = (data as any)?.reanalysis_notes;
    if (Array.isArray(raw)) base = raw as any[]; else if (typeof raw === 'string') { try { base = JSON.parse(raw) || []; } catch {} }
    
    // ✅ Editar na lista completa (incluindo deletados)
    const updated = (base.length ? base : pareceres).map((p: any) => p.id === editingParecerId && canEdit(p)
      ? { ...p, text, updated_by_id: profile?.id || 'current-user-id', updated_by_name: currentUserName, updated_at: new Date().toISOString() }
      : p);
    
    // ✅ Para a UI, mostrar apenas pareceres ativos (sem deleted)
    const activePareceres = updated.filter((p: any) => !p.deleted);
    setPareceres(activePareceres as Parecer[]);
    
    setEditingParecerId(null);
    setEditingText("");
    try {
      console.log('✏️ [ExpandedPJ] Editando parecer no banco:', editingParecerId);
      
      // ✅ Salvar lista COMPLETA no banco (incluindo deletados para histórico)
      const serialized = JSON.stringify(updated);
      const { error } = await supabase.from('kanban_cards').update({ reanalysis_notes: serialized }).eq('id', applicationId);
      if (error) throw error;
      console.log('✅ [ExpandedPJ] Parecer editado com sucesso! Realtime vai sincronizar outros modais.');
      
      // Chamar onRefetch para atualizar outros componentes
      if (onRefetch) {
        onRefetch();
      }
      
      toast({ title: 'Parecer atualizado' });
    } catch (e: any) {
      console.error('❌ [ExpandedPJ] Erro ao editar parecer:', e);
      toast({ title: 'Erro ao editar parecer', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  // Funções para exclusão de pareceres
  const handleDeleteParecer = (parecerId: string) => {
    setDeletingParecerId(parecerId);
  };

  const confirmDeleteParecer = async () => {
    if (!deletingParecerId || !applicationId) return;
    
    try {
      console.log('🗑️ [PJ] Excluindo parecer:', deletingParecerId, 'do card:', applicationId);
      
      // Buscar pareceres atuais do banco
      let currentNotes: any[] = [];
      const { data } = await supabase
        .from('kanban_cards')
        .select('reanalysis_notes')
        .eq('id', applicationId)
        .maybeSingle();
      
      console.log('📋 [PJ] Pareceres atuais do banco:', data);
      
      const raw = (data as any)?.reanalysis_notes;
      if (Array.isArray(raw)) currentNotes = raw as any[];
      else if (typeof raw === 'string') { try { currentNotes = JSON.parse(raw) || []; } catch {} }
      
      console.log('📝 [PJ] Pareceres parseados:', currentNotes);
      
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
      
      console.log('✅ [PJ] Parecer marcado como deletado (soft delete):', deletingParecerId);
      
      // Preparar dados para update
      const updateData: any = { reanalysis_notes: serialized };
      
      
      // Salvar no banco
      const { error } = await supabase
        .from('kanban_cards')
        .update(updateData)
        .eq('id', applicationId);
      
      if (error) {
        console.error('❌ [PJ] Erro ao salvar no banco:', error);
        throw error;
      }
      
      console.log('💾 [PJ] Parecer excluído do banco com sucesso!', updateData);
      
      // Atualizar estado local
      setPareceres(prev => prev.filter(p => p.id !== deletingParecerId));
      setDeletingParecerId(null);
      
      // Chamar onRefetch para atualizar outros componentes
      if (onRefetch) {
        console.log('🔄 [PJ] Chamando onRefetch...');
        onRefetch();
      }
      
      toast({ title: 'Parecer excluído', description: 'O parecer foi removido com sucesso.' });
    } catch (e: any) {
      console.error('❌ [PJ] ERRO ao excluir parecer:', e);
      toast({ title: 'Erro ao excluir parecer', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const cancelDeleteParecer = () => {
    setDeletingParecerId(null);
  };
  
  // Function to normalize values for comparison
  const normalizeValue = (value: any): any => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object' && !Array.isArray(value)) {
      const normalized: any = {};
      for (const [key, val] of Object.entries(value)) {
        normalized[key] = normalizeValue(val);
      }
      return normalized;
    }
    if (Array.isArray(value)) {
      return value.map(normalizeValue);
    }
    return value;
  };

  // Track form changes similar to PF flow
  const handleFormChange = (data: PJFormValues) => {
    setFormData(data);
    setLastFormSnapshot(data);
    if (!isInitialized) {
      setIsInitialized(true);
      setHasChanges(false);
      return;
    }
    
    // Compare with initial values to detect changes
    if (initialValues) {
      const normalizedData = normalizeValue(data);
      const normalizedInitial = normalizeValue(initialValues);
      const hasActualChanges = JSON.stringify(normalizedData) !== JSON.stringify(normalizedInitial);
      setHasChanges(hasActualChanges);
    } else {
      setHasChanges(true);
    }

    // Debounced auto-save to drafts
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    const timer = setTimeout(async () => {
      if (!applicationId) return;
      const draftPayload = {
        // Guardar toda a ficha PJ em other_data.pj para restauração fiel
        other_data: { pj: data },
      } as any;
      try {
        await ensureCommercialFeitas(applicationId);
        await saveDraft(draftPayload, applicationId, 'pj', false);
        // Atualizar applicants + pj_fichas_test (autosave)
        try {
          const aid = applicantId || (await (async () => {
            const { data: kc } = await supabase
              .from('kanban_cards')
              .select('applicant_id')
              .eq('id', applicationId)
              .maybeSingle();
            return (kc as any)?.applicant_id as string | undefined;
          })());
          if (aid) {
            // Applicants
            const contactUpdates: any = {};
            if (data?.contatos?.tel) contactUpdates.phone = data.contatos.tel;
            if (data?.contatos?.whats) contactUpdates.whatsapp = data.contatos.whats;
            if (data?.solicitacao?.quem) contactUpdates.quem_solicitou = data.solicitacao.quem;
            if (data?.solicitacao?.tel) contactUpdates.telefone_solicitante = data.solicitacao.tel;
            if (Object.keys(contactUpdates).length) {
              await updateApplicantContacts(contactUpdates);
            }
            const appUpdates: any = {};
            // Razão social/CNPJ → Applicants
            if (data?.empresa?.razao) appUpdates.primary_name = data.empresa.razao;
            if (data?.empresa?.cnpj) appUpdates.cpf_cnpj = String(data.empresa.cnpj).replace(/\D+/g, '');
            // Outros campos (e-mail/endereço/intake/preferências/infos)
            if (data?.contatos?.email) appUpdates.email = data.contatos.email;
            // Endereço
            if (data?.endereco?.end) appUpdates.address_line = data.endereco.end;
            if (data?.endereco?.n) appUpdates.address_number = data.endereco.n;
            if (data?.endereco?.compl) appUpdates.address_complement = data.endereco.compl;
            if (data?.endereco?.cep) appUpdates.cep = data.endereco.cep;
            if (data?.endereco?.bairro) appUpdates.bairro = data.endereco.bairro;
            // Intake
            if (data?.solicitacao?.meio) appUpdates.meio = data.solicitacao.meio;
            if (data?.solicitacao?.protocolo) appUpdates.protocolo_mk = data.solicitacao.protocolo;
            // Preferências
            if (data?.solicitacao?.planoAcesso) appUpdates.plano_acesso = data.solicitacao.planoAcesso;
            if (data?.solicitacao?.svaAvulso) appUpdates.sva_avulso = data.solicitacao.svaAvulso;
            if (data?.solicitacao?.venc) appUpdates.venc = Number(data.solicitacao.venc);
            if (typeof data?.solicitacao?.carneImpresso !== 'undefined') {
              appUpdates.carne_impresso = data.solicitacao.carneImpresso === 'Sim' ? true : data.solicitacao.carneImpresso === 'Não' ? false : null;
            }
            // Informações
            if (data?.info?.relevantes) appUpdates.info_relevantes = data.info.relevantes;
            if (data?.info?.spc) appUpdates.info_spc = data.info.spc;
            if (data?.info?.outrasPs) appUpdates.info_pesquisador = data.info.outrasPs;
            if (data?.info?.mk) appUpdates.info_mk = data.info.mk;
            if (data?.info?.parecerAnalise) appUpdates.parecer_analise = data.info.parecerAnalise;
            if (Object.keys(appUpdates).length > 0) {
              await supabase.from('applicants').update(appUpdates).eq('id', aid);
            }
            // PJ ficha (pj_fichas_test)
            try {
              await saveCompanyData(aid, data as any);
            } catch (_) {}
          }
        } catch (_) {}
      } catch (_) {
        // ignore
      }
    }, 300);
    setAutoSaveTimer(timer);
  };

  const handleClose = () => {
    if (!hasChanges) {
      onClose();
      return;
    }
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
      if (formData && applicationId) {
        // Salvar os dados da ficha PJ no banco
        try {
          // Salvar rascunho final
          try {
            await ensureCommercialFeitas(applicationId);
            await saveDraft({ other_data: { pj: formData } } as any, applicationId, 'pj', false);
          } catch (_) {}
          // Atualizar kanban_cards com os dados básicos
          // Campos da empresa agora são salvos em applicants, não em kanban_cards
          // (removida atualização redundante de title, phone, email, cpf_cnpj)
          
          // Atualizar applicants com campos do cliente (confirm)
          try {
            const aid = applicantId || (await (async () => {
              const { data: kc } = await supabase
                .from('kanban_cards')
                .select('applicant_id')
                .eq('id', applicationId)
                .maybeSingle();
              return (kc as any)?.applicant_id as string | undefined;
            })());
            if (aid) {
              const contactUpdates: any = {};
              if (formData?.contatos?.tel) contactUpdates.phone = formData.contatos.tel;
              if (formData?.contatos?.whats) contactUpdates.whatsapp = formData.contatos.whats;
              if (formData?.solicitacao?.quem) contactUpdates.quem_solicitou = formData.solicitacao.quem;
              if (formData?.solicitacao?.tel) contactUpdates.telefone_solicitante = formData.solicitacao.tel;
              if (Object.keys(contactUpdates).length) {
                await updateApplicantContacts(contactUpdates);
              }
              const appUpdates: any = {};
              // Razão social/CNPJ → Applicants
              if (formData?.empresa?.razao) appUpdates.primary_name = formData.empresa.razao;
              if (formData?.empresa?.cnpj) appUpdates.cpf_cnpj = String(formData.empresa.cnpj).replace(/\D+/g, '');
              if (formData?.contatos?.email) appUpdates.email = formData.contatos.email;
              // Endereço
              if (formData?.endereco?.end) appUpdates.address_line = formData.endereco.end;
              if (formData?.endereco?.n) appUpdates.address_number = formData.endereco.n;
              if (formData?.endereco?.compl) appUpdates.address_complement = formData.endereco.compl;
              if (formData?.endereco?.cep) appUpdates.cep = formData.endereco.cep;
              if (formData?.endereco?.bairro) appUpdates.bairro = formData.endereco.bairro;
              // Intake
              if (formData?.solicitacao?.meio) appUpdates.meio = formData.solicitacao.meio;
              if (formData?.solicitacao?.protocolo) appUpdates.protocolo_mk = formData.solicitacao.protocolo;
              // Preferências
              if (formData?.solicitacao?.planoAcesso) appUpdates.plano_acesso = formData.solicitacao.planoAcesso;
              if (formData?.solicitacao?.svaAvulso) appUpdates.sva_avulso = formData.solicitacao.svaAvulso;
              if (formData?.solicitacao?.venc) appUpdates.venc = Number(formData.solicitacao.venc);
              if (typeof formData?.solicitacao?.carneImpresso !== 'undefined') {
                appUpdates.carne_impresso = formData.solicitacao.carneImpresso === 'Sim' ? true : formData.solicitacao.carneImpresso === 'Não' ? false : null;
              }
              // Informações
              if (formData?.info?.relevantes) appUpdates.info_relevantes = formData.info.relevantes;
              if (formData?.info?.spc) appUpdates.info_spc = formData.info.spc;
              if (formData?.info?.outrasPs) appUpdates.info_pesquisador = formData.info.outrasPs;
              if (formData?.info?.mk) appUpdates.info_mk = formData.info.mk;
              if (formData?.info?.parecerAnalise) appUpdates.parecer_analise = formData.info.parecerAnalise;
              if (Object.keys(appUpdates).length > 0) {
                await supabase.from('applicants').update(appUpdates).eq('id', aid);
              }
              // PJ ficha (pj_fichas_test)
              try {
                await saveCompanyData(aid, formData as any);
              } catch (_) {}
            }
          } catch (_) {}
          
          toast({
            title: "Ficha PJ salva com sucesso",
            description: "As alterações foram aplicadas permanentemente."
          });
          
          // Atualizar o frontend chamando onRefetch (igual à ficha PF)
          onRefetch?.();
          
        } catch (error: any) {
          console.error('Erro ao salvar ficha PJ:', error);
          toast({
            title: "Erro ao salvar ficha PJ",
            description: error.message || "Ocorreu um erro inesperado",
            variant: "destructive"
          });
        }
      }
      try { await clearEditingSession(); } catch {}
      onClose();
    }
    
    setPendingAction(null);
  };

  const handleDiscardChanges = () => {
    setShowFirstConfirmDialog(false);
    setShowSecondConfirmDialog(false);
    setPendingAction(null);
    onClose();
  };

  const handleSubmitWrapper = async (data: PJFormValues) => {
    if (applicationId) {
      setFormData(data);
      setPendingAction('save');
      setShowFirstConfirmDialog(true);
    } else {
      onClose();
    }
  };
  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent
        aria-describedby={undefined}
        className={expanded 
          ? "!max-w-none w-[100vw] h-[100vh] sm:rounded-none overflow-hidden gap-0" 
          : "max-w-[1200px] max-h-[95vh] overflow-hidden gap-0"
        }
        onInteractOutside={(e) => e.preventDefault()}
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
                Ficha Comercial — Pessoa Jurídica
              </DialogTitle>
              {hasChanges && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                  Alterações não salvas
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(e => !e)}
                className="h-8 w-8 p-0 text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand)/0.08)]"
                aria-label={expanded ? "Minimizar" : "Expandir"}
                title={expanded ? "Minimizar" : "Expandir"}
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0 text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand)/0.08)]"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        {/* Container principal com espaçamento responsivo otimizado */}
        <div
          className={expanded 
            ? "flex-1 overflow-hidden space-y-4 sm:space-y-6 px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 bg-white" 
            : "flex-1 overflow-hidden space-y-6 px-6 py-6"
          }
          onBlurCapture={async () => {
            if (!applicationId || !lastFormSnapshot) return;
            try {
              // Garantir que permaneça em Comercial/Feitas ao editar/fechar
              await ensureCommercialFeitas(applicationId);
              await saveDraft({ other_data: { pj: lastFormSnapshot } } as any, applicationId, 'pj', false);
            } catch (_) {}
          }}
        >
          {isLoadingInitial && (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando dados básicos...
            </div>
          )}
          {!isLoadingInitial && (
            <FichaPJForm
              defaultValues={initialValues || undefined}
              onSubmit={handleSubmitWrapper}
              onCancel={handleClose}
              onFormChange={handleFormChange}
              applicationId={applicationId}
              onExpose={(api) => setPjSubmit(() => api.submit)}
              hideInternalActions={expanded}
              afterMkSlot={(
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-semibold">Pareceres da Análise</h3>
                  <Button
                    type="button"
                    size="default"
                    className="h-10 px-4 text-sm bg-[#018942] hover:bg-[#018942]/90 text-white border-[#018942] hover:border-[#018942]/90"
                    onClick={() => setShowNewParecerEditor(true)}
                  >
                    + Adicionar Parecer
                  </Button>
                </div>
                
                {/* Editor de novo parecer - agora aparece acima dos pareceres existentes */}
                {showNewParecerEditor && (
                  <div className="mt-2">
                    <Textarea rows={3} value={newParecerText} onChange={(e) => setNewParecerText(e.target.value)} className="text-sm text-[#018942]" placeholder="Escreva um novo parecer..." />
                    <div className="flex justify-end gap-2 mt-2">
                      <Button size="sm" type="button" variant="secondary" onClick={() => { setShowNewParecerEditor(false); setNewParecerText(""); }} className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500 hover:border-gray-600">Cancelar</Button>
                      <Button
                        size="default"
                        type="button"
                        onClick={appendParecer}
                        className="h-10 px-4 text-sm bg-[#018942] hover:bg-[#018942]/90 text-white border-[#018942] hover:border-[#018942]/90"
                      >
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
                                      {new Date(p.created_at).toLocaleString()}
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
                                        onClick={() => startReplyToParecer(p.id)}
                                        className="h-6 w-6 p-0 hover:bg-[#018942]/10 rounded-full"
                                        title="Responder ao parecer (apenas Gestor)"
                                      >
                                        <ArrowLeft className="h-3 w-3 rotate-180 text-[#018942]" />
                                      </Button>
                                    )}
                                    {/* Botão de Edição (3 pontinhos) - sempre visível para o autor */}
                                    {canEdit(p) && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-[#018942] hover:bg-[#018942]/10">
                                            <MoreVertical className="h-3 w-3" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => startEdit(p.id, p.text)}>Editar</DropdownMenuItem>
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
                                    <Button size="sm" type="button" variant="secondary" onClick={cancelEdit} className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500 hover:border-gray-600">Cancelar</Button>
                                    <Button size="sm" type="button" onClick={saveEdit} className="bg-[#018942] hover:bg-[#018942]/90 text-white border-[#018942] hover:border-[#018942]/90">Salvar</Button>
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
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={cancelReplyToParecer}
                                      className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500 hover:border-gray-600"
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={saveReplyToParecer}
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
                    <div className="text-sm text-muted-foreground">Nenhum parecer adicionado.</div>
                  )}
                </div>
              </section>
              )}
            />
          )}
        </div>
        {expanded && (
          <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-3 sm:px-4 md:px-6 py-3 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              className="text-gray-700"
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button
              className="bg-[#018942] hover:bg-[#018942]/90 text-white"
              onClick={() => pjSubmit?.()}
            >
              Salvar ficha PJ
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

export default ExpandedFichaPJModal;
