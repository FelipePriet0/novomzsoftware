import { useMemo, useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Calendar } from "@/components/ui/calendar";
import DatePicker from "@/components/ui/DatePicker";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar as CalendarIcon, UserPlus, Search, Edit, User, ChevronDown } from "lucide-react";
import ModalEditarFicha from "@/components/ui/ModalEditarFicha";
import NovaFichaComercialForm, { ComercialFormValues } from "@/components/NovaFichaComercialForm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

// New secure ficha creation components
import { ConfirmCreateModal } from "@/components/ficha/ConfirmCreateModal";
import { BasicInfoModal, BasicInfoData } from "@/components/ficha/BasicInfoModal";
import { ExpandedFichaModal } from "@/components/ficha/ExpandedFichaModal";
import { PersonTypeModal } from "@/components/ficha/PersonTypeModal";
import NovaFichaPJForm from "@/components/NovaFichaPJForm";
import { DeleteConfirmDialog } from "@/components/ficha/DeleteConfirmDialog";
import { OptimizedKanbanCard } from "@/components/ficha/OptimizedKanbanCard";
import { AttachmentUploadModal } from "@/components/attachments/AttachmentUploadModal";
import { AttachmentList } from "@/components/attachments/AttachmentDisplay";
import { useAttachments } from "@/hooks/useAttachments";

import { ParecerConfirmModal } from "@/components/ficha/ParecerConfirmModal";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useAuth } from "@/context/AuthContext";
import { canChangeStatus, isPremium } from "@/lib/access";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

// Types
export type ColumnId =
  // Análise
  | "recebido"
  | "em_analise"
  | "reanalise"
  | "aprovado"
  | "negado"
  | "finalizado"
  | "canceladas"
  // Comercial
  | "com_entrada"
  | "com_feitas"
  | "com_aguardando"
  | "com_canceladas"
  | "com_concluidas";

export interface CardItem {
  id: string;
  nome: string;
  cpf?: string;
  receivedAt: string; // ISO
  deadline: string; // ISO
  hasDueAt?: boolean; // indica se veio de due_at (Instalação agendada)
  responsavel?: string; // Nome do responsável (assignee)
  responsavelId?: string; // UUID do responsável (assignee_id do banco)
  telefone?: string;
  email?: string;
  naturalidade?: string;
  uf?: string;
  applicantId?: string;
  personType?: 'PF' | 'PJ'; // Tipo de pessoa (PF ou PJ)
  parecer: string;
  columnId: ColumnId;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastMovedAt: string; // ISO
  labels: string[];
  // Responsáveis
  vendedorNome?: string; // Criador da ficha (comercial)
  analystName?: string;  // Nome do assignee (analista)
  createdById?: string;  // ID do criador
  // Comercial stage persisted in DB
  commercialStage?: 'entrada' | 'feitas' | 'aguardando' | 'canceladas' | 'concluidas';
  // Área atual do card (comercial ou analise)
  area?: 'comercial' | 'analise';
}


const COLUMNS: { id: ColumnId; title: string }[] = [
  { id: "recebido", title: "Recebido" },
  { id: "em_analise", title: "Em Análise" },
  { id: "reanalise", title: "Reanálise" },
  { id: "aprovado", title: "Aprovado" },
  { id: "negado", title: "Negado" },
  { id: "canceladas", title: "Canceladas" },
  { id: "finalizado", title: "Finalizado" },
];

const COMMERCIAL_COLUMNS: { id: ColumnId; title: string }[] = [
  { id: "com_entrada", title: "Entrada" },
  { id: "com_feitas", title: "Feitas / Cadastrar no Mk" },
  { id: "com_aguardando", title: "Aguardando Documento" },
  { id: "com_canceladas", title: "Canceladas" },
  { id: "com_concluidas", title: "Concluídas" },
];

// Utils
// Fast business-hours approximation (no per-hour loop)
function businessHoursBetween(startISO: string, endISO: string) {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (!isFinite(start) || !isFinite(end) || end <= start) return 0;
  const hours = Math.floor((end - start) / (1000 * 60 * 60));
  return Math.max(0, hours);
}

function isOverdue(card: CardItem): boolean {
  const now = new Date();
  const nowISO = now.toISOString();
  if (card.columnId === "recebido" || card.columnId === "em_analise") {
    return businessHoursBetween(card.lastMovedAt || card.createdAt, nowISO) > 24;
  }
  if (card.columnId === "reanalise") {
    return businessHoursBetween(card.lastMovedAt || card.createdAt, nowISO) > 48;
  }
  return false;
}

// Clean initial data for CEO presentation
const initialCards: CardItem[] = [];

const RESPONSAVEIS: string[] = [];

type PrazoFiltro = "todos" | "hoje" | "amanha" | "atrasados" | "data";
type ViewFilter = "all" | "mine" | "company";
type AtribuidasFilter = 'none' | 'mentions' | 'tasks';
type KanbanArea = "analise" | "comercial";
type CommercialStage = Extract<ColumnId, `com_${string}`>;
type CommercialStageDB = 'entrada' | 'feitas' | 'aguardando' | 'canceladas' | 'concluidas';

