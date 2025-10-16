-- Denormalize applicant_id (FK -> public.applicants) into core tables
-- Tables: card_comments, card_tasks, card_attachments
-- Includes: add column, backfill from kanban_cards via card_id, indexes, FKs, triggers

-- 0) Helper: function to set applicant_id from card_id
CREATE OR REPLACE FUNCTION public.fn_set_applicant_by_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.applicant_id IS NULL AND NEW.card_id IS NOT NULL THEN
    SELECT kc.applicant_id INTO NEW.applicant_id
    FROM public.kanban_cards kc
    WHERE kc.id = NEW.card_id;
  END IF;

  -- If card_id changed and we allow it, refresh applicant_id
  IF TG_OP = 'UPDATE' AND NEW.card_id IS DISTINCT FROM OLD.card_id THEN
    IF NEW.card_id IS NOT NULL THEN
      SELECT kc.applicant_id INTO NEW.applicant_id
      FROM public.kanban_cards kc
      WHERE kc.id = NEW.card_id;
    ELSE
      NEW.applicant_id := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 1) card_comments
ALTER TABLE public.card_comments
  ADD COLUMN IF NOT EXISTS applicant_id uuid;

-- Backfill existing rows from kanban_cards
UPDATE public.card_comments c
SET applicant_id = kc.applicant_id
FROM public.kanban_cards kc
WHERE c.card_id = kc.id
  AND c.applicant_id IS NULL;

-- Index and FK
CREATE INDEX IF NOT EXISTS idx_card_comments_applicant_id ON public.card_comments(applicant_id);
ALTER TABLE public.card_comments
  ADD CONSTRAINT card_comments_applicant_id_fkey
  FOREIGN KEY (applicant_id) REFERENCES public.applicants(id);

-- Optional safety: ensure applicant_id present when card_id present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'card_comments_card_requires_applicant_ck'
  ) THEN
    EXECUTE 'ALTER TABLE public.card_comments ADD CONSTRAINT card_comments_card_requires_applicant_ck CHECK (card_id IS NULL OR applicant_id IS NOT NULL)';
  END IF;
END $$;

-- Trigger
DROP TRIGGER IF EXISTS trg_set_applicant_card_comments ON public.card_comments;
CREATE TRIGGER trg_set_applicant_card_comments
  BEFORE INSERT OR UPDATE ON public.card_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_applicant_by_card();

-- 2) card_tasks
ALTER TABLE public.card_tasks
  ADD COLUMN IF NOT EXISTS applicant_id uuid;

UPDATE public.card_tasks t
SET applicant_id = kc.applicant_id
FROM public.kanban_cards kc
WHERE t.card_id = kc.id
  AND t.applicant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_card_tasks_applicant_id ON public.card_tasks(applicant_id);
ALTER TABLE public.card_tasks
  ADD CONSTRAINT card_tasks_applicant_id_fkey
  FOREIGN KEY (applicant_id) REFERENCES public.applicants(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'card_tasks_card_requires_applicant_ck'
  ) THEN
    EXECUTE 'ALTER TABLE public.card_tasks ADD CONSTRAINT card_tasks_card_requires_applicant_ck CHECK (card_id IS NULL OR applicant_id IS NOT NULL)';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_set_applicant_card_tasks ON public.card_tasks;
CREATE TRIGGER trg_set_applicant_card_tasks
  BEFORE INSERT OR UPDATE ON public.card_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_applicant_by_card();

-- 3) card_attachments
ALTER TABLE public.card_attachments
  ADD COLUMN IF NOT EXISTS applicant_id uuid;

UPDATE public.card_attachments a
SET applicant_id = kc.applicant_id
FROM public.kanban_cards kc
WHERE a.card_id = kc.id
  AND a.applicant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_card_attachments_applicant_id ON public.card_attachments(applicant_id);
ALTER TABLE public.card_attachments
  ADD CONSTRAINT card_attachments_applicant_id_fkey
  FOREIGN KEY (applicant_id) REFERENCES public.applicants(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'card_attachments_card_requires_applicant_ck'
  ) THEN
    EXECUTE 'ALTER TABLE public.card_attachments ADD CONSTRAINT card_attachments_card_requires_applicant_ck CHECK (card_id IS NULL OR applicant_id IS NOT NULL)';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_set_applicant_card_attachments ON public.card_attachments;
CREATE TRIGGER trg_set_applicant_card_attachments
  BEFORE INSERT OR UPDATE ON public.card_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_applicant_by_card();

-- Note: We intentionally did not alter inbox_notifications here.
-- Later we can add applicant_id there too (either via card_id column or reading meta->>'cardId').

