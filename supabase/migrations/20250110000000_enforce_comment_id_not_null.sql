-- =====================================================
-- GARANTIR QUE TODA TAREFA TENHA UM COMENTÃRIO
-- =====================================================
-- Esta migration garante que a coluna comment_id em card_tasks
-- NUNCA seja NULL, criando comentÃ¡rios retroativos para tarefas
-- antigas e aplicando constraint NOT NULL.
-- =====================================================

DO $$
DECLARE
  task_rec RECORD;
  new_comment_id UUID;
  tasks_updated INTEGER := 0;
BEGIN
  RAISE NOTICE 'ðŸ” Iniciando migraÃ§Ã£o para garantir comment_id NOT NULL...';
  
  -- =====================================================
  -- PASSO 1: Criar comentÃ¡rios retroativos para tarefas antigas
  -- =====================================================
  
  RAISE NOTICE 'ðŸ“‹ Verificando tarefas sem comment_id...';
  
  -- Para cada tarefa sem comment_id
  FOR task_rec IN 
    SELECT 
      t.id,
      t.card_id,
      t.created_by,
      t.assigned_to,
      t.description,
      t.created_at,
      COALESCE(p.full_name, 'UsuÃ¡rio Desconhecido') as creator_name,
      COALESCE(p.role::text, 'vendedor') as creator_role,
      COALESCE(ap.full_name, 'UsuÃ¡rio Desconhecido') as assigned_name
    FROM card_tasks t
    LEFT JOIN profiles p ON p.id = t.created_by
    LEFT JOIN profiles ap ON ap.id = t.assigned_to
    WHERE t.comment_id IS NULL
    ORDER BY t.created_at ASC
  LOOP
    -- Criar comentÃ¡rio retroativo com thread_id
    -- Para comentÃ¡rios de tarefa (level = 0), usar o prÃ³prio ID como thread_id
    new_comment_id := gen_random_uuid();
    
    INSERT INTO card_comments (
      id,
      card_id,
      author_id,
      author_name,
      author_role,
      content,
      level,
      thread_id,
      is_thread_starter,
      created_at,
      updated_at
    ) VALUES (
      new_comment_id,
      task_rec.card_id,
      task_rec.created_by,
      task_rec.creator_name,
      task_rec.creator_role,
      'ðŸ“‹ **Tarefa criada**

ðŸ‘¤ **Para:** @' || task_rec.assigned_name || '
ðŸ“ **DescriÃ§Ã£o:** ' || task_rec.description || '

_ðŸ’¡ ComentÃ¡rio gerado automaticamente durante migraÃ§Ã£o do sistema_',
      0, -- NÃ­vel 0 (comentÃ¡rio raiz)
      new_comment_id::text, -- âœ… thread_id = prÃ³prio ID (comentÃ¡rio principal)
      true, -- âœ… is_thread_starter = true (Ã© o inÃ­cio da thread)
      task_rec.created_at, -- Manter data original da tarefa
      task_rec.created_at
    );
    
    -- Atualizar tarefa com o comment_id
    UPDATE card_tasks 
    SET comment_id = new_comment_id 
    WHERE id = task_rec.id;
    
    tasks_updated := tasks_updated + 1;
    
    RAISE NOTICE '  âœ… Tarefa % vinculada ao comentÃ¡rio %', 
      SUBSTRING(task_rec.id::TEXT, 1, 8), 
      SUBSTRING(new_comment_id::Text, 1, 8);
  END LOOP;
  
  IF tasks_updated > 0 THEN
    RAISE NOTICE 'âœ… % tarefas antigas atualizadas com comentÃ¡rios retroativos', tasks_updated;
  ELSE
    RAISE NOTICE 'âœ… Nenhuma tarefa antiga encontrada sem comment_id';
  END IF;
  
  -- =====================================================
  -- PASSO 2: Tornar comment_id obrigatÃ³rio (NOT NULL)
  -- =====================================================
  
  RAISE NOTICE 'ðŸ”’ Aplicando constraint NOT NULL em comment_id...';
  
  -- Verificar se ainda hÃ¡ tarefas sem comment_id
  IF EXISTS (SELECT 1 FROM card_tasks WHERE comment_id IS NULL) THEN
    RAISE EXCEPTION 'âŒ ERRO: Ainda existem tarefas sem comment_id! Migration abortada.';
  END IF;
  
  -- Aplicar constraint NOT NULL
  ALTER TABLE card_tasks 
    ALTER COLUMN comment_id SET NOT NULL;
  
  RAISE NOTICE 'âœ… Constraint NOT NULL aplicada com sucesso!';
  
  -- =====================================================
  -- PASSO 3: Atualizar comentÃ¡rio da coluna
  -- =====================================================
  
  COMMENT ON COLUMN card_tasks.comment_id IS 
    'ID do comentÃ¡rio associado (OBRIGATÃ“RIO - toda tarefa DEVE ter um comentÃ¡rio vinculado)';
  
  RAISE NOTICE 'âœ… DocumentaÃ§Ã£o atualizada';
  
  -- =====================================================
  -- PASSO 4: Adicionar Ã­ndice para performance (se nÃ£o existir)
  -- =====================================================
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'card_tasks' 
    AND indexname = 'idx_card_tasks_comment_id'
  ) THEN
    CREATE INDEX idx_card_tasks_comment_id ON card_tasks(comment_id);
    RAISE NOTICE 'âœ… Ãndice idx_card_tasks_comment_id criado';
  ELSE
    RAISE NOTICE 'âœ… Ãndice idx_card_tasks_comment_id jÃ¡ existe';
  END IF;
  
  -- =====================================================
  -- RESUMO FINAL
  -- =====================================================
  
  RAISE NOTICE '';
  RAISE NOTICE 'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”';
  RAISE NOTICE 'âœ… MIGRAÃ‡ÃƒO CONCLUÃDA COM SUCESSO!';
  RAISE NOTICE 'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”';
  RAISE NOTICE '';
  RAISE NOTICE 'ðŸ“Š Resumo:';
  RAISE NOTICE '  â€¢ Tarefas atualizadas: %', tasks_updated;
  RAISE NOTICE '  â€¢ Constraint NOT NULL: âœ… Aplicada';
  RAISE NOTICE '  â€¢ Ãndice de performance: âœ… Criado';
  RAISE NOTICE '';
  RAISE NOTICE 'ðŸŽ¯ A partir de agora, TODAS as tarefas devem ter comment_id!';
  RAISE NOTICE '';
  
END $$;