export default function KanbanBoard() {
  const [cards, setCards] = useState<CardItem[]>(initialCards);
  const [query, setQuery] = useState("");
  const [responsavelFiltro, setResponsavelFiltro] = useState<string[]>([]);
  const [prazoFiltro, setPrazoFiltro] = useState<PrazoFiltro>("todos");
  const [prazoOpenTick, setPrazoOpenTick] = useState(0);
  const [prazoData, setPrazoData] = useState<Date | null>(null);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [atribuidasFiltro, setAtribuidasFiltro] = useState<AtribuidasFilter>('none');
  const [atribuidasCardIds, setAtribuidasCardIds] = useState<Set<string>>(new Set());
  // Foco inicial no setor comercial (habilitado para DnD)
  const [kanbanArea, setKanbanArea] = useState<KanbanArea>("comercial");
  // Old state - kept for compatibility
  const [openNew, setOpenNew] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState<{
    id: string;
    nome: string;
    telefone: string;
    responsavel?: string;
    parecer: string;
    recebido?: Date;
    prazo?: Date;
  } | null>(null);
  const [mockCard, setMockCard] = useState<CardItem | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [autoOpenExpandedNext, setAutoOpenExpandedNext] = useState(false);
  const [reanalysts, setReanalysts] = useState<Array<{id: string; full_name: string; avatar_url?: string; company_id?: string}>>([]);

  // New secure creation flow state
  const [showConfirmCreate, setShowConfirmCreate] = useState(false);
  const [showPersonType, setShowPersonType] = useState(false);
  const [showBasicInfo, setShowBasicInfo] = useState(false);
  const [showNovaPj, setShowNovaPj] = useState(false);
  const [showExpandedForm, setShowExpandedForm] = useState(false);
  const [basicInfoData, setBasicInfoData] = useState<BasicInfoData | null>(null);
  const [pendingApplicationId, setPendingApplicationId] = useState<string | null>(null);
  const location = useLocation();
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<CardItem | null>(null);
  
  // Parecer confirmation state
  const [showParecerConfirm, setShowParecerConfirm] = useState(false);
  const [parecerAction, setParecerAction] = useState<{
    action: 'aprovar' | 'negar' | 'reanalisar';
    card: CardItem;
  } | null>(null);
  const [resumeSessionChecked, setResumeSessionChecked] = useState(false);
  
  // Estado para feedback visual do drag and drop
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);
  const [draggedCard, setDraggedCard] = useState<CardItem | null>(null);
  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelCardId, setCancelCardId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ColumnId | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // ===== FALLBACK QUEUE (quando RPC falhar) =====
  const FALLBACK_MOVES_KEY = 'kanban_fallback_moves';

  function enqueueFallbackMove(move: { cardId: string; toArea: 'comercial' | 'analise'; toStage: string; comment?: string; at: string; }) {
    try {
      const arr = JSON.parse(localStorage.getItem(FALLBACK_MOVES_KEY) || '[]');
      arr.push(move);
      localStorage.setItem(FALLBACK_MOVES_KEY, JSON.stringify(arr));
    } catch {}
  }

  async function processFallbackMoves() {
    try {
      const arr: Array<{ cardId: string; toArea: 'comercial' | 'analise'; toStage: string; comment?: string; at: string; }> = JSON.parse(localStorage.getItem(FALLBACK_MOVES_KEY) || '[]');
      if (!Array.isArray(arr) || arr.length === 0) return;
      const remaining: typeof arr = [];
      for (const mv of arr) {
        try {
          const { error } = await (supabase as any).rpc('change_stage', {
            p_card_id: mv.cardId,
            p_to_area: mv.toArea,
            p_to_stage: mv.toStage,
            p_comment: mv.comment || null,
          });
          if (error) {
            remaining.push(mv); // manter na fila
          }
        } catch {
          remaining.push(mv);
        }
      }
      localStorage.setItem(FALLBACK_MOVES_KEY, JSON.stringify(remaining));
      if (remaining.length === 0) {
        // Sincronizado com sucesso
        setTimeout(() => loadApplications(), 100);
      }
    } catch {}
  }

  // Tenta processar fila de fallbacks ao montar e ao focar a janela
  useEffect(() => {
    processFallbackMoves();
    const onFocus = () => processFallbackMoves();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [isScrolling, setIsScrolling] = useState(false);
  
  // Estados para sistema de anexos
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [selectedCardForAttachment, setSelectedCardForAttachment] = useState<string | null>(null);

  const { name: currentUserName } = useCurrentUser();
  const { profile } = useAuth();
  const { checkForExistingSession } = useDraftPersistence();
  
  // Hook para gerenciar anexos do card selecionado
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
  } = useAttachments(selectedCardForAttachment || '');
  // In commercial area, allow all roles to move; in analysis, keep role-gated
  const allowMove = kanbanArea === 'comercial' ? true : canChangeStatus(profile);

  // Load cards from Supabase (kanban_cards + applicants)
  const loadApplications = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("kanban_cards")
        .select(`
          id,
          area,
          stage,
          person_type,
          assignee_id,
          created_by,
          title,
          cpf_cnpj,
          phone,
          email,
          received_at,
          due_at,
          source,
          applicant:applicant_id ( id, primary_name, email ),
          assignee:assignee_id ( id, full_name ),
          creator:created_by ( id, full_name )
        `)
        .is('deleted_at', null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data) return;
      const mapped: CardItem[] = (data as any[]).map((row: any) => {
        const receivedAt = row.received_at ? new Date(row.received_at).toISOString() : new Date().toISOString();
      const hasDueAt = !!row.due_at;
      const deadline = hasDueAt ? new Date(row.due_at).toISOString() : receivedAt;
      return {
        id: row.id,
        nome: row.title ?? row.applicant?.primary_name ?? 'Cliente',
          cpf: row.cpf_cnpj ?? '',
          receivedAt,
          deadline,
          hasDueAt,
          responsavel: row.assignee?.full_name ?? undefined,
          responsavelId: row.assignee_id ?? undefined,
          telefone: row.phone ?? undefined,
          email: row.email ?? row.applicant?.email ?? undefined,
          naturalidade: undefined, // Será carregado de pf_fichas_test se necessário
          uf: undefined, // Será carregado de pf_fichas_test se necessário
          applicantId: row.applicant?.id ?? undefined,
          personType: row.person_type ?? undefined,
          parecer: '',
          vendedorNome: row.creator?.full_name ?? undefined,
          analystName: row.assignee?.full_name ?? undefined,
          createdById: row.created_by ?? undefined,
          columnId: ((): ColumnId => {
            if (row.area === 'comercial') {
              const stageMap: Record<string, ColumnId> = {
                'entrada': 'com_entrada',
                'feitas': 'com_feitas',
                'aguardando_doc': 'com_aguardando',
                'canceladas': 'com_canceladas',
                'concluidas': 'com_concluidas'
              };
              return stageMap[row.stage] || 'com_entrada';
            } else {
              return (row.stage as ColumnId) || 'recebido';
            }
          })(),
          createdAt: receivedAt,
          updatedAt: receivedAt,
          lastMovedAt: receivedAt,
          labels: [],
          commercialStage: row.area === 'comercial' ? ((): any => {
            const m: any = { entrada: 'entrada', feitas: 'feitas', aguardando_doc: 'aguardando', canceladas: 'canceladas', concluidas: 'concluidas' };
            return m[row.stage] ?? 'entrada';
          })() : undefined,
          area: row.area as 'comercial' | 'analise',
        } as CardItem;
      });
      console.log('Loaded cards:', mapped.length);
      console.log('Cards by column:', mapped.map(c => ({ id: c.id, nome: c.nome, columnId: c.columnId })));
      setCards(mapped);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[Kanban] Falha ao carregar aplicações", e);
    }
  };

  // Abrir card por query param (?openCardId=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get('openCardId');
    if (!openId) return;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('kanban_cards')
          .select('id, title, cpf_cnpj, phone, email, received_at, person_type, area, stage')
          .eq('id', openId)
          .maybeSingle();
        if (!error && data) {
          const nc: CardItem = {
            id: data.id,
            nome: data.title,
            cpf: data.cpf_cnpj || '',
            receivedAt: data.received_at || new Date().toISOString(),
            deadline: data.received_at || new Date().toISOString(),
            responsavel: undefined,
            responsavelId: undefined,
            telefone: data.phone || undefined,
            email: data.email || undefined,
            naturalidade: undefined,
            uf: undefined,
            applicantId: undefined,
            personType: (data as any)?.person_type || undefined,
            parecer: '',
            columnId: ((data as any)?.area === 'comercial') ? ((): any => {
              const stageMap: Record<string, any> = { entrada: 'com_entrada', feitas: 'com_feitas', aguardando_doc: 'com_aguardando', canceladas: 'com_canceladas', concluidas: 'com_concluidas' };
              return stageMap[(data as any)?.stage] || 'com_entrada';
            })() : 'recebido',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastMovedAt: new Date().toISOString(),
            labels: [],
            area: ((data as any)?.area || 'analise') as any,
          } as any;
          setMockCard(nc);
          setAutoOpenExpandedNext(true);
        }
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Função para atualizar o estado local em tempo real
  const handleStatusChange = (cardId: string, newStatus: string) => {
    setCards(prevCards => 
      prevCards.map(card => 
        card.id === cardId 
          ? { ...card, columnId: newStatus as ColumnId, lastMovedAt: new Date().toISOString() }
          : card
      )
    );
  };

  // Funções para gerenciar anexos
  const handleAttachmentClick = (cardId: string) => {
    setSelectedCardForAttachment(cardId);
    setShowAttachmentModal(true);
  };

  const handleUploadAttachment = async (data: any) => {
    if (!selectedCardForAttachment) return;
    
    try {
      await uploadAttachment(data);
      // Recarregar anexos após upload
      await loadAttachments();
    } catch (error) {
      console.error('Error uploading attachment:', error);
    }
  };

  const handleDownloadAttachment = async (filePath: string, fileName: string) => {
    try {
      const url = await getDownloadUrl(filePath);
      if (url) {
        // Criar link temporário para download
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
      await deleteAttachment(attachmentId);
      // Recarregar anexos após exclusão
      await loadAttachments();
    } catch (error) {
      console.error('Error deleting attachment:', error);
    }
  };

  const canDeleteAttachment = (attachment: any) => {
    return attachment.author_id === profile?.id;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Requer 8px de movimento antes de iniciar drag
      },
    })
  );

  // Derived lists
  const responsaveisOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) {
      if (c.responsavel) set.add(c.responsavel);
      if (c.vendedorNome) set.add(c.vendedorNome);
    }
    return Array.from(set);
  }, [cards]);

  // Resolve o ID do responsável selecionado a partir do nome
  const resolvedResponsavelId = useMemo(() => {
    if (!Array.isArray(responsavelFiltro) || responsavelFiltro.length !== 1) return null;
    const selected = responsavelFiltro[0];
    // Tenta resolver pelo analista (assignee)
    for (const c of cards) {
      if ((c.responsavel || '') === selected && c.responsavelId) {
        return c.responsavelId;
      }
    }
    // Tenta resolver pelo vendedor (criador da ficha)
    for (const c of cards) {
      if ((c.vendedorNome || '') === selected && c.createdById) {
        return c.createdById;
      }
    }
    return null;
  }, [responsavelFiltro, cards]);

  // Carrega ids de cards com tarefas atribuídas ou menções (desvinculado do filtro Responsável; usa o selecionado OU o usuário atual)
  useEffect(() => {
    (async () => {
      try {
        // Reset quando não aplicável
        const targetUserId = resolvedResponsavelId || profile?.id || null;
        if (atribuidasFiltro === 'none' || !targetUserId) {
          setAtribuidasCardIds(new Set());
          return;
        }
        const visibleIds = cards.map(c => c.id);
        if (visibleIds.length === 0) {
          setAtribuidasCardIds(new Set());
          return;
        }
        if (atribuidasFiltro === 'tasks') {
          const { data, error } = await (supabase as any)
            .from('card_tasks')
            .select('card_id')
            .is('deleted_at', null)
            .eq('assigned_to', targetUserId)
            .in('card_id', visibleIds);
          if (error) throw error;
          setAtribuidasCardIds(new Set((data || []).map((r: any) => r.card_id)));
        } else if (atribuidasFiltro === 'mentions') {
          // Extrai um token simples do nome (selecionado ou do usuário atual) para procurar por @Token
          const fallbackName = profile?.full_name || '';
          const selectedName = Array.isArray(responsavelFiltro) && responsavelFiltro.length === 1 ? responsavelFiltro[0] : fallbackName;
          const token = (selectedName || '').split(' ')[0];
          if (!token) { setAtribuidasCardIds(new Set()); return; }
          // 1) Comentários/threads (card_comments) - servidor
          const { data: cData, error: cErr } = await (supabase as any)
            .from('card_comments')
            .select('card_id')
            .is('deleted_at', null)
            .in('card_id', visibleIds)
            .ilike('content', `%@${token}%`);
          if (cErr) throw cErr;
          const commentIds = new Set((cData || []).map((r: any) => r.card_id));
          // 2) Pareceres (reanalysis_notes em kanban_cards) - evitar 404: filtrar no cliente
          let parecerIds = new Set<string>();
          const { data: rnAll, error: rnAllErr } = await (supabase as any)
            .from('kanban_cards')
            .select('id, reanalysis_notes')
            .in('id', visibleIds);
          if (!rnAllErr) {
            const matched = (rnAll || []).filter((row: any) => {
              const raw = row.reanalysis_notes;
              let arr: any[] = [];
              if (Array.isArray(raw)) arr = raw as any[];
              else if (typeof raw === 'string') { try { arr = JSON.parse(raw) || []; } catch {}
              }
              return (arr || []).some((p: any) => !p?.deleted && typeof p?.text === 'string' && p.text.includes(`@${token}`));
            }).map((row: any) => row.id);
            parecerIds = new Set(matched);
          }
          // União dos conjuntos
          const commentIdsArray = Array.from(commentIds) as string[];
          const parecerIdsArray = Array.from(parecerIds) as string[];
          const union = new Set<string>([...commentIdsArray, ...parecerIdsArray]);
          setAtribuidasCardIds(union);
        }
      } catch (_) {
        setAtribuidasCardIds(new Set());
      }
    })();
  }, [atribuidasFiltro, resolvedResponsavelId, responsavelFiltro, cards]);

  const getCommercialStage = (card: CardItem): CommercialStage => {
    const map: Record<CommercialStageDB, CommercialStage> = {
      entrada: 'com_entrada',
      feitas: 'com_feitas',
      aguardando: 'com_aguardando',
      canceladas: 'com_canceladas',
      concluidas: 'com_concluidas',
    };
    return map[(card.commercialStage || 'entrada') as CommercialStageDB];
  };


  function handleDragStart(event: DragStartEvent) {
    const cardId = event.active.id as string;
    const card = cards.find(c => c.id === cardId);
    console.log('Drag started:', cardId);
    setActiveId(cardId);
    setDraggedCard(card || null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    
    if (!over) {
      setOverId(null);
      setDragOverColumn(null);
      return;
    }
    
    setOverId(over.id as string);
    
    // Se está sobre uma coluna, definir a coluna de destino
    if (over.data.current?.type === 'column') {
      setDragOverColumn(over.id as ColumnId);
    } else {
      setDragOverColumn(null);
    }

    // Auto-scroll como o Trello
    handleAutoScroll(event);
  }

  function handleAutoScroll(event: DragOverEvent) {
    const { active } = event;
    
    if (!active.rect.current.translated) return;
    
    const { top, bottom } = active.rect.current.translated;
    const container = document.querySelector('.kanban-container');
    
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const scrollThreshold = 100;
    
    // Scroll para cima se próximo do topo
    if (top < containerRect.top + scrollThreshold) {
      container.scrollBy({ top: -10, behavior: 'smooth' });
      setIsScrolling(true);
    }
    // Scroll para baixo se próximo da parte inferior
    else if (bottom > containerRect.bottom - scrollThreshold) {
      container.scrollBy({ top: 10, behavior: 'smooth' });
      setIsScrolling(true);
    }
    else {
      setIsScrolling(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    // Limpar estados
    setActiveId(null);
    setOverId(null);
    setDragOverColumn(null);
    setDraggedCard(null);
    
    // Verificar se há um destino válido
    if (!over) {
      console.log('No drop target found');
      return;
    }
    
    // Verificar se o usuário pode mover cards
    if (!allowMove) {
      console.log('User not allowed to move cards');
      return;
    }
    
    const cardId = active.id as string;
    const targetColumn = over.id as ColumnId;

    // Bloquear movimentação para "Entrada" (somente e-fichas via backend)
    if (targetColumn === 'com_entrada') {
      toast({ title: 'Movimento não permitido', description: 'Entrada é automática via e‑fichas', variant: 'destructive' });
      return;
    }

    // Abrir modal de cancelamento para "Canceladas"
    if (targetColumn === 'com_canceladas' || targetColumn === 'canceladas') {
      setCancelCardId(cardId);
      setCancelTarget(targetColumn);
      setCancelReason("");
      setShowCancelModal(true);
      return;
    }
    
    // Verificar se o card está sendo movido para a mesma coluna
    const currentCard = cards.find(c => c.id === cardId);
    if (currentCard && currentCard.columnId === targetColumn) {
      console.log('Card is already in this column');
      return;
    }
    
    console.log('Moving card:', cardId, 'to column:', targetColumn);
    moveTo(cardId, targetColumn);
  }

  async function confirmCancel() {
    if (!cancelCardId || !cancelReason.trim()) {
      toast({ title: 'Motivo obrigatório', description: 'Informe o motivo do cancelamento.', variant: 'destructive' });
      return;
    }
    try {
      const isCommercial = cancelTarget === 'com_canceladas';
      // Atualiza no banco com a regra do backend (trigger exige motivo)
      const { error } = await (supabase as any)
        .from('kanban_cards')
        .update({ area: isCommercial ? 'comercial' : 'analise', stage: 'canceladas', cancel_reason: cancelReason.trim() })
        .eq('id', cancelCardId);
      if (error) throw error;

      // Atualização otimista na UI
      setCards(prev => prev.map(c => c.id === cancelCardId ? {
        ...c,
        columnId: cancelTarget || 'com_canceladas',
        area: isCommercial ? 'comercial' : 'analise',
        commercialStage: isCommercial ? 'canceladas' : c.commercialStage,
        lastMovedAt: new Date().toISOString(),
      } : c));

      setShowCancelModal(false);
      setCancelCardId(null);
      setCancelTarget(null);
      setCancelReason("");
      // Recarregar para garantir sincronismo
      setTimeout(() => loadApplications(), 100);
    } catch (e) {
      console.error('Erro ao cancelar ficha:', e);
      toast({ title: 'Erro ao cancelar', variant: 'destructive' });
    }
  }

  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      // Busca global: somente pelo nome do titular (nome da ficha)
      const matchesQuery = (c.nome || '')
        .toLowerCase()
        .includes(query.toLowerCase());

      const matchesResp =
        (responsavelFiltro.length === 0)
        || responsavelFiltro.includes(c.responsavel ?? "")
        || responsavelFiltro.includes(c.vendedorNome ?? "");

      // Filtragem de prazo deve seguir "Instalação agendada para" (due_at)
      // Comparações em UTC para evitar atraso de 1 dia por fuso
      if (prazoFiltro !== 'todos' && !c.hasDueAt) return false;
      const deadlineDate = new Date(c.deadline);
      const deadlineUTC = Date.UTC(
        deadlineDate.getUTCFullYear(),
        deadlineDate.getUTCMonth(),
        deadlineDate.getUTCDate(),
        0, 0, 0, 0
      );
      const now = new Date();
      const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
      const tomorrowUTC = todayUTC + 24 * 60 * 60 * 1000;
      const isHoje = deadlineUTC === todayUTC;
      const isAmanha = deadlineUTC === tomorrowUTC;
      const isAtrasado = todayUTC > deadlineUTC; // atraso por data, não por horário
      const matchesData = prazoData
        ? (deadlineUTC === Date.UTC(
            prazoData.getUTCFullYear(),
            prazoData.getUTCMonth(),
            prazoData.getUTCDate(),
            0, 0, 0, 0
          ))
        : false;

      const matchesPrazo =
        prazoFiltro === "todos"
        || (prazoFiltro === "hoje" && isHoje)
        || (prazoFiltro === "amanha" && isAmanha)
        || (prazoFiltro === "atrasados" && isAtrasado)
        || (prazoFiltro === "data" && matchesData);

      // View filter
      const matchesView = viewFilter === "all" || 
                         (viewFilter === "mine" && c.responsavelId === profile?.id);

      // Filtro "Atribuídas" exige responsável selecionado
      const matchesAtribuidas = atribuidasFiltro === 'none' || atribuidasCardIds.has(c.id);

      return matchesQuery && matchesResp && matchesPrazo && matchesView && matchesAtribuidas;
    });
  }, [cards, query, responsavelFiltro, prazoFiltro, prazoData, viewFilter, profile, atribuidasFiltro, atribuidasCardIds]);

  // Avoid repeated filter computations per column during render
  const analysisByColumn = useMemo(() => {
    const map = new Map<ColumnId, CardItem[]>();
    COLUMNS.forEach((col) => map.set(col.id, []));
    for (const c of filteredCards) {
      // Só mostrar cards que estão realmente no Kanban Análise
      if (c.area === 'analise') {
        if (map.has(c.columnId)) {
          map.get(c.columnId)!.push(c);
        }
      }
    }
    return map;
  }, [filteredCards]);

  const commercialByColumn = useMemo(() => {
    const map = new Map<ColumnId, CardItem[]>();
    COMMERCIAL_COLUMNS.forEach((col) => map.set(col.id, []));
    for (const c of filteredCards) {
      // Só mostrar cards que estão realmente no Kanban Comercial
      if (c.area === 'comercial') {
        const colId = getCommercialStage(c);
        if (map.has(colId)) {
          map.get(colId)!.push(c);
        }
      }
    }
    return map;
  }, [filteredCards]);

  // Função para gerar cards com placeholder fantasma (estilo Trello)
  const getCardsWithPlaceholder = (columnCards: CardItem[], columnId: ColumnId) => {
    if (!activeId || !draggedCard || dragOverColumn !== columnId) {
      return columnCards;
    }

    // Se o card está sendo arrastado para sua própria coluna, não mostrar placeholder
    if (draggedCard.columnId === columnId) {
      return columnCards;
    }

    // Criar placeholder fantasma mais realista
    const placeholder: CardItem = {
      ...draggedCard,
      id: `placeholder-${draggedCard.id}`,
      nome: `[ESPAÇO PARA: ${draggedCard.nome}]`,
    };

    // Adicionar placeholder no final da lista (como Trello)
    return [...columnCards, placeholder];
  };

  // Função para detectar posição de inserção (collision detection)
  const getInsertPosition = (columnCards: CardItem[], mouseY: number) => {
    if (columnCards.length === 0) return 0;
    
    // Simular detecção de posição baseada na posição do mouse
    // Em uma implementação real, isso seria baseado na posição exata do mouse
    const cardHeight = 80; // Altura aproximada de um card
    const insertIndex = Math.floor(mouseY / cardHeight);
    
    return Math.min(insertIndex, columnCards.length);
  };


