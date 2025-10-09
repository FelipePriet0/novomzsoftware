-- =====================================================
-- CRIAR BUCKET DE STORAGE PARA ANEXOS
-- =====================================================
-- Este script cria o bucket 'card_attachments' no Supabase Storage
-- e configura todas as policies necessÃ¡rias
-- =====================================================

-- =====================================================
-- PASSO 1: Verificar buckets existentes
-- =====================================================
DO $$
DECLARE
  bucket_count INTEGER;
  bucket_rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'ðŸ” Verificando buckets existentes...';
  
  SELECT COUNT(*) INTO bucket_count FROM storage.buckets;
  
  RAISE NOTICE 'ðŸ“Š Total de buckets no Storage: %', bucket_count;
  
  -- Listar todos os buckets
  FOR bucket_rec IN (SELECT name, public, created_at FROM storage.buckets ORDER BY created_at) LOOP
    RAISE NOTICE '  ðŸ“¦ Bucket: % (Public: %, Criado: %)', 
      bucket_rec.name, 
      bucket_rec.public, 
      bucket_rec.created_at;
  END LOOP;
  
  RAISE NOTICE '';
END $$;

-- =====================================================
-- PASSO 2: Criar bucket 'card_attachments' se nÃ£o existir
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'ðŸ”§ Criando bucket card_attachments...';
  
  -- Inserir bucket (nÃ£o falha se jÃ¡ existir)
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'card_attachments',
    'card_attachments',
    false, -- âœ… Private bucket (requer autenticaÃ§Ã£o)
    52428800, -- 50MB limit por arquivo
    ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed'
    ]
  )
  ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
  
  RAISE NOTICE 'âœ… Bucket card_attachments criado/atualizado com sucesso!';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'âš ï¸ Erro ao criar bucket: %', SQLERRM;
    RAISE NOTICE 'âš ï¸ PossÃ­vel soluÃ§Ã£o: Criar bucket manualmente no Dashboard';
END $$;

-- =====================================================
-- PASSO 3: Remover policies antigas (se existirem)
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'ðŸ§¹ Removendo policies antigas (se existirem)...';
  
  DROP POLICY IF EXISTS "card_attachments_select_authenticated" ON storage.objects;
  DROP POLICY IF EXISTS "card_attachments_insert_authenticated" ON storage.objects;
  DROP POLICY IF EXISTS "card_attachments_update_owner" ON storage.objects;
  DROP POLICY IF EXISTS "card_attachments_delete_owner" ON storage.objects;
  
  -- TambÃ©m remover variaÃ§Ãµes antigas
  DROP POLICY IF EXISTS "Allow view attachments from accessible cards" ON storage.objects;
  DROP POLICY IF EXISTS "Allow upload attachments to accessible cards" ON storage.objects;
  DROP POLICY IF EXISTS "Allow delete own attachments" ON storage.objects;
  
  RAISE NOTICE 'âœ… Policies antigas removidas';
END $$;

-- =====================================================
-- PASSO 4: Criar policies SIMPLES e FUNCIONAIS
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'ðŸ”’ Criando policies de acesso...';
  
  -- Policy 1: SELECT (Download/Visualizar) - TODOS usuÃ¡rios autenticados
  CREATE POLICY "card_attachments_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'card_attachments'
  );
  RAISE NOTICE '  âœ… Policy SELECT criada';
  
  -- Policy 2: INSERT (Upload) - TODOS usuÃ¡rios autenticados
  CREATE POLICY "card_attachments_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'card_attachments'
  );
  RAISE NOTICE '  âœ… Policy INSERT criada';
  
  -- Policy 3: UPDATE - TODOS usuÃ¡rios autenticados (para metadata)
  CREATE POLICY "card_attachments_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'card_attachments'
  );
  RAISE NOTICE '  âœ… Policy UPDATE criada';
  
  -- Policy 4: DELETE - TODOS usuÃ¡rios autenticados podem deletar
  CREATE POLICY "card_attachments_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'card_attachments'
  );
  RAISE NOTICE '  âœ… Policy DELETE criada';
  
  RAISE NOTICE '';
  RAISE NOTICE 'âœ… Todas as policies criadas com sucesso!';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'âš ï¸ Erro ao criar policies: %', SQLERRM;
END $$;

-- =====================================================
-- PASSO 5: Verificar resultado final
-- =====================================================
DO $$
DECLARE
  policy_count INTEGER;
  bucket_rec RECORD;
  policy_rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”';
  RAISE NOTICE 'âœ… CONFIGURAÃ‡ÃƒO DO STORAGE CONCLUÃDA!';
  RAISE NOTICE 'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”';
  RAISE NOTICE '';
  
  -- Verificar se bucket existe
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'card_attachments') THEN
    RAISE NOTICE 'âœ… Bucket card_attachments: EXISTE';
    
    -- Mostrar configuraÃ§Ã£o
    SELECT file_size_limit, public INTO bucket_rec
    FROM storage.buckets 
    WHERE id = 'card_attachments';
    
    RAISE NOTICE '  ðŸ“¦ ConfiguraÃ§Ã£o:';
    RAISE NOTICE '    â€¢ Public: %', bucket_rec.public;
    RAISE NOTICE '    â€¢ Size Limit: % bytes (%.2f MB)', 
      bucket_rec.file_size_limit,
      bucket_rec.file_size_limit::float / 1024 / 1024;
  ELSE
    RAISE NOTICE 'âŒ Bucket card_attachments: NÃƒO EXISTE';
    RAISE NOTICE 'âš ï¸ AÃ‡ÃƒO NECESSÃRIA: Criar bucket manualmente no Dashboard!';
  END IF;
  
  -- Contar policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE 'card_attachments_%';
  
  RAISE NOTICE '';
  RAISE NOTICE 'âœ… Policies criadas: %', policy_count;
  
  -- Listar policies
  FOR policy_rec IN (
    SELECT policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname LIKE 'card_attachments_%'
    ORDER BY policyname
  ) LOOP
    RAISE NOTICE '  ðŸ”’ Policy: % (OperaÃ§Ã£o: %)', policy_rec.policyname, policy_rec.cmd;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'ðŸŽ¯ PrÃ³ximo passo: Testar upload no frontend!';
  RAISE NOTICE '';
  
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'âš ï¸ Tabela storage.buckets nÃ£o encontrada - usar Dashboard';
  WHEN OTHERS THEN
    RAISE NOTICE 'âš ï¸ Erro: %', SQLERRM;
END $$;

