import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/context/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Comment } from '@/components/comments/CommentItem';

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  cardId: string;
  onCommentCreate?: (content: string) => Promise<Comment | null>;
  parentCommentId?: string;
  editingTask?: any | null; // Tarefa sendo editada (null = modo criação)
  onTaskUpdate?: (taskId: string, updates: any) => Promise<boolean>;
}

interface User {
  id: string;
  full_name: string;
  role: string;
}

export function AddTaskModal({ open, onClose, cardId, onCommentCreate, parentCommentId, editingTask, onTaskUpdate }: AddTaskModalProps) {
  const { profile } = useAuth();
  const { createTask, updateTask, loadTasks } = useTasks(undefined, cardId);
  const { toast } = useToast();

  const [assignedTo, setAssignedTo] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  
  // Estados para detectar mudanças não salvas
  const [originalValues, setOriginalValues] = useState({ assignedTo: '', description: '', deadline: '' });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Carregar usuário atual e lista de usuários
  useEffect(() => {
    const loadData = async () => {
      if (!open) {
        return;
      }

      setIsLoadingUsers(true);
      try {
        // Buscar TODOS os usuários (sem filtro de role)
        const { data: usersData, error } = await (supabase as any)
          .from('profiles')
          .select('id, full_name, role')
          .order('full_name');

        if (error) {
          console.error('❌ Erro ao buscar usuários:', error);
          throw error;
        }

        console.log('✅ Usuários carregados:', usersData?.length || 0);
        setUsers(usersData || []);

        // Pegar o nome do usuário atual
        if (profile?.full_name) {
          setCurrentUserName(profile.full_name);
        } else {
          // Fallback: buscar do Supabase Auth
          const { data: { user } } = await (supabase as any).auth.getUser();
          if (user) {
            const currentUser = usersData?.find((u: User) => u.id === user.id);
            setCurrentUserName(currentUser?.full_name || user.email || 'Usuário');
          }
        }
      } catch (err) {
        console.error('❌ Error loading users:', err);
        toast({
          title: 'Erro ao carregar colaboradores',
          description: 'Não foi possível carregar a lista de colaboradores',
          variant: 'destructive',
        });
        setUsers([]);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    loadData();
  }, [open, profile]);

  // Preencher campos quando estiver editando (APENAS quando usuários já foram carregados)
  useEffect(() => {
    // Só preencher se os usuários já foram carregados
    if (isLoadingUsers) {
      console.log('⏳ Aguardando carregamento de usuários...');
      return;
    }

    if (editingTask && open) {
      console.log('📝 Preenchendo campos com dados da tarefa:', editingTask);
      
      const assignedToValue = editingTask.assigned_to || '';
      const descriptionValue = editingTask.description || '';
      const deadlineValue = editingTask.deadline ? editingTask.deadline.slice(0, 16) : '';
      
      console.log('📝 Valores que serão setados:', {
        assignedTo: assignedToValue,
        description: descriptionValue,
        deadline: deadlineValue,
        usersLoaded: users.length
      });
      
      // Verificar se o usuário atribuído existe na lista
      const userExists = users.some(u => u.id === assignedToValue);
      if (assignedToValue && !userExists) {
        console.warn('⚠️ Usuário atribuído não encontrado na lista:', assignedToValue);
      }
      
      setAssignedTo(assignedToValue);
      setDescription(descriptionValue);
      setDeadline(deadlineValue);
      
      // Salvar valores originais para comparação
      setOriginalValues({
        assignedTo: assignedToValue,
        description: descriptionValue,
        deadline: deadlineValue
      });
    } else if (!editingTask && open) {
      // Limpar campos quando não estiver editando (apenas criação)
      console.log('📝 Limpando campos para criação de nova tarefa');
      setAssignedTo('');
      setDescription('');
      setDeadline('');
      
      // Limpar valores originais
      setOriginalValues({ assignedTo: '', description: '', deadline: '' });
    }
    
    // Reset mudanças não salvas
    setHasUnsavedChanges(false);
  }, [editingTask, open, isLoadingUsers, users]);

  // Detectar mudanças nos campos (apenas no modo de edição)
  useEffect(() => {
    if (editingTask && open) {
      const hasChanges = 
        assignedTo !== originalValues.assignedTo ||
        description !== originalValues.description ||
        deadline !== originalValues.deadline;
      
      setHasUnsavedChanges(hasChanges);
    }
  }, [assignedTo, description, deadline, originalValues, editingTask, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assignedTo || !description.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o colaborador e a descrição da tarefa',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const isEditing = editingTask !== null;

      if (isEditing && editingTask) {
        // Modo de edição
        const success = await updateTask(editingTask.id, {
          assigned_to: assignedTo,
          description: description.trim(),
          deadline: deadline || undefined,
        });

        if (success) {
          toast({
            title: 'Tarefa atualizada com sucesso!',
            description: `Tarefa atualizada para ${users.find(u => u.id === assignedTo)?.full_name}`,
          });
          
          // Notificar o componente pai para recarregar (força atualização completa)
          console.log('✨ [AddTaskModal] Notificando componente pai sobre atualização...');
          if (onTaskUpdate) {
            await onTaskUpdate(editingTask.id, {
              assigned_to: assignedTo,
              description: description.trim(),
              deadline: deadline || undefined,
            });
          }
          
          handleCloseModal();
        }
      } else {
        // Modo de criação
        let commentId: string | undefined;

        // ✅ GARANTIA 1: Verificar se função de criar comentário existe
        if (!onCommentCreate) {
          console.error('❌ [AddTaskModal] Função onCommentCreate não disponível!');
          toast({
            title: 'Erro de configuração',
            description: 'Sistema de comentários não disponível. Contate o suporte.',
            variant: 'destructive',
          });
          return;
        }

        // ✅ GARANTIA 2: SEMPRE criar o comentário ANTES da tarefa
        const assignedUser = users.find(u => u.id === assignedTo);
        const deadlineText = deadline
          ? `\n📅 **Prazo:** ${new Date(deadline).toLocaleString('pt-BR')}`
          : '';

        const commentContent = `📋 **Tarefa criada**\n\n` +
          `👤 **Para:** @${assignedUser?.full_name}\n` +
          `📝 **Descrição:** ${description.trim()}` +
          deadlineText;

        console.log('💬 [AddTaskModal] Criando comentário da tarefa...');
        const comment = await onCommentCreate(commentContent);
        
        if (comment) {
          commentId = comment.id;
          console.log('✅ [AddTaskModal] Comentário criado:', commentId);
        } else {
          // ✅ FAIL-SAFE: Se comentário falhar, NÃO criar tarefa!
          console.error('❌ [AddTaskModal] Falha ao criar comentário da tarefa');
          toast({
            title: 'Erro ao criar tarefa',
            description: 'Não foi possível criar o comentário associado à tarefa. Tente novamente.',
            variant: 'destructive',
          });
          return; // ← ABORTAR criação da tarefa
        }

        // ✅ GARANTIA 3: comment_id SEMPRE será válido aqui!
        console.log('📝 [AddTaskModal] Criando tarefa com comment_id garantido:', commentId);
        const task = await createTask({
          card_id: cardId,
          assigned_to: assignedTo,
          description: description.trim(),
          deadline: deadline || undefined,
        }, commentId); // ✅ Garantido que commentId existe

        if (task) {
          toast({
            title: 'Tarefa criada com sucesso!',
            description: `Tarefa atribuída para ${users.find(u => u.id === assignedTo)?.full_name}`,
          });
          handleCloseModal();
        }
      }
    } catch (error) {
      console.error('Error submitting task:', error);
      const isEditing = editingTask !== null;
      toast({
        title: isEditing ? 'Erro ao atualizar tarefa' : 'Erro ao criar tarefa',
        description: 'Não foi possível processar a tarefa. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Se há mudanças não salvas, mostrar diálogo de confirmação
    if (hasUnsavedChanges && editingTask) {
      setShowConfirmDialog(true);
      return;
    }
    
    // Caso contrário, fechar normalmente
    handleCloseModal();
  };

  const handleCloseModal = () => {
    setAssignedTo('');
    setDescription('');
    setDeadline('');
    setHasUnsavedChanges(false);
    setShowConfirmDialog(false);
    onClose();
  };

  const handleConfirmDiscard = () => {
    setShowConfirmDialog(false);
    handleCloseModal();
  };

  const handleConfirmSave = async () => {
    setShowConfirmDialog(false);
    
    if (!editingTask) return;
    
    // Validar campos obrigatórios
    if (!assignedTo || !description.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o colaborador e a descrição da tarefa',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Atualizar a tarefa diretamente
      const success = await updateTask(editingTask.id, {
        assigned_to: assignedTo,
        description: description.trim(),
        deadline: deadline || undefined,
      });

      if (success) {
        toast({
          title: 'Tarefa atualizada com sucesso!',
          description: `Tarefa atualizada para ${users.find(u => u.id === assignedTo)?.full_name}`,
        });
        
        // Notificar o componente pai para recarregar (força atualização completa)
        console.log('✨ [AddTaskModal] Notificando componente pai sobre atualização via dialog...');
        if (onTaskUpdate) {
          await onTaskUpdate(editingTask.id, {
            assigned_to: assignedTo,
            description: description.trim(),
            deadline: deadline || undefined,
          });
        }
        
        handleCloseModal();
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Erro ao atualizar tarefa',
        description: 'Não foi possível atualizar a tarefa. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        // Interceptar fechamento para verificar mudanças não salvas
        handleCancel();
      }
    }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        {/* Header com gradiente moderno */}
        <SheetHeader className="bg-gradient-to-br from-[#018942] via-[#016b35] to-[#014d28] text-white p-6 relative overflow-hidden">
          <div className='absolute inset-0 bg-[url("data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")] opacity-20'></div>
          <div className="relative">
            <SheetTitle className="text-xl font-semibold text-white">
              {editingTask ? 'Editar Tarefa' : 'Adicionar Tarefa'}
            </SheetTitle>
            <p className="text-green-100 text-sm mt-1">
              {editingTask ? 'Atualize os detalhes da tarefa' : 'Crie uma nova tarefa para a equipe'}
            </p>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Seção: Atribuição */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Atribuição da Tarefa
            </h3>
            <div className="space-y-4">
              {/* Campo: De */}
              <div className="space-y-2">
                <label htmlFor="createdBy" className="text-sm font-medium text-gray-700">
                  De:
                </label>
                <div className="flex h-11 w-full items-center rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-sm text-gray-700">
                  {currentUserName || 'Carregando...'}
                </div>
              </div>

              {/* Campo: Para */}
              <div className="space-y-2">
                <label htmlFor="assignedTo" className="text-sm font-medium text-gray-700">
                  Para:
                </label>
                <Select value={assignedTo} onValueChange={setAssignedTo} disabled={isLoadingUsers}>
                  <SelectTrigger 
                    id="assignedTo" 
                    className="rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900"
                  >
                    <SelectValue 
                      placeholder={isLoadingUsers ? "Carregando..." : "Selecione um colaborador"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {users.length === 0 && !isLoadingUsers && (
                      <div className="p-2 text-xs text-gray-500">Nenhum colaborador encontrado</div>
                    )}
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id} className="hover:bg-green-50">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          {user.full_name} · <span className="text-xs text-gray-500">{user.role}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  {isLoadingUsers ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Carregando colaboradores...
                    </>
                  ) : (
                    <>
                      <span className="text-green-600">●</span>
                      {users.length} colaborador(es) disponível(is)
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Seção: Descrição da Tarefa */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Descrição da Tarefa
            </h3>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium text-gray-700">
                Descreva a tarefa:
              </label>
              <Textarea
                id="description"
                placeholder="Ex.: Reagendar instalação para o dia 12/10 às 14h."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="resize-none rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
              />
              <p className="text-xs text-gray-500">
                Seja claro e específico sobre o que precisa ser feito
              </p>
            </div>
          </div>

          {/* Seção: Prazo */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              Prazo
            </h3>
            <div className="space-y-2">
              <label htmlFor="deadline" className="text-sm font-medium text-gray-700">
                Data e hora limite (Opcional):
              </label>
              <input
                type="datetime-local"
                id="deadline"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="flex h-11 w-full items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#018942] focus:border-[#018942]"
              />
              {deadline && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="text-purple-600">●</span>
                  Prazo definido para {new Date(deadline).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 mt-6 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border-gray-300 hover:border-gray-400 rounded-lg transition-all duration-200"
            >
              {editingTask ? 'Descartar Alterações' : 'Cancelar'}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-[#018942] to-[#016b35] hover:from-[#016b35] hover:to-[#014d28] text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingTask ? 'Salvando...' : 'Criando...'}
                </>
              ) : (
                editingTask ? 'Salvar Alterações' : 'Criar Tarefa'
              )}
            </Button>
          </div>
        </form>
      </SheetContent>

      {/* Diálogo de Confirmação para Mudanças Não Salvas */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você fez alterações na tarefa. Deseja salvar as alterações antes de sair?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={handleConfirmDiscard}
              className="bg-red-500 hover:bg-red-600 text-white border-red-500 hover:border-red-600"
            >
              Descartar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmSave} 
              className="bg-[#018942] hover:bg-[#018942]/90 text-white"
            >
              Salvar e Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

