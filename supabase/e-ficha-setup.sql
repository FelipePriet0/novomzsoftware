-- E-FICHA: Setup de colunas e trigger para integração PF/PJ
-- Ordem: PJ (Applicants/pj_fichas_test) -> PF (pf_fichas_test) -> Applicants (source/status)
-- Observação: todos os ALTERs são idempotentes (IF NOT EXISTS)

-- =============================
-- PJ: Campos Gerais (Applicants)
-- =============================

-- Razão Social -> applicants.primary_name
ALTER TABLE IF EXISTS public.applicants
  ADD COLUMN IF NOT EXISTS primary_name text;

-- CNPJ (com máscara na UI) -> applicants.cpf_cnpj
ALTER TABLE IF EXISTS public.applicants
  ADD COLUMN IF NOT EXISTS cpf_cnpj text;

-- Endereço (Applicants)
ALTER TABLE IF EXISTS public.applicants
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS address_line text,
  ADD COLUMN IF NOT EXISTS adress_number text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS address_complement text;

-- Contatos (Applicants)
ALTER TABLE IF EXISTS public.applicants
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS email text;

-- Plano e vencimento (Applicants)
ALTER TABLE IF EXISTS public.applicants
  ADD COLUMN IF NOT EXISTS plano_acesso text,
  ADD COLUMN IF NOT EXISTS venc smallint;

-- =============================
-- PJ: Campos específicos (pj_fichas_test)
-- =============================

ALTER TABLE IF EXISTS public.pj_fichas_test
  ADD COLUMN IF NOT EXISTS data_abertura date,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS nome_fachada text,
  ADD COLUMN IF NOT EXISTS area_atuacao text;

-- Detalhes do Local
ALTER TABLE IF EXISTS public.pj_fichas_test
  ADD COLUMN IF NOT EXISTS tipo_imovel text,
  ADD COLUMN IF NOT EXISTS tempo_endereco text,
  ADD COLUMN IF NOT EXISTS tipo_estabelecimento text,
  ADD COLUMN IF NOT EXISTS obs_estabelecimento text;

-- Internet Atual
ALTER TABLE IF EXISTS public.pj_fichas_test
  ADD COLUMN IF NOT EXISTS possui_internet boolean,
  ADD COLUMN IF NOT EXISTS operadora_internet text,
  ADD COLUMN IF NOT EXISTS plano_internet text,
  ADD COLUMN IF NOT EXISTS valor_internet numeric(12,2);

-- Sócios (1 a 3)
ALTER TABLE IF EXISTS public.pj_fichas_test
  ADD COLUMN IF NOT EXISTS socio1_nome text,
  ADD COLUMN IF NOT EXISTS socio1_cpf text,
  ADD COLUMN IF NOT EXISTS socio1_telefone text,
  ADD COLUMN IF NOT EXISTS socio2_nome text,
  ADD COLUMN IF NOT EXISTS socio2_cpf text,
  ADD COLUMN IF NOT EXISTS socio2_telefone text,
  ADD COLUMN IF NOT EXISTS socio3_nome text,
  ADD COLUMN IF NOT EXISTS socio3_cpf text,
  ADD COLUMN IF NOT EXISTS socio3_telefone text;

-- =============================
-- PF: Campos específicos (pf_fichas_test)
-- =============================

ALTER TABLE IF EXISTS public.pf_fichas_test
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS naturalidade text,
  ADD COLUMN IF NOT EXISTS uf_naturalidade text;

-- =============================
-- Applicants: origem/estado e trigger de status
-- =============================

-- Coluna source (manual | e_ficha) e status textual
ALTER TABLE IF EXISTS public.applicants
  ADD COLUMN IF NOT EXISTS source text;

-- Garantir valores válidos e default em source
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'applicants' AND column_name = 'source'
  ) THEN
    -- Define default 'manual' se ainda não existir
    EXECUTE 'ALTER TABLE public.applicants ALTER COLUMN source SET DEFAULT ''manual''';
  END IF;
END $$;

-- Opcional: coluna status para leitura do Kanban
ALTER TABLE IF EXISTS public.applicants
  ADD COLUMN IF NOT EXISTS status text;

-- Função + Trigger: se source = 'e_ficha' e status vazio, setar 'Entrada'
CREATE OR REPLACE FUNCTION public.applicants_set_status_entrada()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source = 'e_ficha' AND (NEW.status IS NULL OR btrim(COALESCE(NEW.status, '')) = '') THEN
    NEW.status := 'Entrada';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_applicants_status ON public.applicants;
CREATE TRIGGER trg_applicants_status
BEFORE INSERT ON public.applicants
FOR EACH ROW
EXECUTE FUNCTION public.applicants_set_status_entrada();

-- =============================
-- Extras úteis (opcionais, seguros de rodar)
-- =============================

-- Campo meta para auditoria (payload bruto da e-ficha)
ALTER TABLE IF EXISTS public.applicants
  ADD COLUMN IF NOT EXISTS meta jsonb;

-- Índices leves (busca por email/telefone); não únicos para evitar conflitos não planejados
CREATE INDEX IF NOT EXISTS ix_applicants_email ON public.applicants (lower(email));
CREATE INDEX IF NOT EXISTS ix_applicants_phone ON public.applicants (phone);

-- FIM

