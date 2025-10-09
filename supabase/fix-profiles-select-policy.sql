﻿-- =====================================================
-- FIX: Liberar SELECT em profiles para TODOS usuÃ¡rios
-- =====================================================
-- OBJETIVO: Permitir que todos os colaboradores vejam 
-- a lista completa de usuÃ¡rios (necessÃ¡rio para o modal
-- de criar tarefas e mencionar colaboradores)
-- =====================================================

-- 1. Remover a policy restritiva atual
DROP POLICY IF EXISTS "profiles_select_self_or_gestor" ON public.profiles;

-- 2. Criar nova policy que permite TODOS verem TODOS
CREATE POLICY "profiles_select_all_authenticated" 
ON public.profiles
FOR SELECT 
TO authenticated
USING (true);

-- =====================================================
-- RESULTADO ESPERADO:
-- - Vendedores podem ver todos os colaboradores âœ…
-- - Analistas podem ver todos os colaboradores âœ…
-- - Gestores podem ver todos os colaboradores âœ…
-- =====================================================