// New card creation handled by NovaFichaComercialForm component
useEffect(() => {
  let mounted = true;
  const load = async () => {
    if (!mounted) return;
    await loadApplications();
  };
  
  const loadReanalysts = async () => {
    try {
      // Loading reanalysts disabled on lean backend (no reanalista role)
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .limit(0);

      if (error) throw error;
      setReanalysts(data || []);
    } catch (error) {
      console.error("Error loading reanalysts:", error);
    }
  };

  // Check for resume session after profile is loaded
  const checkResumeSession = async () => {
    // Disabled on lean backend (no drafts/applications)
    if (!profile?.id || resumeSessionChecked) return;
    setResumeSessionChecked(true);
  };

  load();
  // Resume session and reanalysts disabled in new backend flow
  if (profile?.id && !resumeSessionChecked) setResumeSessionChecked(true);
  
  return () => {
    mounted = false;
  };
}, [profile?.id, resumeSessionChecked]);

  // Removed periodic re-render to avoid perceived "reloads" during navigation

  // Actions for Kanban move - simplified and robust
  async function moveTo(cardId: string, target: ColumnId, label?: string) {
    try {
      const card = cards.find(c => c.id === cardId);
      if (!card) {
        console.log('Card not found:', cardId);
        return;
      }
      
      console.log('Moving card:', cardId, 'from', card.columnId, 'to', target);
      
      // Determinar área e stage baseado na coluna de destino
      let toArea: 'comercial' | 'analise';
      let toStage: string;
      
      if (target.startsWith('com_')) {
        toArea = 'comercial';
        const map: Record<string,string> = {
          com_entrada: 'entrada',
          com_feitas: 'feitas',
          com_aguardando: 'aguardando_doc',
          com_canceladas: 'canceladas',
          com_concluidas: 'concluidas',
        };
        toStage = map[target] || 'entrada';
      } else {
        toArea = 'analise';
        toStage = target as any;
      }

      // LÓGICA ESPECIAL: Transição entre Kanbans
      // Se está indo para "concluidas" no comercial, deve ir para "recebido" no analise
      if (target === 'com_concluidas') {
        toArea = 'analise';
        toStage = 'recebido';
        console.log('Card concluído no comercial -> movendo para recebido no analise');
      }
      
      // LÓGICA ESPECIAL: Transição Automática para Finalizado
      // Se está indo para "aprovado" ou "negado" no analise, deve ir para "finalizado"
      if (target === 'aprovado' || target === 'negado') {
        toArea = 'analise';
        toStage = 'finalizado';
        console.log('Card aprovado/negado -> movendo automaticamente para finalizado');
      }
      
      // VALIDAÇÃO: Impedir que cards voltem para "entrada" no comercial
      // Se o card já passou pelo comercial (tem commercialStage definido), não pode voltar para entrada
      if (target === 'com_entrada' && card.commercialStage && card.commercialStage !== 'entrada') {
        console.log('Card já processado no comercial - impedindo volta para entrada');
        toast({
          title: "Movimento não permitido",
          description: "Cards já processados não podem voltar para 'Entrada'",
          variant: "destructive"
        });
        return;
      }
      
      // VALIDAÇÃO: Impedir que cards do analise voltem para comercial (fluxo unidirecional)
      if (card.area === 'analise' && toArea === 'comercial') {
        console.log('Card do analise não pode voltar para comercial - fluxo unidirecional');
        toast({
          title: "Movimento não permitido", 
          description: "Cards em análise seguem fluxo unidirecional: Análise → Finalizado",
          variant: "destructive"
        });
        return;
      }

      // Salvar estado anterior para rollback
      const prevState = { 
        id: cardId, 
        columnId: card.columnId, 
        commercialStage: card.commercialStage,
        lastMovedAt: card.lastMovedAt
      };
      
      // Atualização otimista imediata da UI
      console.log('Updating UI optimistically...');
      setCards(prev => {
        const updated = prev.map(c => {
          if (c.id !== cardId) return c;
          
          console.log('Updating card:', c.id, 'from', c.columnId, 'to', target);
          
          // Determinar a coluna correta baseada na lógica especial
          let finalColumnId = target;
          
          // Se está indo para "concluidas", deve ir para "recebido" no analise
          if (target === 'com_concluidas') {
            finalColumnId = 'recebido';
          }
          
          // Se está indo para "aprovado" ou "negado", deve ir para "finalizado"
          if (target === 'aprovado' || target === 'negado') {
            finalColumnId = 'finalizado';
          }
          
          const updatedCard = {
            ...c,
            columnId: finalColumnId,
            lastMovedAt: new Date().toISOString(),
            area: toArea, // Atualizar área atual
          };
          
          // Atualizar commercialStage se necessário
          if (toArea === 'comercial') {
            const stageMap: Record<string, string> = {
              'entrada': 'entrada',
              'feitas': 'feitas', 
              'aguardando_doc': 'aguardando',
              'canceladas': 'canceladas',
              'concluidas': 'concluidas'
            };
            updatedCard.commercialStage = stageMap[toStage] as any;
          }
          
          return updatedCard;
        });
        
        console.log('Cards updated:', updated.length);
        return updated;
      });

      // Tentar atualizar no banco de dados
      try {
        const { error } = await (supabase as any).rpc('change_stage', {
          p_card_id: cardId,
          p_to_area: toArea,
          p_to_stage: toStage,
          p_comment: label || `Movido para ${target}`,
        });

        if (error) {
          console.error('Database update failed:', error);
          console.log('Using fallback: saving to localStorage');
          
          // Fallback: salvar no localStorage para persistência local
          try {
            const savedCards = JSON.parse(localStorage.getItem('kanban_cards_fallback') || '[]');
            const updatedCards = savedCards.map((c: any) => 
              c.id === cardId ? { ...c, columnId: target, commercialStage: toStage === 'aguardando_doc' ? 'aguardando' : toStage } : c
            );
            localStorage.setItem('kanban_cards_fallback', JSON.stringify(updatedCards));
            console.log('Card position saved to localStorage');
            // Enfileirar movimento para re-tentativa
            enqueueFallbackMove({ cardId, toArea, toStage, comment: label, at: new Date().toISOString() });
            toast({
              title: 'Conexão instável – usando fallback',
              description: 'Movimento aplicado localmente e será sincronizado assim que possível.',
            });
          } catch (localError) {
            console.error('localStorage save failed:', localError);
          }
          
          // Manter a atualização da UI (não fazer rollback)
          console.log('Card moved successfully to', target, '(local fallback)');
          // Recarregar dados mesmo no fallback
          setTimeout(() => {
            loadApplications();
          }, 100);
        } else {
          console.log('Card moved successfully to', target);
          // Recarregar dados para garantir sincronização
          setTimeout(() => {
            loadApplications();
          }, 100);
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        console.log('Using fallback: saving to localStorage');
        
        // Fallback: salvar no localStorage
        try {
          const savedCards = JSON.parse(localStorage.getItem('kanban_cards_fallback') || '[]');
          const updatedCards = savedCards.map((c: any) => 
            c.id === cardId ? { ...c, columnId: target, commercialStage: toStage === 'aguardando_doc' ? 'aguardando' : toStage } : c
          );
          localStorage.setItem('kanban_cards_fallback', JSON.stringify(updatedCards));
          console.log('Card position saved to localStorage');
          enqueueFallbackMove({ cardId, toArea, toStage, comment: label, at: new Date().toISOString() });
          toast({
            title: 'Conexão instável – usando fallback',
            description: 'Movimento aplicado localmente e será sincronizado assim que possível.',
          });
        } catch (localError) {
          console.error('localStorage save failed:', localError);
          // Rollback da UI apenas se localStorage também falhar
          setCards(prev => prev.map(c => c.id === cardId ? { 
            ...c, 
            columnId: prevState.columnId, 
            commercialStage: prevState.commercialStage,
            lastMovedAt: prevState.lastMovedAt
          } : c));
          toast({ 
            title: 'Erro ao mover', 
            description: 'Erro de conexão com o banco de dados', 
            variant: 'destructive' 
          });
          return;
        }
        
        console.log('Card moved successfully to', target, '(local fallback)');
        // Recarregar dados mesmo no fallback
        setTimeout(() => {
          loadApplications();
        }, 100);
      }

    } catch (error) {
      console.error("Error moving card:", error);
      toast({
        title: "Erro",
        description: "Erro ao mover ficha",
        variant: "destructive",
      });
    }
  }

  async function setResponsavel(cardId: string, resp: string) {
    try {
      // Determinar assigneeId a partir do argumento recebido
      // Caso resp já seja um UUID, usar direto; caso contrário, tentar resolver pelo nome
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      let assigneeId: string | null = null;

      if (uuidRegex.test(resp)) {
        assigneeId = resp;
      } else {
        // Tentar buscar por nome completo
        const { data: byName } = await (supabase as any)
          .from('profiles')
          .select('id')
          .eq('full_name', resp)
          .maybeSingle();
        assigneeId = byName?.id || null;

        // Fallback: se não achou pelo nome, usar o próprio usuário autenticado (caso "Ingressar")
        if (!assigneeId && profile?.id) {
          assigneeId = profile.id;
        }
      }
      
      // Salvar no banco
      const { error: updateError } = await (supabase as any)
        .from('kanban_cards')
        .update({ assignee_id: assigneeId })
        .eq('id', cardId);
      if (updateError) {
        console.error('Erro ao atualizar assignee_id:', updateError);
        throw updateError;
      }
      
      // Atualizar estado local
      setCards((prev) =>
        prev.map((c) => {
          if (c.id !== cardId) return c;
          const nextLabels = new Set(c.labels);
          if (resp) nextLabels.add("Em Análise");
          const isInRecebido = c.columnId === "recebido";
          return {
            ...c,
            // Se resp era um UUID, manter nome antigo; caso contrário, usar resp como nome
            responsavel: uuidRegex.test(resp) ? c.responsavel : resp,
            responsavelId: assigneeId || undefined,
            labels: Array.from(nextLabels),
            columnId: allowMove && isInRecebido ? "em_analise" : c.columnId,
            lastMovedAt: allowMove && isInRecebido ? new Date().toISOString() : c.lastMovedAt,
          };
        })
      );

      // Recarregar para refletir o nome correto a partir do banco
      setTimeout(() => loadApplications(), 100);
    } catch (error) {
      console.error('Erro ao atribuir responsável:', error);
      toast({ 
        title: 'Erro ao atribuir responsável', 
        variant: 'destructive' 
      });
    }
  }
  
  async function unassignAndReturn(cardId: string) {
    if (import.meta?.env?.DEV) console.log("unassignAndReturn called", cardId);
    
    try {
      // Remover assignee no banco
      await (supabase as any)
        .from('kanban_cards')
        .update({ assignee_id: null })
        .eq('id', cardId);
      
      // Atualizar estado local
      setCards((prev) =>
        prev.map((c) => {
          if (c.id !== cardId) return c;
          return {
            ...c,
            responsavel: undefined,
            responsavelId: undefined,
            columnId: "recebido",
            labels: c.labels.filter((l) => l !== "Em Análise"),
            lastMovedAt: new Date().toISOString(),
          };
        })
      );
    } catch (error) {
      console.error('Erro ao desingressar:', error);
      toast({ 
        title: 'Erro ao desingressar', 
        variant: 'destructive' 
      });
    }
  }

  async function openEdit(card: CardItem) {
    console.log('🔍 Abrindo card:', card.id);
    // Garantir que abriremos somente o modal de "Editar Ficha" (não o expandido)
    setAutoOpenExpandedNext(false);
    
    try {
      // Buscar dados frescos do banco SEMPRE que abrir o modal
      const { data: freshCard, error } = await (supabase as any)
        .from('kanban_cards')
        .select('*')
        .eq('id', card.id)
        .is('deleted_at', null)
        .single();
      
      if (error) {
        console.error('❌ Erro ao buscar card do banco:', error);
        // Se houver erro, usar card do cache local
        setMockCard(card);
        return;
      }
      
      console.log('✅ Dados frescos do banco carregados:', freshCard);
      
      // Usar os dados frescos do banco
      const updatedCard: CardItem = {
        ...card,
        parecer: freshCard.reanalysis_notes || freshCard.comments || freshCard.comments_short || '',
        // Atualizar outros campos que podem ter mudado
        nome: freshCard.title || card.nome,
        telefone: freshCard.phone || card.telefone,
        email: freshCard.email || card.email,
      };
      
      setMockCard(updatedCard);
    } catch (error) {
      console.error('❌ Erro ao abrir card:', error);
      // Fallback para dados do cache
      setAutoOpenExpandedNext(false);
      setMockCard(card);
    }
  }

  const handleCardClick = (card: CardItem) => {
    openEdit(card);
  };

  const handleIngressar = async (card: CardItem) => {
    try {
      if (import.meta?.env?.DEV) console.log('Ingressando na ficha:', card.id, 'alterando para: analise/em_analise');
      
      // 1. Primeiro muda o stage
      const { error } = await (supabase as any).rpc('change_stage', {
        p_card_id: card.id,
        p_to_area: 'analise',
        p_to_stage: 'em_analise',
        p_comment: 'Ingresso realizado',
      });

      if (error) throw error;
      
      // 2. Depois atribui o responsável (usuário atual)
      if (profile?.id) {
        await setResponsavel(card.id, profile.id);
      }
      
      toast({
        title: "Sucesso",
        description: "Ficha movida para Em Análise e atribuída",
      });
    } catch (error) {
      if (import.meta?.env?.DEV) console.error('Erro ao ingressar:', error);
      toast({
        title: "Erro",
        description: "Erro ao ingressar na ficha",
        variant: "destructive",
      });
    }
  };

  const handleAprovar = async (card: CardItem, parecer: string) => {
    if (import.meta?.env?.DEV) console.log("Aprovando card:", card.id, "parecer:", parecer);
    if (!parecer.trim()) {
      setParecerAction({ action: 'aprovar', card });
      setShowParecerConfirm(true);
      return;
    }
    
    try {
      const { error } = await (supabase as any).rpc('change_stage', {
        p_card_id: card.id,
        p_to_area: 'analise',
        p_to_stage: 'aprovado',
        p_comment: parecer,
      });

      if (error) {
        if (import.meta?.env?.DEV) console.error('RPC error on approve:', error);
        throw error;
      }
      
      if (import.meta?.env?.DEV) console.log('Status change successful, reloading applications...');
      // Reload applications instead of whole page
      await loadApplications();

      toast({
        title: "Ficha aprovada",
        description: "Decisão registrada com sucesso",
      });
    } catch (error: any) {
      if (import.meta?.env?.DEV) console.error('Erro ao aprovar:', error);
      toast({
        title: "Erro",
        description: `Erro ao aprovar ficha: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleNegar = async (card: CardItem, parecer: string) => {
    if (import.meta?.env?.DEV) console.log("Negando card:", card.id, "parecer:", parecer);
    if (!parecer.trim()) {
      setParecerAction({ action: 'negar', card });
      setShowParecerConfirm(true);
      return;
    }
    
    try {
      const { error } = await (supabase as any).rpc('change_stage', {
        p_card_id: card.id,
        p_to_area: 'analise',
        p_to_stage: 'negado',
        p_comment: parecer,
      });

      if (error) {
        if (import.meta?.env?.DEV) console.error('RPC error on deny:', error);
        throw error;
      }
      
      if (import.meta?.env?.DEV) console.log('Status change successful, reloading applications...');
      // Reload applications instead of whole page
      await loadApplications();

      toast({
        title: "Ficha negada",
        description: "Decisão registrada com sucesso",
      });
    } catch (error: any) {
      if (import.meta?.env?.DEV) console.error('Erro ao negar:', error);
      toast({
        title: "Erro",
        description: `Erro ao negar ficha: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleReanalisar = async (card: CardItem, parecer: string) => {
    if (import.meta?.env?.DEV) console.log("Reanalysando card:", card.id, "parecer:", parecer);
    if (!parecer.trim()) {
      setParecerAction({ action: 'reanalisar', card });
      setShowParecerConfirm(true);
      return;
    }
    
    try {
      const { error } = await (supabase as any).rpc('change_stage', {
        p_card_id: card.id,
        p_to_area: 'analise',
        p_to_stage: 'reanalise',
        p_comment: parecer,
      });

      if (error) {
        if (import.meta?.env?.DEV) console.error('RPC error on reanalyze:', error);
        throw error;
      }
      
      if (import.meta?.env?.DEV) console.log('Status change successful, reloading applications...');
      // Reload applications instead of whole page
      await loadApplications();

      toast({
        title: "Enviado para reanálise",
        description: "Decisão registrada com sucesso",
      });
    } catch (error: any) {
      if (import.meta?.env?.DEV) console.error('Erro ao reanalisar:', error);
      toast({
        title: "Erro",
        description: `Erro ao enviar para reanálise: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const confirmParecerAction = async () => {
    if (!parecerAction) return;
    
    const { action, card } = parecerAction;
    const parecer = card.parecer;
    
    setShowParecerConfirm(false);
    setParecerAction(null);
    
    // Executar a ação confirmada
    switch (action) {
      case 'aprovar':
        await handleAprovar(card, parecer);
        break;
      case 'negar':
        await handleNegar(card, parecer);
        break;
      case 'reanalisar':
        await handleReanalisar(card, parecer);
        break;
    }
  };

  function saveEdits() {
    if (!editing || !editing.parecer.trim()) {
      toast({ title: "Parecer do analista é obrigatório." });
      return;
    }
    setCards((prev) =>
      prev.map((c) =>
        c.id === editing.id
          ? {
              ...c,
              nome: editing.nome.trim(),
              telefone: editing.telefone || undefined,
              responsavel: editing.responsavel || undefined,
              parecer: editing.parecer.trim(),
              receivedAt: editing.recebido ? editing.recebido.toISOString() : c.receivedAt,
              deadline: editing.prazo ? new Date(Date.UTC(editing.prazo.getFullYear(), editing.prazo.getMonth(), editing.prazo.getDate(), 12, 0, 0)).toISOString() : c.deadline,
              updatedAt: new Date().toISOString(),
            }
          : c
      )
    );
    setEditOpen(false);
    setEditing(null);
    toast({ title: "Alterações salvas" });
  }

  return (
    <section className="space-y-6 animate-fade-in kanban-container">
      <Card className="shadow-md bg-white text-[#018942]" style={{ boxShadow: "var(--shadow-elegant)" }}>
        <CardHeader />
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#018942]" />
              <Input
                placeholder="Buscar titular (nome da ficha)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 bg-white text-[#018942] placeholder-[#018942]/70 border-[#018942] w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">Área</Label>
              <Select value={kanbanArea} onValueChange={(v: KanbanArea) => setKanbanArea(v)}>
                <SelectTrigger className="bg-white text-[#018942] border-[#018942] w-full md:w-auto min-w-[130px]">
                  <SelectValue placeholder="Área" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="analise">Análise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">Responsável</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="bg-white text-[#018942] border-[#018942] w-full md:w-auto min-w-[180px] max-w-[260px] justify-between">
                    <span className="truncate">{responsavelFiltro.length === 0 ? 'Todos' : responsavelFiltro.join(', ')}</span>
                    <ChevronDown className="ml-2 h-4 w-4 opacity-70 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[260px] max-w-[90vw]">
                  <DropdownMenuItem className="pl-8" onClick={() => setResponsavelFiltro([])}>Todos</DropdownMenuItem>
                  {responsaveisOptions.map((r) => (
                    <DropdownMenuCheckboxItem
                      key={r}
                      className="truncate"
                      checked={responsavelFiltro.includes(r)}
                      onCheckedChange={(checked) => {
                        setResponsavelFiltro((prev) => {
                          const set = new Set(prev);
                          if (checked) set.add(r); else set.delete(r);
                          return Array.from(set);
                        });
                      }}
                    >
                      {r}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-1">
              <Label>Prazo</Label>
              <div className="flex items-center gap-2">
                <Select value={prazoFiltro} onValueChange={(v: PrazoFiltro) => { 
                  setPrazoFiltro(v);
                  if (v === 'data') {
                    // dispara abertura automática do calendário
                    setTimeout(() => setPrazoOpenTick((t) => t + 1), 0);
                  }
                }}>
                  <SelectTrigger className="bg-white text-[#018942] border-[#018942] w-full md:w-auto min-w-[170px]">
                    <SelectValue placeholder="Prazo" />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="hoje">Agendada para hoje</SelectItem>
                    <SelectItem value="amanha">Agendada para amanhã</SelectItem>
                    <SelectItem value="atrasados">Atrasado</SelectItem>
                    <SelectItem value="data">Escolher Data…</SelectItem>
                  </SelectContent>
                </Select>
                {prazoFiltro === 'data' && (
                  <div className="rounded-md border border-[#018942]/40 p-2 bg-white min-w-[220px]">
                    <DatePicker
                      key={prazoOpenTick}
                      value={(() => {
                        if (!prazoData) return '';
                        const y = prazoData.getUTCFullYear();
                        const m = String(prazoData.getUTCMonth() + 1).padStart(2, '0');
                        const d = String(prazoData.getUTCDate()).padStart(2, '0');
                        return `${y}-${m}-${d}`;
                      })()}
                      onChange={(iso) => {
                        if (!iso) { setPrazoData(null); return; }
                        const [yy, mm, dd] = iso.split('-').map((s) => parseInt(s, 10));
                        if (!yy || !mm || !dd) { setPrazoData(null); return; }
                        // Armazenar como data em UTC para evitar deslocamentos
                        const dt = new Date(Date.UTC(yy, mm - 1, dd, 0, 0, 0, 0));
                        setPrazoData(dt);
                      }}
                      showIcon={true}
                      allowTyping={false}
                      forceFlatpickr={true}
                      autoOpen={true}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Label className="min-w-24">Atribuídas</Label>
                <Select value={atribuidasFiltro} onValueChange={(v: AtribuidasFilter) => setAtribuidasFiltro(v)}>
                  <SelectTrigger className="bg-white text-[#018942] border-[#018942]">
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="mentions">Minhas menções</SelectItem>
                    <SelectItem value="tasks">Minhas tarefas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Atribuídas agora é independente do filtro Responsável */}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <Badge className="bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">Em Análise</Badge>
              <Badge className="bg-[hsl(var(--success))] text-white">Aprovado</Badge>
              <Badge className="bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]">Atrasado</Badge>
            </div>
            <Button 
              variant="pill" 
              size="xl" 
              className="hover-scale bg-[hsl(var(--brand))] text-white hover:bg-[hsl(var(--brand))/0.9] border border-transparent" 
              onClick={() => setShowConfirmCreate(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Nova ficha
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Legacy dialog removido para backend enxuto */}

      {mockCard && (
        <ModalEditarFicha
          card={mockCard}
          responsaveis={responsaveisOptions}
          onDesingressar={unassignAndReturn}
          onClose={() => { setMockCard(null); setAutoOpenExpandedNext(false); }}
          onRefetch={loadApplications}
          autoOpenExpanded={autoOpenExpandedNext}
          onSave={(form: any) => {
            setCards((prev) =>
              prev.map((c) =>
                c.id === (mockCard as CardItem).id
                  ? {
                      ...c,
                      nome: form.nome ?? c.nome,
                      telefone: form.telefone || undefined,
                      // Atualiza apenas a data de instalação agendada (meia-noite UTC para evitar deriva de fuso)
                      hasDueAt: Boolean(form.agendamento),
                      deadline: form.agendamento ? (() => {
                        const parts = String(form.agendamento).split('-').map((x) => parseInt(x, 10));
                        const y = parts[0], m = parts[1], d = parts[2];
                        return new Date(Date.UTC(y, (m - 1), d, 0, 0, 0)).toISOString();
                      })() : c.deadline,
                      // "Feito em" é imutável (data de criação/recebimento)
                      updatedAt: new Date().toISOString(),
                    }
                  : c
              )
            );
            setMockCard(null);
          }}
        />
      )}

      <DndContext 
        collisionDetection={closestCenter} 
        sensors={sensors} 
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(kanbanArea === 'comercial' ? COMMERCIAL_COLUMNS : COLUMNS).map((col) => (
            <ColumnDropArea 
              key={col.id} 
              columnId={col.id}
              isDragOver={dragOverColumn === col.id}
              activeId={activeId}
            >
              <div className="rounded-xl border bg-card">
                <div
                  className="px-4 py-3 border-b flex items-center justify-between"
                  style={{ backgroundImage: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}
                >
                  <h2 className="font-semibold">{col.title}</h2>
                  <Badge variant="secondary" className="bg-white text-[#018942]">
                    {getCardsWithPlaceholder(
                      kanbanArea === 'comercial'
                        ? (commercialByColumn.get(col.id) || [])
                        : (analysisByColumn.get(col.id) || []),
                      col.id
                    ).length}
                  </Badge>
                </div>
                <div className="p-3">
                  <SortableContext
                    items={getCardsWithPlaceholder(
                      kanbanArea === 'comercial'
                        ? (commercialByColumn.get(col.id) || [])
                        : (analysisByColumn.get(col.id) || []),
                      col.id
                    ).map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="min-h-[120px] space-y-3">
                      {getCardsWithPlaceholder(
                        kanbanArea === 'comercial'
                          ? (commercialByColumn.get(col.id) || [])
                          : (analysisByColumn.get(col.id) || []),
                        col.id
                      )
                         .map((card) => (
                             <OptimizedKanbanCard
                               key={card.id}
                               card={card}
                               isOverdue={isOverdue(card)}
                               allowMove={allowMove}
                               onEdit={openEdit}
                               onDelete={(card) => {
                                 setCardToDelete(card);
                                 setShowDeleteConfirm(true);
                               }}
                               onIngressar={handleIngressar}
                               onAprovar={handleAprovar}
                               onNegar={handleNegar}
                               onReanalisar={handleReanalisar}
                               onStatusChange={handleStatusChange}
                               isDragging={activeId === card.id}
                               onAttachmentClick={handleAttachmentClick}
                               onCardClick={handleCardClick}
                             />
                         ))}
                    </div>
                  </SortableContext>
                </div>
              </div>
            </ColumnDropArea>
          ))}
        </div>
      </DndContext>

      {/* New secure creation flow modals */}
  {/* Modal de motivo de cancelamento */}
  <AlertDialog open={showCancelModal} onOpenChange={setShowCancelModal}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Cancelar ficha</AlertDialogTitle>
        <AlertDialogDescription>
          Informe o motivo do cancelamento. Esta ação será registrada para análise.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="space-y-2">
        <Label>Motivo</Label>
        <Input
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Ex: Cliente desistiu / Dados inconsistentes"
          className="placeholder:text-[#018942] text-[#018942]"
        />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel
          onClick={() => { setShowCancelModal(false); setCancelCardId(null); }}
          className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500 hover:border-gray-600"
        >
          Cancelar
        </AlertDialogCancel>
        <AlertDialogAction onClick={confirmCancel} className="bg-[#018942] hover:bg-[#018942]/90 text-white border-[#018942]">Confirmar</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  <ConfirmCreateModal
    open={showConfirmCreate}
    onClose={() => setShowConfirmCreate(false)}
    onConfirm={() => {
      setShowConfirmCreate(false);
      setShowPersonType(true);
    }}
  />

  <PersonTypeModal
    open={showPersonType}
    onClose={() => setShowPersonType(false)}
    onSelect={(type) => {
      setShowPersonType(false);
      if (type === 'pf') setShowBasicInfo(true);
      else setShowNovaPj(true);
    }}
  />

  <BasicInfoModal
    open={showBasicInfo}
    onClose={() => setShowBasicInfo(false)}
    onBack={() => {
      setShowBasicInfo(false);
      setShowPersonType(true);
    }}
    onSubmit={async (data) => {
      try {
        console.log('🆕 [KanbanBoard] Iniciando criação de ficha PF:', data);
        
        // 1) Garantir applicant PF em PRODUÇÃO (para satisfazer FK do kanban_cards)
        const cpf = data.cpf.replace(/\D+/g, '');
        console.log('🔍 [KanbanBoard] CPF limpo:', cpf);
        
        let applicantProd: { id: string } | null = null;
        const { data: existingProd } = await (supabase as any)
          .from('applicants')
          .select('id, primary_name, phone, email, created_at')
          .eq('cpf_cnpj', cpf)
          .eq('person_type', 'PF')
          .maybeSingle();
        
        if (existingProd?.id) {
          console.log('⚠️ [KanbanBoard] CPF já cadastrado! Bloqueando criação.', existingProd);
          
          // 🚫 BLOQUEAR criação e avisar usuário
          toast({
            title: '⚠️ CPF já cadastrado',
            description: `Já existe um cadastro para este CPF:\n\n` +
              `Nome: ${existingProd.primary_name}\n` +
              `Telefone: ${existingProd.phone || 'Não informado'}\n` +
              `Email: ${existingProd.email || 'Não informado'}\n` +
              `Cadastrado em: ${new Date(existingProd.created_at).toLocaleDateString('pt-BR')}\n\n` +
              `Não é possível criar nova ficha com CPF duplicado.`,
            variant: 'destructive',
            duration: 8000, // 8 segundos para ler
          });
          
          // ❌ ABORTAR criação
          return;
        } else {
          console.log('📝 [KanbanBoard] Criando novo applicant com dados:', {
            person_type: 'PF',
            primary_name: data.nome,
            cpf_cnpj: cpf,
            phone: data.telefone,
            email: data.email || null,
          });
          
          const { data: createdProd, error: aErrProd } = await (supabase as any)
            .from('applicants')
            .insert({
              person_type: 'PF',
              primary_name: data.nome,
              cpf_cnpj: cpf,
              phone: data.telefone,
              email: data.email || null,
              // Naturalidade e UF são salvos em pf_fichas_test, não em applicants
            })
            .select('id')
            .single();
          
          if (aErrProd) {
            console.error('❌ [KanbanBoard] ERRO ao criar applicant:', aErrProd);
            throw aErrProd;
          }
          
          console.log('✅ [KanbanBoard] Applicant criado com sucesso! ID:', createdProd.id);
          applicantProd = createdProd;
        }

        // Removido: espelho em applicants_test (legado)

        // 2) Card no Kanban (Comercial/feitas)
        console.log('📋 [KanbanBoard] Criando card no Kanban com applicant_id:', applicantProd!.id);
        const now = new Date();
        const { data: created, error: cErr } = await (supabase as any)
          .from('kanban_cards')
          .insert({
            applicant_id: applicantProd!.id, // FK não-nulo exige apontar para applicants (prod)
            person_type: 'PF',
            area: 'comercial',
            stage: 'feitas',
            created_by: profile?.id || null,
            title: data.nome,
            cpf_cnpj: data.cpf.replace(/\D+/g, ''),
            phone: data.telefone,
            email: data.email || null,
            received_at: now.toISOString(),
            source: 'software_pf',
          })
          .select('id, title, phone, email, cpf_cnpj, received_at, stage')
          .single();
        
        if (cErr) {
          console.error('❌ [KanbanBoard] ERRO ao criar card:', cErr);
          throw cErr;
        }
        console.log('✅ [KanbanBoard] Card criado com sucesso! ID:', created.id);
        
        // 3) Salvar dados básicos em pf_fichas_test (naturalidade e UF)
        console.log('💾 [KanbanBoard] Salvando dados em pf_fichas_test...');
        try {
          const { data: existingPfFicha } = await (supabase as any)
            .from('pf_fichas_test')
            .select('id')
            .eq('applicant_id', applicantProd!.id)
            .maybeSingle();
          
          const birthDate = data.nascimento ? (() => {
            const parts = data.nascimento.split('/');
            if (parts.length === 3) {
              return `${parts[2]}-${parts[1]}-${parts[0]}`; // dd/mm/yyyy -> yyyy-mm-dd
            }
            return null;
          })() : null;
          
          const pfFichaData = {
            naturalidade: data.naturalidade,
            uf_naturalidade: data.uf,
            birth_date: birthDate
          };
          
          if (existingPfFicha) {
            console.log('♻️ [KanbanBoard] PF Ficha já existe, atualizando:', existingPfFicha.id);
            console.log('📝 [KanbanBoard] Dados para atualização:', pfFichaData);
            
            const { error: updateErr } = await (supabase as any)
              .from('pf_fichas_test')
              .update(pfFichaData)
              .eq('id', existingPfFicha.id);
            
            if (updateErr) {
              console.error('❌ [KanbanBoard] Erro ao atualizar pf_fichas_test:', updateErr);
            } else {
              console.log('✅ [KanbanBoard] PF Ficha atualizada com sucesso!');
            }
          } else {
            console.log('🆕 [KanbanBoard] Criando nova PF Ficha');
            console.log('📝 [KanbanBoard] Dados para inserção:', {
              applicant_id: applicantProd!.id,
              ...pfFichaData
            });
            
            const { error: insertErr } = await (supabase as any)
              .from('pf_fichas_test')
              .insert({
                applicant_id: applicantProd!.id,
                ...pfFichaData
              });
            
            if (insertErr) {
              console.error('❌ [KanbanBoard] Erro ao criar pf_fichas_test:', insertErr);
            } else {
              console.log('✅ [KanbanBoard] PF Ficha criada com sucesso!');
            }
          }
        } catch (pfErr) {
          console.error('❌ [KanbanBoard] Exceção ao salvar em pf_fichas_test:', pfErr);
          // Não bloquear o fluxo se falhar
        }
        
        // Abrir modal de edição (ficha) com o card criado (busca completa após reload)
        setShowBasicInfo(false);
        setAutoOpenExpandedNext(true);
        toast({ title: 'Ficha criada com sucesso!' });
        await loadApplications();
        // Seleciona card recém-criado para editar
        const nc = (prevCards => prevCards.find(c => c.id === created.id))(cards) || (
          (await (supabase as any).from('kanban_cards').select('id, title, cpf_cnpj, phone, email, received_at, stage').eq('id', created.id).single()).data
            ? {
                id: created.id,
                nome: created.title,
                cpf: created.cpf_cnpj || '',
                receivedAt: created.received_at,
                deadline: created.received_at,
                responsavel: undefined,
                responsavelId: undefined,
                telefone: created.phone || undefined,
                email: created.email || undefined,
                naturalidade: data.naturalidade, // Apenas para exibição, salvo em pf_fichas_test
                uf: data.uf, // Apenas para exibição, salvo em pf_fichas_test
                applicantId: applicantProd!.id,
                parecer: '',
                columnId: 'com_feitas',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastMovedAt: new Date().toISOString(),
                labels: [],
                vendedorNome: currentUserName,
              } as any : null);
        if (nc) setMockCard(nc as any);
      } catch (e: any) {
        if (import.meta?.env?.DEV) console.error('Erro ao criar PF:', e);
        toast({ title: 'Erro ao criar ficha', description: e.message || String(e), variant: 'destructive' });
      }
    }}
  />

{/* Expanded form removido no MVP do novo backend; criação direta acima */}

  <NovaFichaPJForm
    open={showNovaPj}
    onClose={() => setShowNovaPj(false)}
    onBack={() => {
      setShowNovaPj(false);
      setShowPersonType(true);
    }}
    onCreated={async (created) => {
      setShowNovaPj(false);
      setAutoOpenExpandedNext(true);
      await loadApplications();
      // Build minimal card object to open editor immediately
      const newCard: CardItem = {
        id: created.id,
        nome: created.title,
        cpf: created.cpf_cnpj || '',
        receivedAt: created.received_at || new Date().toISOString(),
        deadline: created.received_at || new Date().toISOString(),
        responsavel: undefined,
        responsavelId: undefined,
        telefone: created.phone || undefined,
        email: created.email || undefined,
        naturalidade: undefined,
        uf: undefined,
        applicantId: created.applicant_id,
        personType: 'PJ',
        parecer: '',
        columnId: 'com_feitas',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMovedAt: new Date().toISOString(),
        labels: [],
        vendedorNome: currentUserName,
      } as any;
      setMockCard(newCard);
    }}
  />

      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setCardToDelete(null);
        }}
        onConfirm={async (reason) => {
          if (!cardToDelete) return;
          
          try {
            console.log('🗑️ [DEBUG] Soft delete de card:', cardToDelete.id, 'motivo:', reason);
            
            // SOFT DELETE (não deleta permanentemente!)
            console.log('🔍 [DEBUG] Profile ID:', profile?.id);
            console.log('🔍 [DEBUG] Fazendo UPDATE no banco...');
            
            const { error } = await (supabase as any)
              .from('kanban_cards')
              .update({
                deleted_at: new Date().toISOString(),
                deleted_by: profile?.id,
                deletion_reason: reason
              })
              .eq('id', cardToDelete.id);
              
            console.log('🔍 [DEBUG] Resultado do UPDATE:', { error });

            if (error) {
              console.error('🚨 [DEBUG] Erro ao fazer soft delete:', error);
              throw error;
            }
            
            console.log('✅ [DEBUG] Soft delete bem-sucedido! Removendo do front...');
            // Remover do estado local (UI) - card continua no banco marcado como deletado
            setCards(prev => prev.filter(c => c.id !== cardToDelete.id));
            toast({ title: "Ficha deletada com sucesso" });
          } catch (error: any) {
            console.error('🚨 [DEBUG] Error deleting application:', error);
            toast({
              title: "Erro ao deletar ficha",
              variant: "destructive",
            });
          }
          
          setShowDeleteConfirm(false);
          setCardToDelete(null);
        }}
        customerName={cardToDelete?.nome || ''}
        customerCpf={cardToDelete?.cpf || ''}
      />


      <ParecerConfirmModal
        isOpen={showParecerConfirm}
        onClose={() => {
          setShowParecerConfirm(false);
          setParecerAction(null);
        }}
        onConfirm={confirmParecerAction}
        action={parecerAction?.action || 'aprovar'}
        customerName={parecerAction?.card.nome || ''}
        parecer={parecerAction?.card.parecer}
      />

      {/* Modal de Upload de Anexos */}
      <AttachmentUploadModal
        open={showAttachmentModal}
        onClose={() => {
          setShowAttachmentModal(false);
          setSelectedCardForAttachment(null);
        }}
        onUpload={handleUploadAttachment}
        isUploading={isUploading}
        cardId={selectedCardForAttachment || ''}
      />
    </section>
  );
}

// Drop area - estilo Trello com feedback visual
function ColumnDropArea({ 
  columnId, 
  children, 
  isDragOver, 
  activeId 
}: { 
  columnId: ColumnId; 
  children: React.ReactNode;
  isDragOver: boolean;
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ 
    id: columnId,
    data: {
      type: 'column',
      columnId: columnId
    }
  });
  
  const isDragActive = activeId && activeId !== columnId;
  const showDropIndicator = isOver && isDragActive;
  
  return (
    <div 
      ref={setNodeRef} 
      className={cn(
        "min-h-[200px] transition-all duration-200 rounded-lg relative",
        showDropIndicator && "bg-blue-50 border-blue-300 border-2 border-dashed shadow-lg"
      )}
      data-droppable="true"
      data-column-id={columnId}
    >
      {children}
      
      {/* Indicador visual de drop - estilo Trello */}
      {showDropIndicator && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="h-1 bg-blue-500 rounded-full mx-2 shadow-lg animate-pulse"></div>
        </div>
      )}
    </div>
  );
}

// Card component
function KanbanCard({
  card,
  responsaveis,
  currentUserName,
  onSetResponsavel,
  onMove,
  onOpen,
  onDesingressar,
  reanalysts,
  onReload,
}: {
  card: CardItem;
  responsaveis: string[];
  currentUserName: string;
  onSetResponsavel: (id: string, resp: string) => void;
  onMove: (id: string, col: ColumnId, label?: string) => void;
  onOpen: (card: CardItem) => void;
  onDesingressar: (id: string) => void;
  reanalysts: Array<{id: string; full_name: string; avatar_url?: string; company_id?: string}>;
  onReload: () => Promise<void>;
}) {
  const { profile } = useAuth();
  const allowDecide = canChangeStatus(profile);
  const premium = isPremium(profile);
  const overDue = isOverdue(card);
  const fireColumns = new Set<ColumnId>(["recebido", "em_analise", "reanalise", "aprovado"]);
  const msUntil = new Date(card.deadline).getTime() - Date.now();
  const onFire = fireColumns.has(card.columnId) && msUntil >= 0 && msUntil <= 24 * 60 * 60 * 1000;

  // Sistema de empresas removido (não usado)

  const handleReassign = async (reanalystId: string) => {
    try {
      const { error } = await supabase.rpc('reassign_application', {
        p_app_id: card.id,
        p_reanalyst: reanalystId
      });

      if (error) throw error;

      const reanalyst = reanalysts.find(r => r.id === reanalystId);
      toast({
        title: "Reatribuição realizada",
        description: `Ficha atribuída para ${reanalyst?.full_name}`,
      });

      // Reload applications instead of full page reload
      await onReload();
    } catch (error) {
      if (import.meta?.env?.DEV) console.error("Error reassigning application:", error);
      toast({
        title: "Erro",
        description: "Erro ao reatribuir ficha",
        variant: "destructive",
      });
    }
  };

  const displayLabels = premium ? card.labels.filter((l) => l !== "Em Análise") : card.labels;

  const headerBadges = (
    <div className="flex gap-2 flex-wrap">
      {displayLabels.map((l) => (
        <Badge key={l} variant="secondary">
          {l}
        </Badge>
      ))}
      {overDue && (
        <Badge className="bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] animate-alert-pulse">
          Atrasado
        </Badge>
      )}
    </div>
  );

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id, disabled: !allowDecide });
  const dragStyle = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  function handleCardClick(e: React.MouseEvent) {
    if (isDragging) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-ignore-card-click],button,select,input,textarea,[role="menuitem"]')) return;
    onOpen(card);
  }

  return (
    <div
      ref={setNodeRef}
      id={card.id}
      {...listeners}
      {...attributes}
      onClick={handleCardClick}
      className={cn(
        "kanban-card rounded-xl border bg-card shadow-sm hover-scale",
        allowDecide ? "cursor-grab active:cursor-grabbing" : "cursor-default select-none",
        overDue ? "ring-2 ring-[hsl(var(--destructive))]" : "",
        onFire ? "card-on-fire animate-fire-flicker" : "",
        isDragging ? "dragging opacity-80" : ""
      )}
      style={{ transition: "var(--transition-smooth)", ...dragStyle }}
    >
      {onFire && (
        <>
          <div className="fire-overlay" aria-hidden />
          <div className="corner-flame" aria-hidden />
        </>
      )}

<div className="p-3 border-b flex items-center justify-between">
  <div className="flex items-center gap-2">
    <div className="font-medium">{card.nome}</div>
  </div>
  <div className="flex items-center gap-1">
    {headerBadges}
  </div>
</div>
      <div className="p-3 relative flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Recebido: </span>
            {format(new Date(card.receivedAt), "dd/MM/yyyy")}
          </div>
          <div>
            <span className="font-medium text-foreground">Prazo: </span>
            {format(new Date(card.deadline), "dd/MM/yyyy")}
          </div>
          <div>
            <span className="font-medium text-foreground">Resp.: </span>
            {card.responsavel ?? "—"}
          </div>
        </div>


        <div className="text-sm">
          <span className="font-medium">Parecer: </span>
          <span className="text-muted-foreground">{card.parecer || "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm" data-ignore-card-click>Responsável</Label>
          <Select value={card.responsavel} onValueChange={(v) => onSetResponsavel(card.id, v)}>
            <SelectTrigger className="h-8" data-ignore-card-click disabled={!allowDecide}>
              <SelectValue placeholder="Atribuir" />
            </SelectTrigger>
            <SelectContent className="z-50">
              {responsaveis.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {card.columnId === "em_analise" && allowDecide && (
          <>
            <div className="pt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() => onMove(card.id, "aprovado")}
                data-ignore-card-click
                className="text-[#018942]"
              >
                Aprovar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onMove(card.id, "negado")} data-ignore-card-click>
                Negar
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onMove(card.id, "reanalise")} data-ignore-card-click>
                Reanalisar
              </Button>
            </div>
          </>
        )}
        {card.columnId === "recebido" && (
          <div className="sticky bottom-0 -mx-3 px-3 pt-2 border-t bg-gradient-to-t from-background/90 to-background/0">
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!allowDecide}
                onClick={() => {
                  onSetResponsavel(card.id, currentUserName);
                  toast({ title: "Ingresso efetuado" });
                }}
                data-ignore-card-click
              >
                Ingressar
              </Button>
            </div>
          </div>
        )}
        {card.columnId === "reanalise" && allowDecide && (
          <div className="sticky bottom-0 -mx-3 px-3 pt-2 border-t bg-gradient-to-t from-background/90 to-background/0">
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (!card.parecer || !card.parecer.trim()) {
                    toast({
                      title: "Preencha o Parecer antes de decidir.",
                      action: (
                        <ToastAction altText="Abrir card" onClick={() => onOpen(card)}>
                          Abrir card
                        </ToastAction>
                      ),
                    });
                    return;
                  }
                  onMove(card.id, "aprovado", "Aprovado");
                }}
                data-ignore-card-click
                className="text-[#018942]"
              >
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (!card.parecer || !card.parecer.trim()) {
                    toast({
                      title: "Preencha o Parecer antes de decidir.",
                      action: (
                        <ToastAction altText="Abrir card" onClick={() => onOpen(card)}>
                          Abrir card
                        </ToastAction>
                      ),
                    });
                    return;
                  }
                  onMove(card.id, "negado", "Negado");
                }}
                data-ignore-card-click
              >
                Negar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
