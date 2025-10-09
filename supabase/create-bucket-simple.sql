-- =====================================================
-- CRIAR BUCKET card_attachments - VERSÃƒO SIMPLES
-- =====================================================

-- 1. Criar bucket (ignora se jÃ¡ existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'card_attachments',
  'card_attachments',
  false, -- Privado
  52428800 -- 50MB
)
ON CONFLICT (id) DO NOTHING;

-- 2. Remover policies antigas (se existirem)
DROP POLICY IF EXISTS "card_attachments_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "card_attachments_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "card_attachments_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "card_attachments_delete_authenticated" ON storage.objects;

-- 3. Criar policy SELECT (Download/Visualizar)
CREATE POLICY "card_attachments_select_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'card_attachments');

-- 4. Criar policy INSERT (Upload)
CREATE POLICY "card_attachments_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'card_attachments');

-- 5. Criar policy UPDATE
CREATE POLICY "card_attachments_update_authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'card_attachments');

-- 6. Criar policy DELETE
CREATE POLICY "card_attachments_delete_authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'card_attachments');

-- 7. Verificar resultado
SELECT 
  'Bucket' as tipo,
  name,
  public,
  file_size_limit
FROM storage.buckets 
WHERE id = 'card_attachments'
UNION ALL
SELECT 
  'Policy' as tipo,
  policyname as name,
  null as public,
  null as file_size_limit
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE 'card_attachments_%'
ORDER BY tipo DESC, name;

