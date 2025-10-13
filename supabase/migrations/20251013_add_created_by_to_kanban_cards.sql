-- Add created_by to kanban_cards and keep it idempotent

-- 1) Add column if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='kanban_cards' AND column_name='created_by'
  ) THEN
    ALTER TABLE public.kanban_cards ADD COLUMN created_by uuid;
  END IF;
END $$;

-- 2) Add FK constraint (safe/idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kanban_cards_created_by_fkey'
  ) THEN
    ALTER TABLE public.kanban_cards
    ADD CONSTRAINT kanban_cards_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Index for filtering by creator
CREATE INDEX IF NOT EXISTS idx_kanban_cards_created_by ON public.kanban_cards(created_by);

-- 4) Defaulting trigger: set created_by = auth.uid() when null on insert
CREATE OR REPLACE FUNCTION public.set_kanban_card_creator()
RETURNS trigger AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists only once
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_set_kanban_card_creator'
  ) THEN
    CREATE TRIGGER trg_set_kanban_card_creator
      BEFORE INSERT ON public.kanban_cards
      FOR EACH ROW
      EXECUTE FUNCTION public.set_kanban_card_creator();
  END IF;
END $$;

-- 5) Best-effort backfill for existing rows using earliest comment author
--    (if available), otherwise leaves null to avoid guessing.
WITH first_comment AS (
  SELECT
    c.card_id,
    (ARRAY_AGG(c.author_id ORDER BY c.created_at ASC))[1] AS first_author
  FROM public.card_comments c
  GROUP BY c.card_id
)
UPDATE public.kanban_cards kc
SET created_by = fc.first_author
FROM first_comment fc
WHERE kc.id = fc.card_id
  AND kc.created_by IS NULL;

-- Keep RLS unchanged; this column is informational and for filtering/joins.
-- Frontend relies on join: creator:created_by ( id, full_name )

