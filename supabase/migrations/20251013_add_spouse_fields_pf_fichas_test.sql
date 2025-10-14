-- Add spouse age to PF ficha (idempotent)
ALTER TABLE public.pf_fichas_test
  ADD COLUMN IF NOT EXISTS conjuge_idade int;

