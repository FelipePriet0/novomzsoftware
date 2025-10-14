-- Remove colunas uf e city de applicants
-- Esses campos são específicos de PF e devem estar apenas em pf_fichas_test
-- (naturalidade = city, uf_naturalidade = uf)

-- Verificar se existem dados antes de remover (backup seguro)
DO $$
BEGIN
  -- Verificar se há dados em uf ou city que precisam ser migrados
  IF EXISTS (
    SELECT 1 FROM applicants 
    WHERE (uf IS NOT NULL OR city IS NOT NULL) 
    AND person_type = 'PF'
    LIMIT 1
  ) THEN
    RAISE NOTICE 'AVISO: Existem dados em applicants.uf ou applicants.city que serão removidos';
    RAISE NOTICE 'Esses dados devem estar em pf_fichas_test (naturalidade, uf_naturalidade)';
  END IF;
END $$;

-- Remover colunas (apenas para PF - PJ não usa essas colunas)
ALTER TABLE public.applicants DROP COLUMN IF EXISTS uf;
ALTER TABLE public.applicants DROP COLUMN IF EXISTS city;

-- Adicionar comentário na tabela
COMMENT ON TABLE public.applicants IS 'Dados básicos universais (PF e PJ). Dados específicos de PF ficam em pf_fichas_test';

