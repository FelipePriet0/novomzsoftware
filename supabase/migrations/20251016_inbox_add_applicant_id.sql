-- Add applicant_id to inbox_notifications and auto-populate

ALTER TABLE public.inbox_notifications
  ADD COLUMN IF NOT EXISTS applicant_id uuid;

-- Backfill from meta.cardId when possible
UPDATE public.inbox_notifications i
SET applicant_id = kc.applicant_id
FROM public.kanban_cards kc
WHERE i.applicant_id IS NULL
  AND (i.meta ->> 'cardId') IS NOT NULL
  AND ((i.meta ->> 'cardId')::uuid) = kc.id;

-- FK and index
CREATE INDEX IF NOT EXISTS idx_inbox_notifications_applicant_id
  ON public.inbox_notifications(applicant_id);

ALTER TABLE public.inbox_notifications
  ADD CONSTRAINT inbox_notifications_applicant_id_fkey
  FOREIGN KEY (applicant_id) REFERENCES public.applicants(id);

-- Helper function: set applicant_id from meta or card
CREATE OR REPLACE FUNCTION public.fn_inbox_set_applicant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta_card uuid;
  v_meta_applicant uuid;
BEGIN
  -- If already provided, keep it
  IF NEW.applicant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Try meta.applicantId first
  IF NEW.meta ? 'applicantId' THEN
    BEGIN
      v_meta_applicant := (NEW.meta ->> 'applicantId')::uuid;
      NEW.applicant_id := v_meta_applicant;
      RETURN NEW;
    EXCEPTION WHEN others THEN
      -- fall through
    END;
  END IF;

  -- Try meta.cardId -> kanban_cards.applicant_id
  IF NEW.meta ? 'cardId' THEN
    BEGIN
      v_meta_card := (NEW.meta ->> 'cardId')::uuid;
      SELECT kc.applicant_id INTO NEW.applicant_id
      FROM public.kanban_cards kc
      WHERE kc.id = v_meta_card;
      RETURN NEW;
    EXCEPTION WHEN others THEN
      -- leave null
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inbox_set_applicant ON public.inbox_notifications;
CREATE TRIGGER trg_inbox_set_applicant
  BEFORE INSERT OR UPDATE ON public.inbox_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_inbox_set_applicant();

