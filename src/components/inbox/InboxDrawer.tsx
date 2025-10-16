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
  const { items, loading, markAllRead, markRead, remove } = useInbox();
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
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 text-[#018942]">
            <Bell className="h-5 w-5" />
            <span className="font-semibold">Caixa de Entrada</span>
            <Badge variant="secondary">{unreadCount}</Badge>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-2 text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between px-4 py-2 border-b gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v)=>setFilter(v as FilterTab)}>
              <SelectTrigger className="w-40 bg-white text-[#018942] border-[#018942]">
                <SelectValue placeholder="Filtro" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">Tudo</SelectItem>
                <SelectItem value="tasks">Tarefas</SelectItem>
                <SelectItem value="conversations">Conversas</SelectItem>
                <SelectItem value="fichas">Fichas</SelectItem>
                <SelectItem value="overdue">Atrasos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-gray-500" />
            <select value={sort} onChange={e=>setSort(e.target.value as SortKey)} className="text-sm border rounded px-2 py-1">
              <option value="recent">Recente</option>
              <option value="priority">Prioridade</option>
              <option value="unread">Não lidas</option>
            </select>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading && <div className="text-sm text-gray-500 px-2">Carregando...</div>}
          {!loading && filtered.length===0 && (
            <div className="text-sm text-[#018942] px-2">Nenhuma notificação por aqui. Mantenha a caixa vazia! ✨</div>
          )}

          <div className="space-y-2">
            {filtered.map(item => {
              // Mantém ícone baseado em prioridade; fundo verde primário 15%
              const Icon = item.priority==='high'? AlertTriangle : item.priority==='medium'? Clock : ClipboardList;
              const meta = (item as any)?.meta || {};
              const cardId = (meta.cardId || meta.card_id) as string | undefined;
              const applicantId = (meta.applicantId || meta.applicant_id) as string | undefined;
              const destUrl = cardId ? `/?openCardId=${cardId}` : applicantId ? `/?openApplicantId=${applicantId}` : (item.link_url || null);
              return (
                <div
                  key={item.id}
                  className={`rounded-md border p-2 flex items-start justify-between gap-2 ${(cardId || applicantId) ? 'cursor-pointer' : ''}`}
                  style={{
                    backgroundColor: 'hsl(var(--brand) / 0.15)',
                    borderColor: 'hsl(var(--brand))'
                  }}
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
                  <div className="flex items-start gap-2">
                    <Icon className="h-4 w-4 mt-1" />
                    <div>
                      <div className="text-sm font-medium">{item.title}</div>
                      <div className="text-xs text-gray-600 whitespace-pre-wrap">{item.body}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!item.read_at && (
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={(e)=>{ e.stopPropagation(); markRead(item.id); }}><Check className="h-4 w-4" /> Lida</Button>
                    )}
                    {item.transient && (
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={(e)=>{ e.stopPropagation(); remove(item.id); }}>Descartar</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center justify-between text-sm">
          <Button onClick={markAllRead} className="bg-[#018942] text-white hover:bg-[#018942]/90"><Check className="h-4 w-4 mr-1" /> Marcar todas como lidas</Button>
          <Button variant="ghost" className="text-gray-600">Ver histórico</Button>
        </div>
      </div>
    </div>
  );
}
