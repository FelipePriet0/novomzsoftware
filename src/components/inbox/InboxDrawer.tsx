import React, { useMemo, useState } from 'react';
import { useInbox } from '@/hooks/useInbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Filter, X, Bell, AlertTriangle, Clock, ClipboardList, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type FilterTab = 'all' | 'tasks' | 'conversations' | 'fichas' | 'overdue';
type SortKey = 'recent' | 'priority' | 'unread';

export function InboxDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, loading, markAllRead, markRead, remove, fetchMore } = useInbox();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const navigate = useNavigate();

  const unreadCount = items.filter(i => !i.read_at).length;

  const filtered = useMemo(() => {
    let list = [...items];
    if (filter !== 'all') {
      list = list.filter(i => {
        if (filter === 'tasks') return i.type.startsWith('task_');
        if (filter === 'conversations') return i.type === 'mention' || i.type === 'thread_reply' || i.type === 'card_linked';
        if (filter === 'fichas') return i.type === 'new_ficha' || i.type === 'ficha_dispute';
        if (filter === 'overdue') return i.type === 'ficha_overdue' || i.type === 'task_due';
        return true;
      });
    }
    if (sort === 'priority') {
      const weight: any = { high: 0, medium: 1, low: 2 };
      list.sort((a,b) => (weight[a.priority] - weight[b.priority]) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } else if (sort === 'unread') {
      list.sort((a,b) => Number(!!a.read_at) - Number(!!b.read_at));
    } else {
      list.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  }, [items, filter, sort]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Header com gradiente moderno */}
        <div className="bg-gradient-to-br from-[#018942] via-[#016b35] to-[#014d28] text-white px-6 py-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Caixa de Entrada</h2>
                <p className="text-green-100 text-xs">
                  {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Todas as notificações lidas'}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              aria-label="Fechar" 
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-all duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Seção de Filtros */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-700 mb-1 block">Filtrar por:</label>
              <Select value={filter} onValueChange={(v)=>setFilter(v as FilterTab)}>
                <SelectTrigger className="w-full rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 bg-white">
                  <SelectValue placeholder="Filtro" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="all" className="hover:bg-green-50">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                      Tudo
                    </div>
                  </SelectItem>
                  <SelectItem value="tasks" className="hover:bg-green-50">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      Tarefas
                    </div>
                  </SelectItem>
                  <SelectItem value="conversations" className="hover:bg-green-50">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      Conversas
                    </div>
                  </SelectItem>
                  <SelectItem value="fichas" className="hover:bg-green-50">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      Fichas
                    </div>
                  </SelectItem>
                  <SelectItem value="overdue" className="hover:bg-green-50">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      Atrasos
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-700 mb-1 block">Ordenar por:</label>
              <Select value={sort} onValueChange={(v)=>setSort(v as SortKey)}>
                <SelectTrigger className="w-full rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="recent" className="hover:bg-green-50">Recente</SelectItem>
                  <SelectItem value="priority" className="hover:bg-green-50">Prioridade</SelectItem>
                  <SelectItem value="unread" className="hover:bg-green-50">Não lidas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                <div className="w-6 h-6 border-2 border-[#018942] border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-sm text-gray-600">Carregando notificações...</p>
            </div>
          )}
          {!loading && filtered.length===0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 text-[#018942]" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Tudo limpo!</p>
              <p className="text-xs text-gray-500">Nenhuma notificação por aqui ✨</p>
            </div>
          )}

          <div className="space-y-3">
            {filtered.map(item => {
              // Mantém ícone baseado em prioridade; fundo verde primário 15%
              const Icon = item.priority==='high'? AlertTriangle : item.priority==='medium'? Clock : ClipboardList;
              const meta = (item as any)?.meta || {};
              const cardId = (meta.cardId || meta.card_id) as string | undefined;
              const applicantId = (meta.applicantId || meta.applicant_id) as string | undefined;
              const destUrl = cardId ? `/?openCardId=${cardId}` : applicantId ? `/?openApplicantId=${applicantId}` : (item.link_url || null);
              const priorityColors = {
                high: 'bg-red-50 border-red-200',
                medium: 'bg-amber-50 border-amber-200',
                low: 'bg-blue-50 border-blue-200'
              };
              const priorityIconColors = {
                high: 'text-red-600',
                medium: 'text-amber-600',
                low: 'text-blue-600'
              };
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border bg-white shadow-sm hover:shadow-md transition-all duration-200 p-4 flex flex-col gap-3 ${!item.read_at ? 'border-l-4 border-l-[#018942]' : 'border-gray-200'} ${(cardId || applicantId) ? 'cursor-pointer hover:scale-[1.01]' : ''}`}
                  role={(destUrl ? 'button' : undefined) as any}
                  tabIndex={destUrl ? 0 : -1}
                  onClick={() => {
                    if (!destUrl) return;
                    // marca como lida ao clicar
                    if (!item.read_at) markRead(item.id);
                    navigate(destUrl);
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (!destUrl) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!item.read_at) markRead(item.id);
                      navigate(destUrl);
                      onClose();
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${priorityColors[item.priority]}`}>
                      <Icon className={`h-5 w-5 ${priorityIconColors[item.priority]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                        {!item.read_at && (
                          <div className="w-2 h-2 bg-[#018942] rounded-full flex-shrink-0 mt-1"></div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">
                      {new Date(item.created_at).toLocaleString('pt-BR', { 
                        day: '2-digit', 
                        month: 'short', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      {!item.read_at && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 px-3 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:border-green-300 rounded-lg transition-all duration-200" 
                          onClick={(e)=>{ e.stopPropagation(); markRead(item.id); }}
                        >
                          <Check className="h-3 w-3 mr-1" /> Lida
                        </Button>
                      )}
                      {item.transient && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg" 
                          onClick={(e)=>{ e.stopPropagation(); remove(item.id); }}
                        >
                          Descartar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
          <Button 
            onClick={markAllRead} 
            disabled={unreadCount === 0}
            className="bg-gradient-to-r from-[#018942] to-[#016b35] hover:from-[#016b35] hover:to-[#014d28] text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="h-4 w-4 mr-2" /> 
            Marcar todas como lidas
          </Button>
          <Button 
            variant="ghost" 
            className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
            onClick={fetchMore}
          >
            Ver histórico
          </Button>
        </div>
      </div>
    </div>
  );
}
