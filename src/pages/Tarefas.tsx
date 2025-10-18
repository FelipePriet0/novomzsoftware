import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/context/AuthContext';
import { Task } from '@/types/tasks';
import { Calendar, User, CheckCircle2, Clock, ListTodo, ExternalLink } from 'lucide-react';
import { format, isToday, isThisWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ModalEditarFicha from '@/components/ui/ModalEditarFicha';

type FilterType = 'today' | 'week' | 'all';

export default function Tarefas() {
  const { profile } = useAuth();
  const { tasks, isLoading, updateTaskStatus, loadTasks } = useTasks(profile?.id);
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterType>('all');
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCardData, setSelectedCardData] = useState<any>(null);
  const [isLoadingCard, setIsLoadingCard] = useState(false);

  // Filtrar tarefas
  const filteredTasks = tasks.filter(task => {
    if (filter === 'today') {
      return task.deadline && isToday(new Date(task.deadline));
    } else if (filter === 'week') {
      return task.deadline && isThisWeek(new Date(task.deadline), { locale: ptBR });
    }
    return true;
  });

  // Separar pendentes e concluídas
  const pendingTasks = filteredTasks.filter(t => t.status === 'pending');
  const completedTodayTasks = tasks.filter(t => 
    t.status === 'completed' && 
    t.completed_at && 
    isToday(new Date(t.completed_at))
  );

  const handleToggleTask = async (taskId: string, currentStatus: Task['status']) => {
    setUpdatingTaskId(taskId);
    try {
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      const success = await updateTaskStatus(taskId, newStatus);
      
      if (success) {
        toast({
          title: newStatus === 'completed' ? 'Tarefa concluída!' : 'Tarefa reaberta',
          description: newStatus === 'completed' 
            ? 'A tarefa foi marcada como concluída.' 
            : 'A tarefa foi reaberta.',
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a tarefa.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const isOverdue = (task: Task) => {
    if (!task.deadline) return false;
    return new Date(task.deadline) < new Date() && task.status === 'pending';
  };

  // Abre o card pelo applicant_id quando possível; fallback por card_id
  const handleOpenCard = async (cardId: string, applicantIdFromTask?: string | null) => {
    setIsLoadingCard(true);
    try {
      // 1) Descobrir o card (preferindo applicant_id quando disponível)
      let cardRow: any = null;
      if (applicantIdFromTask) {
        const { data, error } = await (supabase as any)
          .from('kanban_cards')
          .select('id, area, stage, person_type, received_at, due_at, applicant_id')
          .eq('applicant_id', applicantIdFromTask)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error && data) cardRow = data;
      }
      if (!cardRow) {
        const { data, error } = await (supabase as any)
          .from('kanban_cards')
          .select('id, area, stage, person_type, received_at, due_at, applicant_id')
          .eq('id', cardId)
          .maybeSingle();
        if (error) throw error;
        cardRow = data;
      }

      if (!cardRow) throw new Error('Card não encontrado');

      // 2) Carregar dados do applicant (plano)
      let applicant: any = null;
      if (cardRow.applicant_id) {
        const { data: a } = await (supabase as any)
          .from('applicants')
          .select('id, primary_name, cpf_cnpj, phone, email')
          .eq('id', cardRow.applicant_id)
          .maybeSingle();
        applicant = a;
      }

      // 3) Mapear para o formato esperado pelo ModalEditarFicha
      const receivedAt = cardRow.received_at ? new Date(cardRow.received_at).toISOString() : new Date().toISOString();
      const deadline = cardRow.due_at ? new Date(cardRow.due_at).toISOString() : receivedAt;
      const toColumnId = (() => {
        if (cardRow.area === 'comercial') {
          const stageMap: Record<string, string> = {
            entrada: 'com_entrada',
            feitas: 'com_feitas',
            aguardando_doc: 'com_aguardando',
            canceladas: 'com_canceladas',
            concluidas: 'com_concluidas',
          };
          return stageMap[cardRow.stage] || 'com_entrada';
        }
        return cardRow.stage;
      })();

      const mappedCard = {
        id: cardRow.id,
        nome: applicant?.primary_name ?? 'Cliente',
        telefone: applicant?.phone || undefined,
        email: applicant?.email || undefined,
        cpf: applicant?.cpf_cnpj || '',
        personType: cardRow.person_type || undefined,
        receivedAt,
        deadline,
        updatedAt: receivedAt,
        lastMovedAt: receivedAt,
        columnId: toColumnId,
        parecer: '',
        applicantId: applicant?.id,
      } as any;

      setSelectedCardData(mappedCard);
      setSelectedCardId(cardRow.id);
    } catch (error: any) {
      console.error('❌ Erro ao carregar card:', error);
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível abrir o card.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingCard(false);
    }
  };

  const handleCloseCardModal = () => {
    setSelectedCardId(null);
    setSelectedCardData(null);
  };

  const handleSaveCard = async (updatedCard: any) => {
    // Salvar alterações já ocorre no modal; aqui apenas fechamos e atualizamos lista
    handleCloseCardModal();
    try {
      await loadTasks();
    } catch (_) {
      // manter silencioso para não travar a UI
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#018942] to-[#016b35] rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <ListTodo className="h-8 w-8 text-white" />
          </div>
          <p className="text-gray-600 font-medium">Carregando tarefas...</p>
          <p className="text-gray-400 text-sm mt-1">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header Hero com gradiente moderno */}
        <div className="bg-gradient-to-br from-[#018942] via-[#016b35] to-[#014d28] text-white rounded-xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true"></div>
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <ListTodo className="h-6 w-6 text-white" />
            </div>
            <div className="flex items-center gap-3">
              <img 
                src="/src/assets/Logo MZNET (1).png" 
                alt="MZNET Logo" 
                className="h-8 w-auto filter brightness-0 invert"
              />
              <div>
                <h1 className="text-2xl font-bold text-white">Minhas Tarefas</h1>
                <p className="text-green-100 text-sm mt-1">
                  Gerencie suas tarefas e acompanhe o progresso
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros com design moderno */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            Filtros
          </h3>
          <div className="flex gap-3">
            <Button
              variant={filter === 'today' ? 'default' : 'outline'}
              onClick={() => setFilter('today')}
              className={cn(
                "rounded-lg transition-all duration-200",
                filter === 'today' 
                  ? 'bg-gradient-to-r from-[#018942] to-[#016b35] hover:from-[#016b35] hover:to-[#014d28] text-white shadow-md hover:shadow-lg' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-[#018942]'
              )}
            >
              Hoje
            </Button>
            <Button
              variant={filter === 'week' ? 'default' : 'outline'}
              onClick={() => setFilter('week')}
              className={cn(
                "rounded-lg transition-all duration-200",
                filter === 'week' 
                  ? 'bg-gradient-to-r from-[#018942] to-[#016b35] hover:from-[#016b35] hover:to-[#014d28] text-white shadow-md hover:shadow-lg' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-[#018942]'
              )}
            >
              Semana
            </Button>
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              className={cn(
                "rounded-lg transition-all duration-200",
                filter === 'all' 
                  ? 'bg-gradient-to-r from-[#018942] to-[#016b35] hover:from-[#016b35] hover:to-[#014d28] text-white shadow-md hover:shadow-lg' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-[#018942]'
              )}
            >
              Todas
            </Button>
          </div>
        </div>

        {/* Contadores com design moderno */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 mb-1">Tarefas a Fazer</p>
                <p className="text-3xl font-bold text-blue-600">{pendingTasks.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 mb-1">Concluídas Hoje</p>
                <p className="text-3xl font-bold text-green-600">{completedTodayTasks.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Tarefas Moderna */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="bg-gray-50 rounded-t-xl px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              Todas as Tarefas
            </h3>
          </div>
          
          <div className="p-6">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ListTodo className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg font-medium">Nenhuma tarefa encontrada</p>
                <p className="text-gray-400 text-sm mt-1">Tente ajustar os filtros ou criar uma nova tarefa</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "group flex items-start gap-4 p-5 border rounded-xl transition-all duration-200 hover:shadow-md cursor-pointer",
                      task.status === 'completed' 
                        ? "bg-green-50 border-green-200" 
                        : isOverdue(task)
                        ? "bg-red-50 border-red-200"
                        : "bg-white border-gray-200 hover:border-[#018942]/30"
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenCard(task.card_id, (task as any).applicant_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenCard(task.card_id, (task as any).applicant_id);
                      }
                    }}
                    aria-label="Abrir card da tarefa"
                  >
                    {/* Checkbox Moderno */}
                    <div className="flex-shrink-0 mt-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={task.status === 'completed'}
                        onCheckedChange={() => handleToggleTask(task.id, task.status)}
                        disabled={updatingTaskId === task.id}
                        className={cn(
                          "w-5 h-5 rounded-md",
                          task.status === 'completed' && "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                        )}
                      />
                    </div>

                    {/* Conteúdo Principal */}
                    <div className="flex-1 min-w-0">
                      {/* Descrição com Botão */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className={cn(
                          "font-medium text-gray-900 flex-1",
                          task.status === 'completed' && "line-through text-gray-500"
                        )}>
                          {task.description}
                        </div>
                        {/* CTA removido — o card inteiro é clicável */}
                      </div>

                      {/* Metadados Organizados */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        {/* Card */}
                        {task.card_title && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                            <span className="font-medium">Card:</span>
                            <span className="truncate">{task.card_title}</span>
                          </div>
                        )}

                        {/* Criado por */}
                        <div className="flex items-center gap-2 text-gray-600">
                          <User className="h-3 w-3" />
                          <span className="font-medium">Por:</span>
                          <span>{task.created_by_name}</span>
                        </div>

                        {/* Prazo */}
                        {task.deadline && (
                          <div className={cn(
                            "flex items-center gap-2",
                            isOverdue(task) && "text-red-600 font-medium"
                          )}>
                            <Calendar className="h-3 w-3" />
                            <span className="font-medium">Prazo:</span>
                            <span>
                              {format(new Date(task.deadline), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                            {isOverdue(task) && (
                              <Badge variant="destructive" className="ml-2 text-xs">Atrasada</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Badge Moderno */}
                    <div className="flex-shrink-0">
                      <Badge
                        className={cn(
                          "rounded-lg font-medium",
                          task.status === 'completed' 
                            ? "bg-green-500 hover:bg-green-600 text-white" 
                            : "bg-blue-500 hover:bg-blue-600 text-white"
                        )}
                      >
                        {task.status === 'completed' ? 'Concluída' : 'Pendente'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      {/* Modal "Editar Ficha" */}
      {selectedCardId && selectedCardData && (
        <ModalEditarFicha
          card={selectedCardData}
          onClose={handleCloseCardModal}
          onSave={handleSaveCard}
          onRefetch={() => {
            // Atualizar lista de tarefas após mudanças no card
            window.location.reload();
          }}
        />
      )}
    </div>
    </div>
  );
}
