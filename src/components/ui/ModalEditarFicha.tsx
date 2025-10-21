import React, { useEffect, useState, useCallback, lazy, Suspense, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
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
import { toast } from "@/hooks/use-toast";
import { X, MoreVertical, Paperclip, ArrowLeft, ExternalLink, Printer } from "lucide-react";
import InputMask from "react-input-mask";
const ExpandedFichaModal = lazy(() => import("@/components/ficha/ExpandedFichaModal").then(m => ({ default: m.ExpandedFichaModal })));
const ExpandedFichaPJModal = lazy(() => import("@/components/ficha/ExpandedFichaPJModal").then(m => ({ default: m.ExpandedFichaPJModal })));
import { supabase } from "@/integrations/supabase/client";
import { ComercialFormValues } from "@/components/NovaFichaComercialForm";
import { useAuth } from "@/context/AuthContext";
import { canEditReanalysis } from "@/lib/access";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/use-current-user";
const ObservationsWithComments = lazy(() => import("@/components/ui/ObservationsWithComments").then(m => ({ default: m.ObservationsWithComments })));
import { AttachmentUploadModal } from "@/components/attachments/AttachmentUploadModal";
import { AttachmentList } from "@/components/attachments/AttachmentDisplay";
import { useAttachments } from "@/hooks/useAttachments";
import { DatePicker } from "@/components/ui/DatePicker";

interface ModalEditarFichaProps {
  card: any;
  responsaveis?: string[];
  onClose: () => void;
  onSave: (updatedCard: any) => void;
  onDesingressar?: (id: string) => void;
  onRefetch?: () => void;
  autoOpenExpanded?: boolean;
}

export default function ModalEditarFicha({ card, onClose, onSave, onDesingressar, responsaveis = [], onRefetch, autoOpenExpanded = false }: ModalEditarFichaProps) {
  const devLog = (...args: any[]) => { if ((import.meta as any)?.env?.DEV) console.log(...args); };
  const [isPending, startTransition] = useTransition();
  // Reativar realtime para refletir alterações do Supabase no modal
  const ENABLE_APPLICANT_REALTIME = true;
  const shallowEqual = (a: any, b: any) => {
    if (a === b) return true;
    if (!a || !b) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) { if (a[k] !== b[k]) return false; }
    return true;
  };
  const toDateInput = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    // Usar componentes UTC para evitar deslocamentos de fuso
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const initialForm = {
    nome: card?.nome ?? "",
    telefone: card?.telefone ?? "",
    agendamento: card?.deadline && card?.deadline !== card?.receivedAt ? toDateInput(card.deadline) : "",
    feito_em: card?.receivedAt ? toDateInput(card.receivedAt) : "",
    observacoes: card?.observacoes ?? "",
    // Novos campos PF
    cpf: card?.cpf_cnpj ?? "",
    whatsapp: card?.whatsapp ?? "",
    email: (card as any)?.email ?? "",
    endereco: card?.endereco ?? "",
    numero: card?.numero ?? "",
    complemento: card?.complemento ?? "",
    cep: card?.cep ?? "",
    bairro: card?.bairro ?? "",
    // Novos campos Plano/Venc/Carnê
    plano_acesso: card?.plano_acesso ?? "",
    venc: card?.venc ? String(card.venc) : "",
    carne_impresso: (card?.carne_impresso === true ? 'Sim' : card?.carne_impresso === false ? 'Não' : ''),
    // Novo campo SVA Avulso
    sva_avulso: (card as any)?.sva_avulso ?? "",
  };
  
  const [form, setForm] = useState(initialForm);
  // CTA de planos dentro do dropdown
  const [planCTA, setPlanCTA] = useState<'CGNAT' | 'DIN' | 'FIXO'>('CGNAT');
  const planOptions = React.useMemo(() => {
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
    return base[planCTA];
  }, [planCTA]);
  const [pareceres, setPareceres] = useState<Array<{id:string; author_id?:string; author_name:string; author_role?:string; created_at:string; text:string; updated_by_id?:string; updated_by_name?:string; updated_at?:string; parent_id?:string; level?:number; thread_id?:string; is_thread_starter?:boolean}>>([]);
  const [showNewParecerEditor, setShowNewParecerEditor] = useState(false);
  const [newParecerText, setNewParecerText] = useState("");
  const [editingParecerId, setEditingParecerId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [replyingToParecerId, setReplyingToParecerId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [showFirstConfirmDialog, setShowFirstConfirmDialog] = useState(false);
  const [showSecondConfirmDialog, setShowSecondConfirmDialog] = useState(false);
  const [showDiscardConfirmDialog, setShowDiscardConfirmDialog] = useState(false);
  const [showExpandedModal, setShowExpandedModal] = useState(autoOpenExpanded);
  const [pendingAction, setPendingAction] = useState<'close' | 'save' | null>(null);
  const [deletingParecerId, setDeletingParecerId] = useState<string | null>(null);
  const { profile } = useAuth();
  const { name: currentUserName } = useCurrentUser();
  
  // Estados para sistema de anexos
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  
  // Hook para gerenciar anexos
  const { 
    attachments, 
    isLoading: isLoadingAttachments, 
    isUploading, 
    uploadAttachment, 
    deleteAttachment, 
    getDownloadUrl, 
    formatFileSize, 
    getFileIcon,
    loadAttachments 
  } = useAttachments(card?.id || '', { auto: false, realtime: false });
  // Forçar remount da área de comentários ao anexar/excluir para recarregar listas
  const [commentsRefreshKey, setCommentsRefreshKey] = useState(0);
  const [showComments, setShowComments] = useState(false);

  // Lock body scroll and bring viewport to top while modal is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    // Scroll to top to avoid partially off-screen dialogs when page was scrolled
    try { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); } catch { window.scrollTo(0, 0); }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMaskChange = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Funções para gerenciar anexos
  const handleAttachmentClick = () => {
    setShowAttachmentModal(true);
  };

  const handleUploadAttachment = async (data: any) => {
    try {
      devLog('📎 [ModalEditarFicha] Iniciando upload de anexo...');
      const uploaded = await uploadAttachment(data);
      devLog('📎 [ModalEditarFicha] Upload concluído, recarregando anexos...');
      await loadAttachments();
      devLog('📎 [ModalEditarFicha] Anexos recarregados. Verificando comentário automático de anexo...');

      // Fallback: garantir que exista um comentário de "Anexo adicionado" vinculado
      try {
        if (uploaded && uploaded.file_name && card?.id && profile?.id) {
          // Esperar um pouco para o trigger do banco criar o comentário (se existir)
          await new Promise(r => setTimeout(r, 250));

          // Tentar encontrar comentário criado automaticamente pelo trigger
          const { data: recentComments } = await (supabase as any)
            .from('card_comments')
            .select('id, content, created_at')
            .eq('card_id', card.id)
            .order('created_at', { ascending: false })
            .limit(5);

          const match = (recentComments || []).find((c: any) =>
            typeof c.content === 'string' &&
            /anexo/i.test(c.content) &&
            c.content.toLowerCase().includes(uploaded.file_name.toLowerCase())
          );

          if (match) {
            devLog('📎 [ModalEditarFicha] Comentário automático detectado. Vinculando attachment ao comentário:', match.id);
            // Vincular attachment ao comentário encontrado (se ainda não vinculado)
            try {
              await (supabase as any)
                .from('card_attachments')
                .update({ comment_id: match.id })
                .eq('id', uploaded.id);
            } catch {}
          } else {
            devLog('📎 [ModalEditarFicha] Nenhum comentário automático encontrado. Criando NOVA conversa encadeada...');
            const content = `📎 **Anexo adicionado**\n\n` +
              `📄 **Arquivo:** ${uploaded.file_name}\n` +
              (uploaded.description ? `📝 **Descrição:** ${uploaded.description}\n` : '') +
              `📎 Anexo adicionado: ${uploaded.file_name}`;
            
            const newThreadId = `thread_${card.id}_${Date.now()}`;
            devLog('📎 [ModalEditarFicha] ===== CRIANDO NOVA THREAD =====');
            devLog('📎 [ModalEditarFicha] Dados do comentário (NOVA CONVERSA):', {
              card_id: card.id,
              author_id: profile.id,
              author_name: currentUserName || profile.full_name || 'Usuário',
              author_role: profile.role,
              content: content.substring(0, 100) + '...',
              level: 0,
              thread_id: newThreadId,
              is_thread_starter: true
            });
            
            const { data: manualComment, error: ccErr } = await (supabase as any)
              .from('card_comments')
              .insert({
                card_id: card.id,
                author_id: profile.id,
                author_name: currentUserName || profile.full_name || 'Usuário',
                author_role: profile.role,
                content,
                level: 0,
                thread_id: newThreadId,
                is_thread_starter: true
              })
              .select('id')
              .single();
              
            devLog('📎 [ModalEditarFicha] ===== RESULTADO DA CRIAÇÃO =====');
            devLog('📎 [ModalEditarFicha] Resultado da criação do comentário:', {
              success: !ccErr,
              error: ccErr,
              commentId: manualComment?.id,
              threadId: newThreadId,
              isThreadStarter: true
            });
            if (!ccErr && manualComment?.id) {
              try {
                await (supabase as any)
                  .from('card_attachments')
                  .update({ comment_id: manualComment.id })
                  .eq('id', uploaded.id);
              } catch {}
            }
          }
        }
      } catch (err) {
        devLog('ℹ️ [ModalEditarFicha] Fallback de comentário ignorado:', err);
      }

      // Realtime cuida da sincronização
      // Forçar remount de CommentsList para recarregar comentários e anexos
      setCommentsRefreshKey((k) => k + 1);
    } catch (error) {
      // silencioso para UX
    }
  };

  const handleDownloadAttachment = async (filePath: string, fileName: string) => {
    try {
      const url = await getDownloadUrl(filePath);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading attachment:', error);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      devLog('🗑️ [ModalEditarFicha] Iniciando exclusão de anexo:', attachmentId);
      const success = await deleteAttachment(attachmentId);
      devLog('🗑️ [ModalEditarFicha] Exclusão resultado:', success);
      if (success) {
        devLog('🗑️ [ModalEditarFicha] Recarregando anexos...');
        await loadAttachments();
        devLog('🗑️ [ModalEditarFicha] Anexos recarregados com sucesso');
        // Recarregar comentários também
        if (onRefetch) {
          devLog('🗑️ [ModalEditarFicha] Chamando onRefetch...');
          onRefetch();
        }
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
    }
  };

  const canDeleteAttachment = (attachment: any) => {
    return attachment.author_id === profile?.id;
  };

  // Autosave (debounced) for Nome, Telefone, Prazo (due_at) e Observações (comments)
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        // Update kanban_cards (apenas workflow, sem dados do cliente)
        const updates: any = {};
        // Nome e telefone agora são salvos em applicants, não em kanban_cards
        if (form.agendamento !== initialForm.agendamento) {
          if (form.agendamento) {
            // Save as midnight UTC to keep the date stable across timezones
            const parts = form.agendamento.split('-').map((x) => parseInt(x, 10));
            const y = parts[0], m = parts[1], d = parts[2];
            const midnightUTC = new Date(Date.UTC(y, (m - 1), d, 0, 0, 0));
            updates.due_at = midnightUTC.toISOString();
          } else {
            updates.due_at = null;
          }
        }
        if (form.observacoes !== initialForm.observacoes) updates.comments = form.observacoes;
        
        if (Object.keys(updates).length > 0) {
          await (supabase as any).from('kanban_cards').update(updates).eq('id', card.id);
        }
        
        // Salvar todos os dados do cliente em applicants (um único UPDATE)
        if ((card as any).applicantId) {
          const applicantUpdates: any = {};
          if (form.nome !== initialForm.nome) applicantUpdates.primary_name = form.nome;
          if (form.telefone !== initialForm.telefone) applicantUpdates.phone = form.telefone;
          if (form.cpf !== initialForm.cpf) applicantUpdates.cpf_cnpj = form.cpf.replace(/\D+/g, '');
          if (form.email !== initialForm.email) applicantUpdates.email = form.email;
          if (form.whatsapp !== initialForm.whatsapp) applicantUpdates.whatsapp = form.whatsapp;
          if (form.endereco !== initialForm.endereco) applicantUpdates.address_line = form.endereco;
          if (form.numero !== initialForm.numero) applicantUpdates.address_number = form.numero;
          if (form.complemento !== initialForm.complemento) applicantUpdates.address_complement = form.complemento;
          if (form.cep !== initialForm.cep) applicantUpdates.cep = form.cep;
          if (form.bairro !== initialForm.bairro) applicantUpdates.bairro = form.bairro;
          
          if (Object.keys(applicantUpdates).length > 0) {
            if (import.meta?.env?.DEV) console.log('[ModalEditar] Salvando mudanças em applicants:', applicantUpdates);
            await (supabase as any).from('applicants').update(applicantUpdates).eq('id', (card as any).applicantId);
          }
        }
      } catch (e) {
        // silencioso; evita travar UI
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [form.nome, form.telefone, form.agendamento, form.observacoes, form.cpf, form.whatsapp, form.endereco, form.numero, form.complemento, form.cep, form.bairro, form.email]);
  // incluir dependências novas
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        // Salvar Plano/Venc/Carnê em applicants (fonte-da-verdade)
        if ((card as any).applicantId) {
          const updates: any = {};
          if (form.plano_acesso !== initialForm.plano_acesso) updates.plano_acesso = form.plano_acesso;
          if (form.venc !== initialForm.venc) updates.venc = form.venc ? Number(form.venc) : null;
          if (form.carne_impresso !== initialForm.carne_impresso) updates.carne_impresso = form.carne_impresso === 'Sim' ? true : form.carne_impresso === 'Não' ? false : null;
          if (form.sva_avulso !== initialForm.sva_avulso) updates.sva_avulso = form.sva_avulso;
          if (Object.keys(updates).length > 0) {
            await (supabase as any).from('applicants').update(updates).eq('id', (card as any).applicantId);
          }
        }
      } catch {}
    }, 700);
    return () => clearTimeout(timer);
  }, [form.plano_acesso, form.venc, form.carne_impresso, form.sva_avulso]);

  // Load pareceres (read-only) from backend for this ficha/card
  const loadPareceres = useCallback(async () => {
    try {
      // Try kanban_cards first
      const { data: kc } = await (supabase as any)
        .from('kanban_cards')
        .select('reanalysis_notes')
        .eq('id', card.id)
        .maybeSingle();
      let list: any[] = [];
      if (kc && (kc as any).reanalysis_notes) {
        const notes = (kc as any).reanalysis_notes;
        if (Array.isArray(notes)) {
          list = notes;
        } else if (typeof notes === 'string') {
          try { list = JSON.parse(notes) || []; } catch {}
        }
      }
      // Migrar pareceres antigos que não têm estrutura hierárquica
      const migratedList = (Array.isArray(list) ? list : []).map(parecer => {
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
      const activePareceres = migratedList.filter(parecer => !parecer.deleted);
      devLog('📊 [ModalEditar] Pareceres carregados:', migratedList.length, 'Ativos:', activePareceres.length);
      startTransition(() => setPareceres(activePareceres));
    } catch (e) {
      startTransition(() => setPareceres([]));
    }
  }, [card?.id]);

  // Permitir que filhos (modais PF/PJ) forcem o recarregamento local de pareceres
  const triggerLocalRefetch = useCallback(async () => {
    // 1) Recarregar pareceres
    loadPareceres();
    // 2) Recarregar campos básicos do card para espelhar imediatamente no formulário
    try {
      if (!card?.id) return;
      const { data: k } = await (supabase as any)
        .from('kanban_cards')
        .select('due_at, applicant_id')
        .eq('id', card.id)
        .maybeSingle();
      if (!k) return;
      const applicantId = (k as any).applicant_id || (card as any)?.applicantId;
      let a: any = {};
      if (applicantId) {
        const { data: aData } = await (supabase as any)
          .from('applicants')
          .select('email, whatsapp, address_line, address_number, address_complement, bairro, cep, plano_acesso, venc, carne_impresso, sva_avulso')
          .eq('id', applicantId)
          .maybeSingle();
        a = aData || {};
      }
      setForm((prev) => ({
        ...prev,
        email: a.email ?? prev.email,
        whatsapp: a.whatsapp ?? prev.whatsapp,
        endereco: a.address_line ?? prev.endereco,
        numero: a.address_number ?? prev.numero,
        complemento: a.address_complement ?? prev.complemento,
        cep: a.cep ?? prev.cep,
        bairro: a.bairro ?? prev.bairro,
        agendamento: (k as any).due_at ? toDateInput((k as any).due_at) : prev.agendamento,
        plano_acesso: a.plano_acesso ?? prev.plano_acesso,
        venc: typeof a.venc !== 'undefined' && a.venc !== null ? String(a.venc) : prev.venc,
        carne_impresso: typeof a.carne_impresso === 'boolean' ? (a.carne_impresso ? 'Sim' : 'Não') : prev.carne_impresso,
        sva_avulso: a.sva_avulso ?? prev.sva_avulso,
      }));
    } catch (_) {
      // silencioso
    }
    // 3) Avisar o pai (se existir) para recarregar listagens
    onRefetch?.();
  }, [loadPareceres, onRefetch, card?.id]);

  // Defer carregar pareceres para após primeiro paint (melhor UX de abertura)
  useEffect(() => {
    const t = setTimeout(() => { loadPareceres(); }, 0);
    return () => clearTimeout(t);
  }, [loadPareceres]);

  // Carregar valores atuais dando preferência a Applicants (fonte de verdade)
  useEffect(() => {
    const loadInitialForm = async () => {
      try {
        if (!card?.id) return;
        const applicantId = (card as any)?.applicantId;
        if (applicantId) {
          // Buscar Applicants primeiro e espelhar no formulário
          const { data: a } = await (supabase as any)
            .from('applicants')
            .select('primary_name, phone, cpf_cnpj, email, whatsapp, address_line, address_number, address_complement, bairro, cep, plano_acesso, venc, carne_impresso, sva_avulso')
            .eq('id', applicantId)
            .maybeSingle();
          if (a) {
            setForm((prev) => ({
              ...prev,
              nome: a.primary_name ?? prev.nome,
              telefone: a.phone ?? prev.telefone,
              cpf: a.cpf_cnpj ?? prev.cpf,
              email: a.email ?? prev.email,
              whatsapp: a.whatsapp ?? prev.whatsapp,
              endereco: a.address_line ?? prev.endereco,
              numero: a.address_number ?? prev.numero,
              complemento: a.address_complement ?? prev.complemento,
              cep: a.cep ?? prev.cep,
              bairro: a.bairro ?? prev.bairro,
              plano_acesso: a.plano_acesso ?? prev.plano_acesso,
              venc: typeof a.venc !== 'undefined' && a.venc !== null ? String(a.venc) : prev.venc,
              carne_impresso: typeof a.carne_impresso === 'boolean' ? (a.carne_impresso ? 'Sim' : 'Não') : prev.carne_impresso,
              sva_avulso: a.sva_avulso ?? prev.sva_avulso,
            }));
          }
          // Buscar due_at do card para o campo de agendamento
          const { data: k2 } = await (supabase as any)
            .from('kanban_cards')
            .select('due_at')
            .eq('id', card.id)
            .maybeSingle();
          if (k2?.due_at) {
            setForm((prev) => ({ ...prev, agendamento: toDateInput(k2.due_at) }));
          }
        } else {
          // Fallback: buscar card e depois applicants
          const { data: k } = await (supabase as any)
            .from('kanban_cards')
            .select('due_at, applicant_id')
            .eq('id', card.id)
            .maybeSingle();
          if (!k) return;
          let a: any = {};
          if ((k as any).applicant_id) {
            const { data: aData } = await (supabase as any)
              .from('applicants')
              .select('primary_name, phone, cpf_cnpj, email, whatsapp, address_line, address_number, address_complement, bairro, cep, plano_acesso, venc, carne_impresso, sva_avulso')
              .eq('id', (k as any).applicant_id)
              .maybeSingle();
            a = aData || {};
          }
          setForm((prev) => ({
            ...prev,
            email: a.email ?? prev.email,
            whatsapp: a.whatsapp ?? prev.whatsapp,
            endereco: a.address_line ?? prev.endereco,
            numero: a.address_number ?? prev.numero,
            complemento: a.address_complement ?? prev.complemento,
            cep: a.cep ?? prev.cep,
            bairro: a.bairro ?? prev.bairro,
            agendamento: (k as any).due_at ? toDateInput((k as any).due_at) : prev.agendamento,
            plano_acesso: a.plano_acesso ?? prev.plano_acesso,
            venc: typeof a.venc !== 'undefined' && a.venc !== null ? String(a.venc) : prev.venc,
            carne_impresso: typeof a.carne_impresso === 'boolean' ? (a.carne_impresso ? 'Sim' : 'Não') : prev.carne_impresso,
            sva_avulso: a.sva_avulso ?? prev.sva_avulso,
          }));
        }
      } catch (_) {
        // silencioso
      }
    };
    const t = setTimeout(() => { loadInitialForm(); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id]);

  // 🔴 REALTIME: Sincronizar pareceres quando o card for atualizado
  useEffect(() => {
    if (!card?.id) return;
    
    devLog('🔴 [ModalEditar] Configurando Realtime para pareceres do card:', card.id);
    
    const channel = supabase
      .channel(`pareceres-modal-editar-${card.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kanban_cards', filter: `id=eq.${card.id}` },
        (payload) => {
          devLog('🔴 [ModalEditar] Card atualizado, recarregando pareceres:', payload);
          startTransition(() => loadPareceres());
          const k: any = (payload as any).new || {};
          // Espelhar apenas campos básicos do card (demais vêm de applicants)
          startTransition(() => {
            setForm((prev) => {
              const next = {
                ...prev,
                nome: k.title ?? prev.nome,
                telefone: k.phone ?? prev.telefone,
                cpf: k.cpf_cnpj ?? prev.cpf,
                agendamento: k.due_at ? toDateInput(k.due_at) : prev.agendamento,
              };
              return shallowEqual(prev, next) ? prev : next;
            });
          });
        }
      )
      .subscribe((status) => {
        devLog('🔴 [ModalEditar] Status da subscrição Realtime de pareceres:', status);
      });
    
    return () => {
      devLog('🔴 [ModalEditar] Removendo subscrição Realtime de pareceres');
      supabase.removeChannel(channel);
    };
  }, [card?.id, loadPareceres]);

  // 🔴 REALTIME de applicants desativado para evitar jank durante edição
  useEffect(() => {
    if (!ENABLE_APPLICANT_REALTIME) return;
    const applicantId = (card as any)?.applicantId;
    if (!applicantId) return;
    const channel = supabase
      .channel(`applicant-fields-${applicantId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'applicants', filter: `id=eq.${applicantId}` },
        (payload) => {
          const a: any = (payload as any).new || {};
          startTransition(() => {
            setForm((prev) => {
              const next = {
                ...prev,
                nome: typeof a.primary_name !== 'undefined' ? (a.primary_name ?? prev.nome) : prev.nome,
                telefone: typeof a.phone !== 'undefined' ? (a.phone ?? prev.telefone) : prev.telefone,
                cpf: typeof a.cpf_cnpj !== 'undefined' ? (a.cpf_cnpj ?? prev.cpf) : prev.cpf,
                email: typeof a.email !== 'undefined' ? (a.email ?? prev.email) : prev.email,
                whatsapp: typeof a.whatsapp !== 'undefined' ? (a.whatsapp ?? prev.whatsapp) : prev.whatsapp,
                endereco: typeof a.address_line !== 'undefined' ? (a.address_line ?? prev.endereco) : prev.endereco,
                numero: typeof a.address_number !== 'undefined' ? (a.address_number ?? prev.numero) : prev.numero,
                complemento: typeof a.address_complement !== 'undefined' ? (a.address_complement ?? prev.complemento) : prev.complemento,
                cep: typeof a.cep !== 'undefined' ? (a.cep ?? prev.cep) : prev.cep,
                bairro: typeof a.bairro !== 'undefined' ? (a.bairro ?? prev.bairro) : prev.bairro,
                plano_acesso: typeof a.plano_acesso !== 'undefined' ? (a.plano_acesso ?? prev.plano_acesso) : prev.plano_acesso,
                venc: typeof a.venc !== 'undefined' && a.venc !== null ? String(a.venc) : prev.venc,
                carne_impresso: typeof a.carne_impresso === 'boolean' ? (a.carne_impresso ? 'Sim' : 'Não') : prev.carne_impresso,
                sva_avulso: typeof a.sva_avulso !== 'undefined' ? (a.sva_avulso ?? prev.sva_avulso) : prev.sva_avulso,
              };
              return shallowEqual(prev, next) ? prev : next;
            });
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ENABLE_APPLICANT_REALTIME, (card as any)?.applicantId]);

  // Create new parecer and persist
  const handleCreateParecer = async () => {
    const text = newParecerText.trim();
    if (!text) return;
    const roleLabel = profile?.role ? String(profile.role) : 'colaborador';
    const newP = {
      id: crypto.randomUUID(),
      author_id: profile?.id || 'current-user-id',
      author_name: currentUserName,
      author_role: roleLabel,
      created_at: new Date().toISOString(),
      text,
      parent_id: null,
      level: 0, // Parecer principal
      thread_id: crypto.randomUUID(), // Novo thread para cada parecer principal
      is_thread_starter: true
    };
    // Merge with current DB notes to prevent overwriting
    let currentNotes: any[] = [];
    {
      const { data } = await (supabase as any)
        .from('kanban_cards')
        .select('reanalysis_notes')
        .eq('id', card.id)
        .maybeSingle();
      const raw = (data as any)?.reanalysis_notes;
      if (Array.isArray(raw)) currentNotes = raw as any[];
      else if (typeof raw === 'string') { try { currentNotes = JSON.parse(raw) || []; } catch {}
      }
    }
    
    // ✅ IMPORTANTE: Manter pareceres deletados no banco (soft delete) para histórico
    // mas adicionar o novo parecer à lista completa
    const next = [...currentNotes, newP];
    
    // ✅ Para a UI, mostrar apenas pareceres ativos (sem deleted)
    const activePareceres = next.filter((p: any) => !p.deleted);
    startTransition(() => setPareceres(activePareceres));
    
    setNewParecerText("");
    setShowNewParecerEditor(false);
    
    // ✅ Salvar lista COMPLETA (incluindo deletados para histórico)
    const serialized = JSON.stringify(next);
    try {
      devLog('➕ [ModalEditar] Adicionando novo parecer ao banco:', newP.id);
      const { error } = await (supabase as any)
        .from('kanban_cards')
        .update({ reanalysis_notes: serialized })
        .eq('id', card.id);
      if (error) throw error;
      devLog('✅ [ModalEditar] Parecer adicionado com sucesso! Realtime vai sincronizar outros modais.');
      toast({ title: 'Parecer adicionado', description: 'Seu parecer foi salvo na ficha.' });
    } catch (e: any) {
      console.error('❌ [ModalEditar] Erro ao adicionar parecer:', e);
      toast({ title: 'Erro ao salvar parecer', description: e?.message || String(e), variant: 'destructive' });
    }
  };
  const canEditParecer = (p: {author_id?: string}) => {
    // ✅ VALIDAÇÃO ROBUSTA: Profile deve existir E ter id/role válidos
    if (!profile || !profile.id || !profile.role) {
      if (import.meta?.env?.DEV) console.log('⚠️ canEditParecer: Profile inválido ou incompleto', profile);
      return false;
    }
    
    // Usuário pode editar seu próprio parecer
    if ((p.author_id ?? '') === profile.id) {
      return true;
    }
    
    // Gestor pode editar qualquer parecer
    if (profile.role === 'gestor') {
      return true;
    }
    
    return false;
  };
  const canReplyToParecer = (p: {author_role?: string, level?: number}) => {
    // ✅ VALIDAÇÃO ROBUSTA: Profile deve existir E ter id/role válidos
    if (!profile || !profile.id || !profile.role) {
      if (import.meta?.env?.DEV) console.log('⚠️ canReplyToParecer: Profile inválido ou incompleto', profile);
      return false;
    }
    
    // Apenas gestores podem responder pareceres, e somente se o nível for menor que 7
    const canReply = profile.role === 'gestor' && (p.level || 0) < 7;
    return canReply;
  };

  // Função para organizar pareceres em grupos hierárquicos
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
  const startEditParecer = (id: string, currentText: string) => { setEditingParecerId(id); setEditingText(currentText); };
  const cancelEditParecer = () => { setEditingParecerId(null); setEditingText(""); };
  const startReplyToParecer = (id: string) => { setReplyingToParecerId(id); setReplyText(""); };
  const cancelReplyToParecer = () => { setReplyingToParecerId(null); setReplyText(""); };
  
  const saveReplyToParecer = async () => {
    if (!replyingToParecerId || !card?.id) return;
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
      const { data } = await (supabase as any).from('kanban_cards').select('reanalysis_notes').eq('id', card.id).maybeSingle();
      const raw = (data as any)?.reanalysis_notes;
      if (Array.isArray(raw)) base = raw as any[]; 
      else if (typeof raw === 'string') { try { base = JSON.parse(raw) || []; } catch {} }
      
      // ✅ IMPORTANTE: Adicionar resposta à lista completa (incluindo deletados)
      const updated = [...base, respostaGestor];
      
      // ✅ Para a UI, mostrar apenas pareceres ativos (sem deleted)
      const activePareceres = updated.filter((p: any) => !p.deleted);
      startTransition(() => setPareceres(activePareceres));
      
      // ✅ Salvar lista COMPLETA no banco (incluindo deletados para histórico)
      const serialized = JSON.stringify(updated);
      
      const { error } = await (supabase as any)
        .from('kanban_cards')
        .update({ reanalysis_notes: serialized })
        .eq('id', card.id);
        
      if (error) throw error;
      
      setReplyingToParecerId(null);
      setReplyText("");
      devLog('✅ [ModalEditar] Resposta salva com sucesso! Realtime vai sincronizar outros modais.');
      toast({ title: 'Resposta salva', description: 'Sua resposta foi adicionada ao parecer.' });
    } catch (e: any) {
      console.error('❌ [ModalEditar] Erro ao salvar resposta:', e);
      toast({ title: 'Erro ao salvar resposta', description: e?.message || String(e), variant: 'destructive' });
    }
  };
  
  const saveEditParecer = async () => {
    if (!editingParecerId) return;
    const text = editingText.trim();
    if (!text) return;
    let base: any[] = [];
    const { data } = await (supabase as any)
      .from('kanban_cards')
      .select('reanalysis_notes')
      .eq('id', card.id)
      .maybeSingle();
    const raw = (data as any)?.reanalysis_notes;
    if (Array.isArray(raw)) base = raw as any[]; else if (typeof raw === 'string') { try { base = JSON.parse(raw) || []; } catch {} }
    
    // ✅ Editar na lista completa (incluindo deletados)
    const updated = (base.length ? base : pareceres).map((p: any) => p.id === editingParecerId && canEditParecer(p)
      ? { ...p, text, updated_by_id: profile?.id || 'current-user-id', updated_by_name: currentUserName, updated_at: new Date().toISOString() }
      : p);
    
    // ✅ Para a UI, mostrar apenas pareceres ativos (sem deleted)
    const activePareceres = updated.filter((p: any) => !p.deleted);
    startTransition(() => setPareceres(activePareceres));
    
    setEditingParecerId(null);
    setEditingText("");
    try {
      devLog('✏️ [ModalEditar] Editando parecer no banco:', editingParecerId);
      
      // ✅ Salvar lista COMPLETA no banco (incluindo deletados para histórico)
      const serialized = JSON.stringify(updated);
      const { error } = await (supabase as any).from('kanban_cards').update({ reanalysis_notes: serialized }).eq('id', card.id);
      if (error) throw error;
      devLog('✅ [ModalEditar] Parecer editado com sucesso! Realtime vai sincronizar outros modais.');
      toast({ title: 'Parecer atualizado', description: 'Alteração aplicada com sucesso.' });
    } catch (e: any) {
      console.error('❌ [ModalEditar] Erro ao editar parecer:', e);
      toast({ title: 'Erro ao editar parecer', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  // Funções para exclusão de pareceres
  const handleDeleteParecer = (parecerId: string) => {
    setDeletingParecerId(parecerId);
  };

  const confirmDeleteParecer = async () => {
    if (!deletingParecerId || !card?.id) return;
    
    try {
      devLog('🗑️ Excluindo parecer:', deletingParecerId, 'do card:', card.id);
      
      // Buscar pareceres atuais do banco
      let currentNotes: any[] = [];
      const { data } = await (supabase as any)
        .from('kanban_cards')
        .select('reanalysis_notes')
        .eq('id', card.id)
        .maybeSingle();
      
      devLog('📋 Pareceres atuais do banco:', data);
      
      const raw = (data as any)?.reanalysis_notes;
      if (Array.isArray(raw)) currentNotes = raw as any[];
      else if (typeof raw === 'string') { try { currentNotes = JSON.parse(raw) || []; } catch {} }
      
      devLog('📝 Pareceres parseados:', currentNotes);
      
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
      
      devLog('✅ Parecer marcado como deletado (soft delete):', deletingParecerId);
      
      // Preparar dados para update
      const updateData: any = { reanalysis_notes: serialized };
      
      // Verificar se restaram pareceres ativos (não deletados)
      const activePareceres = updated.filter((p: any) => !p.deleted);
      devLog('📊 Pareceres ativos restantes:', activePareceres.length);
      
      // Salvar no banco
      const { error } = await (supabase as any)
        .from('kanban_cards')
        .update(updateData)
        .eq('id', card.id);
      
      if (error) {
        console.error('❌ Erro ao salvar no banco:', error);
        throw error;
      }
      
      devLog('💾 Parecer marcado como deletado (soft delete) no banco!', updateData);
      
      // Atualizar estado local - remover da lista (já foi filtrado como deletado)
      startTransition(() => setPareceres(prev => prev.filter(p => p.id !== deletingParecerId)));
      setDeletingParecerId(null);
      
      // Chamar onRefetch se disponível para forçar recarregamento
      if (onRefetch) {
        devLog('🔄 Chamando onRefetch...');
        onRefetch();
      }
      
      toast({ title: 'Parecer excluído', description: 'O parecer foi removido com sucesso.' });
    } catch (e: any) {
      console.error('❌ ERRO ao excluir parecer:', e);
      toast({ title: 'Erro ao excluir parecer', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const cancelDeleteParecer = () => {
    setDeletingParecerId(null);
  };

  // Check if form has changes
  const hasChanges = () => {
    return JSON.stringify(form) !== JSON.stringify(initialForm);
  };

  // Persistir imediatamente campos básicos antes de abrir a Análise
  const persistBasicFieldsNow = async () => {
    try {
      if (!card?.id) return;
      // due_at separado (formatar para meia-noite UTC se houver data)
      if (form.agendamento) {
        const parts = form.agendamento.split('-').map((x) => parseInt(x, 10));
        if (parts.length === 3 && !parts.some(isNaN)) {
          const [y, m, d] = parts;
          const midnightUTC = new Date(Date.UTC(y, (m - 1), d, 0, 0, 0));
          await (supabase as any).from('kanban_cards').update({ due_at: midnightUTC.toISOString() }).eq('id', card.id);
        }
      }
      if (!form.agendamento && initialForm.agendamento) {
        await (supabase as any).from('kanban_cards').update({ due_at: null }).eq('id', card.id);
      }

      // Atualizar applicants (se existir) para manter consistência
      if ((card as any).applicantId) {
        const appUpdates: any = {};
        if (form.nome) appUpdates.primary_name = form.nome;
        if (form.telefone) appUpdates.phone = form.telefone;
        if (form.email) appUpdates.email = form.email;
        if (Object.keys(appUpdates).length > 0) {
          await (supabase as any).from('applicants').update(appUpdates).eq('id', (card as any).applicantId);
        }
      }
    } catch (_) {
      // silencioso: não bloquear UX do abrir análise
    }
  };

  const handleAnalyze = async () => {
    // Abra o modal primeiro para sensação de velocidade
    setShowExpandedModal(true);
    // Persistir e sincronizar em background (não bloquear abertura)
    try { await persistBasicFieldsNow(); } catch (_) {}
    try { await triggerLocalRefetch(); } catch (_) {}
  };

  const handleClose = () => {
    if (!hasChanges()) {
      onClose();
      return;
    }
    setPendingAction('close');
    setShowFirstConfirmDialog(true);
  };

  const handleSave = () => {
    if (!hasChanges()) {
      onSave(form);
      return;
    }
    setPendingAction('save');
    setShowFirstConfirmDialog(true);
  };

  const handleFirstConfirm = () => {
    setShowFirstConfirmDialog(false);
    setShowSecondConfirmDialog(true);
  };

  const handleSecondConfirm = async () => {
    setShowSecondConfirmDialog(false);
    // Persistir alterações imediatamente para evitar perda por debounce
    try {
      if (card?.id) {
        // due_at separado (formatado ao meio-dia UTC)
        if (form.agendamento && form.agendamento !== initialForm.agendamento) {
          const parts = form.agendamento.split('-').map((x) => parseInt(x, 10));
          const y = parts[0], m = parts[1], d = parts[2];
          const midnightUTC = new Date(Date.UTC(y, (m - 1), d, 0, 0, 0));
          await (supabase as any).from('kanban_cards').update({ due_at: midnightUTC.toISOString() }).eq('id', card.id);
        }
        if (!form.agendamento && initialForm.agendamento) {
          await (supabase as any).from('kanban_cards').update({ due_at: null }).eq('id', card.id);
        }
      }
    } catch (_) {}
    onSave(form);
    // Defer closing parent modal to allow nested portals to unmount cleanly
    if (pendingAction === 'close') {
      setTimeout(() => onClose(), 0);
    }
    setPendingAction(null);
  };

  const handleDiscardChanges = () => {
    setShowFirstConfirmDialog(false);
    setShowSecondConfirmDialog(false);
    setShowDiscardConfirmDialog(false);
    setPendingAction(null);
    // Defer closing parent modal to avoid removeChild errors from nested portals
    setTimeout(() => onClose(), 0);
  };

  const handleExpandedSubmit = async (data: ComercialFormValues) => {
    // Handle the full form submission
    devLog('Full form submitted:', data);
    setShowExpandedModal(false);
    onRefetch?.();
  };

  const basicInfo = {
    // Usar o estado atual do formulário para espelhar imediatamente na Ficha Completa
    nome: form.nome || card?.nome || '',
    cpf: form.cpf || card?.cpf || '',
    telefone: form.telefone || card?.telefone || '',
    whatsapp: form.whatsapp || card?.whatsapp || card?.telefone || '',
    nascimento: card?.nascimento ? new Date(card.nascimento).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    naturalidade: card?.naturalidade || '', // Virá de pf_fichas_test
    uf: card?.uf || '', // Virá de pf_fichas_test
    email: card?.email || ''
  };

  const feitoEm = initialForm.feito_em;
  const vendedorNome = (card?.vendedorNome) || '';
  const analistaNome = (card?.responsavel) || '';
  // Determinar tipo de pessoa de forma robusta: prioriza flag vinda do card
  const isPJ = (card?.personType === 'PJ') || (card?.person_type === 'PJ');

  const handleOpenInNewTab = () => {
    if (!card?.id) return;
    const url = `${window.location.origin}/ficha/${card.id}`;
    window.open(url, '_blank', 'noopener');
  };

  const handleOpenPrint = () => {
    if (!card?.id) return;
    const url = `${window.location.origin}/ficha/${card.id}/print`;
    window.open(url, '_blank', 'noopener');
  };

  return (
    <div>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={(e) => e.preventDefault()}>
        <div
          className="bg-white text-gray-900 p-0 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header com gradiente moderno */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#018942] via-[#016b35] to-[#014d28] text-white">
            <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true"></div>
            <div className="relative px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img 
                    src="/src/assets/Logo MZNET (1).png" 
                    alt="MZNET Logo" 
                    className="h-8 w-auto"
                  />
                  <div>
                    <h2 className="text-lg font-semibold">Editar Ficha</h2>
                    <p className="text-green-100 text-sm">{card?.nome || 'Cliente'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleOpenPrint} className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-full print-hide" aria-label="Imprimir" title="Imprimir"><Printer className="h-4 w-4" /></Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenInNewTab}
                    className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-full"
                    aria-label="Abrir em nova aba"
                    title="Abrir em nova aba"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-full"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Conteúdo do modal */}
          <div className="p-6 max-h-[calc(95vh-80px)] overflow-y-auto">

        <div className="space-y-6">
          {/* Seção de Informações Pessoais */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Informações Pessoais
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium text-gray-700">Nome do Cliente</Label>
                  <Input
                    name="nome"
                    value={form.nome}
                    onChange={handleChange}
                    placeholder="Nome completo"
                    className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">{card?.personType === 'PJ' ? 'CNPJ' : 'CPF'}</Label>
                  <InputMask
                    mask={card?.personType === 'PJ' ? "99.999.999/9999-99" : "999.999.999-99"}
                    value={form.cpf || ""}
                    onChange={(e) => handleMaskChange('cpf', e.target.value)}
                    maskChar={null}
                    alwaysShowMask={false}
                  >
                    {(inputProps) => (
                      <Input
                        {...inputProps}
                        placeholder={card?.personType === 'PJ' ? "00.000.000/0000-00" : "000.000.000-00"}
                        className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                      />
                    )}
                  </InputMask>
                </div>
              </div>
            </div>
          </div>

          {/* Seção de Contato */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Informações de Contato
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Telefone</Label>
                  <InputMask
                    mask="(99) 99999-9999"
                    value={form.telefone || ""}
                    onChange={(e) => handleMaskChange('telefone', e.target.value)}
                    maskChar={null}
                    alwaysShowMask={false}
                  >
                    {(inputProps) => (
                      <Input
                        {...inputProps}
                        inputMode="tel"
                        type="tel"
                        placeholder="(11) 99999-9999"
                        className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                      />
                    )}
                  </InputMask>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">WhatsApp</Label>
                  <InputMask
                    mask="(99) 99999-9999"
                    value={form.whatsapp || ""}
                    onChange={(e) => handleMaskChange('whatsapp', e.target.value)}
                    maskChar={null}
                    alwaysShowMask={false}
                  >
                    {(inputProps) => (
                      <Input
                        {...inputProps}
                        inputMode="tel"
                        type="tel"
                        placeholder="(11) 99999-9999"
                        className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                      />
                    )}
                  </InputMask>
                </div>
              </div>
            </div>
          </div>
          {/* E-mail abaixo de Telefone e WhatsApp */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              Email
            </h3>
            <div>
              <Label className="text-sm font-medium text-gray-700">E-mail</Label>
              <Input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="cliente@exemplo.com"
                autoComplete="off"
                className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
              />
            </div>
          </div>

          {/* Seção: Endereço */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              Endereço
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium text-gray-700">Logradouro</Label>
                  <Input
                    name="endereco"
                    value={form.endereco}
                    onChange={handleChange}
                    placeholder="Ex: Rua das Flores"
                    className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Número</Label>
                  <Input
                    name="numero"
                    value={form.numero}
                    onChange={handleChange}
                    placeholder="123"
                    className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Complemento</Label>
                  <Input
                    name="complemento"
                    value={form.complemento}
                    onChange={handleChange}
                    placeholder="Apto 45"
                    className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">CEP</Label>
                  <InputMask
                    mask="99999-999"
                    value={form.cep || ""}
                    onChange={(e) => handleMaskChange('cep', e.target.value)}
                    maskChar={null}
                    alwaysShowMask={false}
                  >
                    {(inputProps) => (
                      <Input
                        {...inputProps}
                        placeholder="12345-678"
                        className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                      />
                    )}
                  </InputMask>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Bairro</Label>
                  <Input
                    name="bairro"
                    value={form.bairro}
                    onChange={handleChange}
                    placeholder="Centro"
                    className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Seção: Planos e Serviços */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
              Planos e Serviços
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Plano de Internet</Label>
                  <Select
                    onValueChange={(v) => setForm((p) => ({ ...p, plano_acesso: v }))}
                    value={form.plano_acesso}
                  >
                    <SelectTrigger className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900">
                      <SelectValue placeholder="Selecionar plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="flex gap-2 px-2 py-2 sticky top-0 bg-white/95 border-b">
                        {([
                          { key: 'CGNAT', label: 'CGNAT' },
                          { key: 'DIN', label: 'DINÂMICO' },
                          { key: 'FIXO', label: 'FIXO' },
                        ] as const).map(({ key, label }) => {
                          const active = planCTA === key;
                          return (
                            <Button
                              key={key}
                              type="button"
                              variant="outline"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => { e.stopPropagation(); setPlanCTA(key); setForm((p)=>({...p, plano_acesso: ''})); }}
                              className={(active ? 'bg-[#018942] text-white border-[#018942] hover:bg-[#018942]/90 ' : 'border-[#018942] text-[#018942] hover:bg-[#018942]/10 ') + 'h-7 px-3 text-xs rounded-lg transition-all duration-200'}
                              size="sm"
                            >
                              {label}
                            </Button>
                          );
                        })}
                      </div>
                      {planOptions.map((p) => (
                        <SelectItem key={p} value={p} className="hover:bg-green-50">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                            {p}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Dia de vencimento</Label>
                  <Select
                    onValueChange={(v) => setForm((p) => ({ ...p, venc: v }))}
                    value={form.venc}
                  >
                    <SelectTrigger className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {['5','10','15','20','25'].map(v => (
                        <SelectItem key={v} value={v} className="hover:bg-green-50">Dia {v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">SVA Avulso</Label>
                  <Select
                    onValueChange={(v) => setForm((p) => ({ ...p, sva_avulso: v }))}
                    value={form.sva_avulso}
                  >
                    <SelectTrigger className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900">
                      <SelectValue placeholder="Selecionar serviço adicional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MZ TV+ (MZPLAY PLUS - ITTV): R$29,90 (01 TELA)" className="hover:bg-green-50">MZ TV+ (MZPLAY PLUS - ITTV): R$29,90 (01 TELA)</SelectItem>
                      <SelectItem value="DEZZER: R$15,00" className="hover:bg-green-50">DEZZER: R$15,00</SelectItem>
                      <SelectItem value="MZ CINE-PLAY: R$19,90" className="hover:bg-green-50">MZ CINE-PLAY: R$19,90</SelectItem>
                      <SelectItem value="SETUP BOX MZNET: R$100,00" className="hover:bg-green-50">SETUP BOX MZNET: R$100,00</SelectItem>
                      <SelectItem value="01 WI-FI EXTEND (SEM FIO): R$25,90" className="hover:bg-green-50">01 WI-FI EXTEND (SEM FIO): R$25,90</SelectItem>
                      <SelectItem value="02 WI-FI EXTEND (SEM FIO): R$49,90" className="hover:bg-green-50">02 WI-FI EXTEND (SEM FIO): R$49,90</SelectItem>
                      <SelectItem value="03 WI-FI EXTEND (SEM FIO): R$74,90" className="hover:bg-green-50">03 WI-FI EXTEND (SEM FIO): R$74,90</SelectItem>
                      <SelectItem value="01 WI-FI EXTEND (CABEADO): R$35,90" className="hover:bg-green-50">01 WI-FI EXTEND (CABEADO): R$35,90</SelectItem>
                      <SelectItem value="02 WI-FI EXTEND (CABEADO): R$69,90" className="hover:bg-green-50">02 WI-FI EXTEND (CABEADO): R$69,90</SelectItem>
                      <SelectItem value="03 WI-FI EXTEND (CABEADO): R$100,00" className="hover:bg-green-50">03 WI-FI EXTEND (CABEADO): R$100,00</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Carnê impresso</Label>
                  <Select
                    onValueChange={(v) => setForm((p) => ({ ...p, carne_impresso: v }))}
                    value={form.carne_impresso}
                  >
                    <SelectTrigger className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim" className="hover:bg-green-50">Sim</SelectItem>
                      <SelectItem value="Não" className="hover:bg-green-50">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Seção: Datas */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              Agendamento
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Feito em</Label>
                <DatePicker
                  name="feito_em"
                  value={feitoEm}
                  disabled
                  className="mt-1 rounded-lg border-gray-300 bg-gray-100 text-gray-700 cursor-not-allowed"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Instalação agendada para</Label>
                <DatePicker
                  name="agendamento"
                  value={form.agendamento}
                  onChange={(v) => setForm((prev) => ({ ...prev, agendamento: v }))}
                  className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900"
                  allowTyping={false}
                  showIcon={true}
                  forceFlatpickr={true}
                />
              </div>
            </div>
          </div>

          {/* Seção: Equipe Responsável */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
              Equipe Responsável
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Vendedor</Label>
                <Input
                  value={vendedorNome || "—"}
                  disabled
                  className="mt-1 rounded-lg border-gray-300 bg-gray-100 text-gray-700 cursor-not-allowed"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Analista</Label>
                <Input
                  value={analistaNome || "—"}
                  disabled
                  className="mt-1 rounded-lg border-gray-300 bg-gray-100 text-gray-700 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Pareceres */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Pareceres</Label>
              <Button
                size="sm"
                type="button"
                onClick={() => setShowNewParecerEditor(true)}
                className="bg-[#018942] hover:bg-[#018942]/90 text-white border-[#018942] hover:border-[#018942]/90"
              >
                + Adicionar Parecer
              </Button>
            </div>
            
            {/* Editor de novo parecer - agora aparece acima dos pareceres existentes */}
            {showNewParecerEditor && (
              <div className="mt-2">
                <MentionableTextarea
                  rows={3}
                  value={newParecerText}
                  onChange={(e) => setNewParecerText(e.target.value)}
                  placeholder="Escreva um novo parecer... Use @ para mencionar"
                  className="rounded-[12px] text-[#018942] placeholder-[#018942]"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <Button size="sm" type="button" variant="secondary" onClick={() => { setShowNewParecerEditor(false); setNewParecerText(""); }} className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500 hover:border-gray-600">Cancelar</Button>
                  <Button size="sm" type="button" onClick={handleCreateParecer} className="bg-[#018942] hover:bg-[#018942]/90 text-white border-[#018942] hover:border-[#018942]/90">Salvar Parecer</Button>
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
                              <MentionableTextarea rows={3} value={editingText} onChange={(e) => setEditingText(e.target.value)} className="text-sm text-[#018942]" placeholder="Edite... Use @ para mencionar" />
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
                                  onClick={cancelReplyToParecer}
                                  className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500 hover:border-gray-600"
                                >
                                  Cancelar
                                </Button>
                                <Button
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
                <div className="text-sm text-muted-foreground">Nenhum parecer registrado.</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações e Conversas</Label>
            <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando conversas...</div>}>
              <ObservationsWithComments
                key={commentsRefreshKey}
                name="observacoes"
                value={form.observacoes}
                onChange={handleChange}
                className="rounded-[12px] min-h-[120px] text-[#018942] placeholder-[#018942]"
                placeholder="Use @mencoes para colaboradores..."
                cardId={card?.id || ''}
                onAttachmentClick={handleAttachmentClick}
                onRefetch={onRefetch}
              />
            </Suspense>
          </div>
        </div>

          <div className="flex items-center justify-between mt-8">
            <Button
              size="sm"
              onClick={handleAnalyze}
              className="hover-scale !bg-[hsl(var(--brand))] !text-white hover:!bg-[hsl(var(--brand))/0.9] border border-transparent"
            >
              Analisar
            </Button>
            <div className="flex gap-2">
              {card?.columnId === "em_analise" && (
                <Button size="sm" variant="secondary" onClick={() => { onDesingressar?.(card.id); toast({ title: "Card retornado para Recebidos" }); onClose(); }}>
                  Desingressar
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                className="bg-[#018942] hover:bg-[#018942]/90 text-white border-[#018942] hover:border-[#018942]/90"
              >
                Salvar Alterações
              </Button>
            </div>
          </div>

        </div>
      </div>

      {/* First confirmation dialog */}
      <AlertDialog open={showFirstConfirmDialog} onOpenChange={setShowFirstConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você deseja alterar as informações dessa ficha?</AlertDialogTitle>
            <AlertDialogDescription>
              As informações serão atualizadas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => { setShowFirstConfirmDialog(false); setShowDiscardConfirmDialog(true); }}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
            >
              Descartar alterações
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFirstConfirm}
              className="bg-[#018942] hover:bg-[#018942]/90 text-white border-[#018942] hover:border-[#018942]/90"
            >
              Sim, alterar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard confirmation dialog */}
      <AlertDialog open={showDiscardConfirmDialog} onOpenChange={setShowDiscardConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja descartar as alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação descartará todas as alterações não salvas nesta ficha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscardConfirmDialog(false)} className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500 hover:border-gray-600">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscardChanges}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
            >
              Sim, descartar
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

      <Suspense fallback={null}>
        {isPJ ? (
          <ExpandedFichaPJModal
            open={showExpandedModal}
            onClose={() => setShowExpandedModal(false)}
            applicationId={card?.id}
            onRefetch={triggerLocalRefetch}
            applicantId={(card as any)?.applicantId}
          />
        ) : (
          <ExpandedFichaModal
            open={showExpandedModal}
            onClose={() => setShowExpandedModal(false)}
            onSubmit={handleExpandedSubmit}
            basicInfo={basicInfo}
            applicationId={card?.id}
            applicantId={(card as any)?.applicantId}
            onRefetch={triggerLocalRefetch}
          />
        )}
      </Suspense>

      {/* Modal de Upload de Anexos */}
      <AttachmentUploadModal
        open={showAttachmentModal}
        onClose={() => {
          setShowAttachmentModal(false);
          // Recarregar comentários quando fechar o modal
          if (onRefetch) {
            onRefetch();
          }
        }}
        onUpload={handleUploadAttachment}
        isUploading={isUploading}
        cardId={card?.id || ''}
      />

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
      {/* Fecha o backdrop (fixed inset-0) */}
      </div>
    </div>
  );
}
