-- LIMPEZA SOMENTE DE DADOS (Supabase/Postgres)
-- Objetivo: apagar registros das tabelas de negócio e arquivos do Storage
-- sem remover configurações (schemas, RLS, functions, policies, buckets, etc.).
--
-- Como executar:
-- 1) Cole e execute no Supabase SQL Editor (recommended)
--    ou rode via CLI com: supabase db remote run < supabase/reset_data_only.sql
-- 2) Revise a lista de tabelas preservadas (seção KEEP LIST) antes de executar.

-----------------------------
-- 0) AJUSTES OPCIONAIS
-----------------------------
-- Configure quais buckets do Storage você deseja limpar.
-- Por padrão, limpo TODOS os objetos (arquivos) de TODOS os buckets
-- sem apagar buckets nem policies. Se preferir, restrinja por bucket_id.

-- Exemplo: só limpar anexos dos módulos
--   WHERE bucket_id IN ('card-attachments','channel-attachments')

-----------------------------
-- 1) LISTA DE TABELAS A PRESERVAR (não serão truncadas)
-----------------------------
-- Ajuste esta lista conforme a sua necessidade.
-- Geralmente, mantemos usuários/perfis e catálogos de configuração.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='pg_temp' AND tablename='keep_tables') THEN
    CREATE TEMP TABLE keep_tables(name text primary key);
  END IF;
END $$;

-- Itens comuns considerados "configuração" (ajuste à vontade)
TRUNCATE TABLE pg_temp.keep_tables;
INSERT INTO pg_temp.keep_tables(name) VALUES
  ('profiles'),           -- perfis de usuários (mapeiam auth.users)
  ('companies'),          -- empresas/organizações
  ('plans');              -- catálogo de planos

-- Caso deseje preservar o canal do sistema, descomente a linha abaixo:
-- INSERT INTO pg_temp.keep_tables(name) VALUES ('channels');

-----------------------------
-- 2) PRÉVIA: LISTAR TABELAS QUE SERÃO LIMPAS
-----------------------------
-- Só para conferência antes de truncar.
-- Execute esta SELECT isoladamente se quiser ver a lista.
-- SELECT 'public.'||quote_ident(tablename) AS will_truncate
-- FROM   pg_tables
-- WHERE  schemaname='public'
--   AND tablename NOT IN (SELECT name FROM pg_temp.keep_tables)
-- ORDER BY 1;

-----------------------------
-- 3) TRUNCAR DADOS DAS TABELAS (mantendo estrutura e RLS)
-----------------------------
DO $$
DECLARE
  sql text;
BEGIN
  -- Monta TRUNCATE dinâmico para todas as tabelas do schema public,
  -- exceto as explicitamente preservadas em keep_tables.
  SELECT 'TRUNCATE TABLE '
         || string_agg('public.'||quote_ident(tablename), ', ')
         || ' RESTART IDENTITY CASCADE;'
    INTO sql
  FROM pg_tables
  WHERE schemaname='public'
    AND tablename NOT IN (SELECT name FROM pg_temp.keep_tables);

  IF sql IS NOT NULL THEN
    RAISE NOTICE 'Executando: %', sql;
    EXECUTE sql;
  ELSE
    RAISE NOTICE 'Nenhuma tabela elegível para TRUNCATE.';
  END IF;
END $$;

-----------------------------
-- 4) LIMPAR ARQUIVOS DO STORAGE (mantendo buckets e policies)
-----------------------------
-- Opção A: Limpar TODOS os arquivos de TODOS os buckets
DELETE FROM storage.objects;

-- Opção B: Limpar APENAS buckets específicos (descomente e ajuste)
-- DELETE FROM storage.objects WHERE bucket_id IN ('card-attachments','channel-attachments');

-----------------------------
-- 5) RELATÓRIO RÁPIDO PÓS-LIMPEZA
-----------------------------
-- Quantidade de arquivos remanescentes no Storage
SELECT 'storage.objects restantes' AS what, COUNT(*) AS total FROM storage.objects;

-- Tabelas preservadas (para confirmação)
SELECT 'preserved_table' AS what, name FROM pg_temp.keep_tables ORDER BY name;

-- Observação: este script não altera schemas, roles, policies, triggers, functions
-- nem buckets do Storage. Apenas remove dados (linhas) das tabelas e arquivos do Storage.

