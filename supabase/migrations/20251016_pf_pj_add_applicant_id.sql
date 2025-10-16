-- Add applicant_id to PF/PJ fichas with FK, index and unique per applicant

-- PF: applicant_id column
ALTER TABLE public.pf_fichas_test
  ADD COLUMN IF NOT EXISTS applicant_id uuid;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_pf_fichas_test_applicant_id
  ON public.pf_fichas_test(applicant_id);

-- FK (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pf_fichas_test_applicant_id_fkey'
  ) THEN
    ALTER TABLE public.pf_fichas_test
      ADD CONSTRAINT pf_fichas_test_applicant_id_fkey
      FOREIGN KEY (applicant_id) REFERENCES public.applicants(id);
  END IF;
END $$;

-- Unique per applicant (one PF ficha per applicant)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pf_fichas_test_applicant_id_key'
  ) THEN
    ALTER TABLE public.pf_fichas_test
      ADD CONSTRAINT pf_fichas_test_applicant_id_key UNIQUE (applicant_id);
  END IF;
END $$;

-- PJ: applicant_id column
ALTER TABLE public.pj_fichas_test
  ADD COLUMN IF NOT EXISTS applicant_id uuid;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_pj_fichas_test_applicant_id
  ON public.pj_fichas_test(applicant_id);

-- FK (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pj_fichas_test_applicant_id_fkey'
  ) THEN
    ALTER TABLE public.pj_fichas_test
      ADD CONSTRAINT pj_fichas_test_applicant_id_fkey
      FOREIGN KEY (applicant_id) REFERENCES public.applicants(id);
  END IF;
END $$;

-- Unique per applicant (one PJ ficha per applicant)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pj_fichas_test_applicant_id_key'
  ) THEN
    ALTER TABLE public.pj_fichas_test
      ADD CONSTRAINT pj_fichas_test_applicant_id_key UNIQUE (applicant_id);
  END IF;
END $$;

