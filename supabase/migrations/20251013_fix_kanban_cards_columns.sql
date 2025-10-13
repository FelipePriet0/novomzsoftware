-- Align kanban_cards schema with frontend expectations
-- Run this in Supabase SQL or include in migrations pipeline

-- 1) Core columns expected by UI
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reanalysis_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS comments text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

-- 2) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_kanban_cards_created_by ON public.kanban_cards(created_by);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_deleted_at ON public.kanban_cards(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kanban_cards_reanalysis_gin ON public.kanban_cards USING GIN (reanalysis_notes);

-- 3) Keep updated_at fresh on UPDATE (idempotent)
CREATE OR REPLACE FUNCTION public.update_kanban_cards_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_kanban_cards_updated_at ON public.kanban_cards;
CREATE TRIGGER trg_update_kanban_cards_updated_at
  BEFORE UPDATE ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_kanban_cards_updated_at();

-- 4) RLS: keep simple and compatible with UI
-- (The UI already filters deleted_at via .is('deleted_at', null) on queries.)
-- Ensure basic policies exist (idempotent, only create if not present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kanban_cards' AND policyname='kanban_cards_select_all'
  ) THEN
    EXECUTE 'CREATE POLICY "kanban_cards_select_all" ON public.kanban_cards FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kanban_cards' AND policyname='kanban_cards_insert_authenticated'
  ) THEN
    EXECUTE 'CREATE POLICY "kanban_cards_insert_authenticated" ON public.kanban_cards FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kanban_cards' AND policyname='kanban_cards_update_authenticated'
  ) THEN
    EXECUTE 'CREATE POLICY "kanban_cards_update_authenticated" ON public.kanban_cards FOR UPDATE USING (auth.role() = ''authenticated'')';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kanban_cards' AND policyname='kanban_cards_delete_authenticated'
  ) THEN
    EXECUTE 'CREATE POLICY "kanban_cards_delete_authenticated" ON public.kanban_cards FOR DELETE USING (auth.role() = ''authenticated'')';
  END IF;
END $$;

-- 5) Quick sanity: expose key columns (optional select to verify after running)
-- SELECT id, created_by, deleted_at, deleted_by, title, stage FROM public.kanban_cards LIMIT 5;

