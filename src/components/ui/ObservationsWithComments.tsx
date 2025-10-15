import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MentionableTextarea } from '@/components/ui/MentionableTextarea';
import { Paperclip, ListTodo } from 'lucide-react';
import { CommentsList } from '@/components/comments/CommentsList';
import { useComments } from '@/hooks/useComments';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useAuth } from '@/context/AuthContext';
import { useAttachments } from '@/hooks/useAttachments';
import { AttachmentUploadModal } from '@/components/attachments/AttachmentUploadModal';
import { AttachmentList } from '@/components/attachments/AttachmentDisplay';
import { AddTaskModal } from '@/components/tasks/AddTaskModal';

interface ObservationsWithCommentsProps {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
  cardId: string;
  onAttachmentClick?: () => void;
  onRefetch?: () => void;
  // Removido sistema de empresas - todos podem acessar anexos
}

export function ObservationsWithComments({ 
  name, 
  value, 
  onChange, 
  className = "", 
  placeholder = "",
  cardId,
  onAttachmentClick,
  onRefetch
}: ObservationsWithCommentsProps) {
  const [showComments] = useState(true); // Sempre mostrar comentários
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  
  const { name: currentUserName } = useCurrentUser();
  const { profile } = useAuth();
  
  const {
    comments,
    isLoading: isLoadingComments,
    createComment,
    replyToComment,
    deleteComment,
    error: commentsError
  } = useComments(cardId || '');

  // Se houver erro (tabela não existe), mostrar apenas o campo de observações
  const hasCommentsError = commentsError && commentsError.includes('relation "public.card_comments" does not exist');


  const handleReply = async (parentId: string, content: string) => {
    if (!profile?.id) {
      if (import.meta.env.DEV) console.error('🚨 ERRO: profile.id não encontrado');
      return null;
    }
    
    try {
      const result = await replyToComment(
        parentId,
        content,
        profile.id,
        currentUserName || profile.full_name || 'Usuário',
        profile.role
      );
      return result; // IMPORTANTE: Retornar o resultado para o CommentsList
    } catch (error) {
      if (import.meta.env.DEV) console.error('🚨 ERRO em handleReply:', error);
      return null;
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!profile?.id) {
      if (import.meta.env.DEV) console.error('🚨 ERRO: profile.id não encontrado');
      return false;
    }
    
    try {
      const result = await deleteComment(commentId);
      
      // 🧪 TESTE: Comentado temporariamente - Realtime deve sincronizar automaticamente
      // Se comentários não desaparecerem após deletar, descomentar este bloco
      // if (result && onRefetch) {
      //   if (import.meta.env.DEV) console.log('🔍 DEBUG: Chamando onRefetch para recarregar comentários...');
      //   setTimeout(() => {
      //     onRefetch();
      //   }, 100);
      // }
      
      return result;
    } catch (error) {
      if (import.meta.env.DEV) console.error('🚨 ERRO em handleDelete:', error);
      return false;
    }
  };



  return (
    <div className="space-y-4">
      {/* Campo de Observações com CTA e mensagem integrados */}
      <div className="relative">
        <MentionableTextarea
          name={name}
          value={value}
          onChange={onChange}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const text = value.trim();
              
              if (text && !hasCommentsError) {
                try {
                  const result = await createComment({
                    cardId: cardId,
                    authorId: profile?.id || '',
                    authorName: currentUserName || profile?.full_name || 'Usuário',
                    authorRole: profile?.role || 'colaborador',
                    content: text,
                    level: 0,
                    threadId: `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // Gerar thread_id único para nova conversa
                  });
                  
                  // Limpar o campo após criar a conversa
                  onChange({
                    target: { name, value: '' }
                  } as React.ChangeEvent<HTMLTextAreaElement>);
                } catch (error) {
                  console.error('🚨 ERRO ao criar conversa:', error);
                }
              }
            }
          }}
          className={`${className} pt-12 pl-4`}
          placeholder={hasCommentsError ? placeholder : "Use @ Menções para marcar Colaboradores"}
        />
        
        {/* CTA Anexo integrado no campo - linha 1 */}
        {onAttachmentClick && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAttachmentClick}
            className="absolute top-2 left-2 h-8 px-3 py-1 bg-[#018942] hover:bg-[#018942]/90 text-white hover:text-white rounded-md text-sm font-medium"
            title="Anexar arquivo ou foto"
          >
            <Paperclip className="h-4 w-4 mr-1" />
            Anexo
          </Button>
        )}

        {/* CTA Adicionar Tarefa integrado no campo - linha 1 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAddTaskModal(true)}
          className="absolute top-2 left-28 h-8 px-3 py-1 bg-[#018942] hover:bg-[#018942]/90 text-white hover:text-white rounded-md text-sm font-medium"
          title="Adicionar tarefa"
        >
          <ListTodo className="h-4 w-4 mr-1" />
          Adicionar Tarefa
        </Button>
        
      </div>


      {/* Mensagem informativa se a tabela não existir */}
      {hasCommentsError && (
        <div className="text-sm text-muted-foreground bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          💡 Sistema de conversas não configurado ainda. Apenas o campo de observações está disponível.
        </div>
      )}


      {/* Lista de Comentários */}
      {!hasCommentsError && (
        <div className="border-t pt-4">
          <CommentsList
            cardId={cardId}
            currentUserId={profile?.id || ''}
            currentUserName={currentUserName || profile?.full_name || 'Usuário'}
            currentUserRole={profile?.role}
            comments={comments}
            onAddComment={undefined}
            onReply={handleReply}
            onDelete={handleDelete}
            onRefetch={onRefetch}
          />
        </div>
      )}

      {/* Modal de Adicionar Tarefa */}
      <AddTaskModal
        open={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        cardId={cardId}
        onCommentCreate={async (content: string) => {
          // Criar comentário como conversa encadeada
          const result = await createComment({
            cardId: cardId,
            authorId: profile?.id || '',
            authorName: currentUserName || profile?.full_name || 'Usuário',
            authorRole: profile?.role || 'colaborador',
            content: content,
            level: 0,
            threadId: `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          });
          return result;
        }}
      />

    </div>
  );
}
