-- Atualizar schema de applicants para ser a fonte-da-verdade

-- 1) Colunas de contato/endereço
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS address_line text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cep text;

-- city já existe na tabela base; manter como origem do município do endereço

-- 2) Preferências comerciais
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS plano_acesso text,
  ADD COLUMN IF NOT EXISTS venc int,
  ADD COLUMN IF NOT EXISTS carne_impresso boolean;

-- CHECK para 1..31 (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_applicants_venc_1_31'
  ) THEN
    ALTER TABLE public.applicants
      ADD CONSTRAINT chk_applicants_venc_1_31 CHECK (venc IS NULL OR (venc >= 1 AND venc <= 31));
  END IF;
END $$;

-- 3) Campos de intake/solicitação e informações
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS quem_solicitou text,
  ADD COLUMN IF NOT EXISTS telefone_solicitante text,
  ADD COLUMN IF NOT EXISTS protocolo_mk text,
  ADD COLUMN IF NOT EXISTS meio text,
  ADD COLUMN IF NOT EXISTS info_spc text,
  ADD COLUMN IF NOT EXISTS info_pesquisador text,
  ADD COLUMN IF NOT EXISTS info_relevantes text,
  ADD COLUMN IF NOT EXISTS info_mk text,
  ADD COLUMN IF NOT EXISTS parecer_analise text,
  ADD COLUMN IF NOT EXISTS sva_avulso text;

-- 4) Soft-delete/metadados adicionais
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

-- 5) Normalização e unicidade de documento (CPF/CNPJ por tipo)
-- doc_digits: apenas números do cpf_cnpj
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='applicants' AND column_name='doc_digits'
  ) THEN
    ALTER TABLE public.applicants
      ADD COLUMN doc_digits text GENERATED ALWAYS AS (regexp_replace(cpf_cnpj, '[^0-9]', '', 'g')) STORED;
  END IF;
END $$;

-- CHECK por tipo (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_applicants_doc_len_by_type'
  ) THEN
    ALTER TABLE public.applicants
      ADD CONSTRAINT chk_applicants_doc_len_by_type
      CHECK (
        doc_digits IS NULL OR (
          (person_type = 'PF' AND length(doc_digits) = 11) OR
          (person_type = 'PJ' AND length(doc_digits) = 14)
        )
      );
  END IF;
END $$;

-- UNIQUE parcial por (person_type, doc_digits) quando houver doc
CREATE UNIQUE INDEX IF NOT EXISTS uq_applicants_person_doc
  ON public.applicants(person_type, doc_digits)
  WHERE doc_digits IS NOT NULL;

-- 6) updated_at automático em updates
CREATE OR REPLACE FUNCTION public.update_applicants_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_applicants_updated_at ON public.applicants;
CREATE TRIGGER trg_update_applicants_updated_at
  BEFORE UPDATE ON public.applicants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_applicants_updated_at();

