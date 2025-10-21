-- Thread reply notifications (WhatsApp-style) for card_comments
-- - No new tables; uses public.inbox_notifications
-- - Trigger on card_comments inserts with parent_id not null
-- - SECURITY DEFINER function inserts notifications for all participants
-- - Dedup via partial unique index (one notif per user per reply)

-- Helpful indexes for participants lookup
CREATE INDEX IF NOT EXISTS idx_card_comments_thread_id
  ON public.card_comments(thread_id);

CREATE INDEX IF NOT EXISTS idx_card_comments_parent_id
  ON public.card_comments(parent_id);

-- Unique per-user per reply for thread_reply notifications
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_thread_reply_unique
  ON public.inbox_notifications ((meta->>'commentId'), user_id)
  WHERE type = 'thread_reply';

-- Function: notify participants on thread reply
CREATE OR REPLACE FUNCTION public.fn_notify_thread_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id uuid;
  v_card_id uuid;
  v_applicant_id uuid;
  v_actor_id uuid;
  v_actor_name text;
  v_parent_id uuid;
  v_parent_author uuid;
  v_card_title text;
  v_snippet text;
  v_user_id uuid;
BEGIN
  -- Safety: only handle replies
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_thread_id := NEW.thread_id;
  v_card_id := NEW.card_id;
  v_actor_id := NEW.author_id;
  v_parent_id := NEW.parent_id;
  v_applicant_id := NEW.applicant_id;

  -- Resolve actor name (fallback)
  SELECT COALESCE(p.full_name, 'Colaborador') INTO v_actor_name
  FROM public.profiles p
  WHERE p.id = v_actor_id;

  -- Resolve card title from applicants via applicants (prefer NEW.applicant_id; fallback via kanban_cards)
  IF v_applicant_id IS NOT NULL THEN
    SELECT COALESCE(a.primary_name, 'Cliente') INTO v_card_title
    FROM public.applicants a
    WHERE a.id = v_applicant_id;
  ELSE
    SELECT COALESCE(a.primary_name, 'Cliente') INTO v_card_title
    FROM public.kanban_cards kc
    LEFT JOIN public.applicants a ON a.id = kc.applicant_id
    WHERE kc.id = v_card_id;
  END IF;

  -- Snippet of reply (compress whitespace, limit length)
  v_snippet := regexp_replace(substr(COALESCE(NEW.content, ''), 1, 120), '\\s+', ' ', 'g');

  -- Parent comment author (reply target) if not deleted
  SELECT c.author_id INTO v_parent_author
  FROM public.card_comments c
  WHERE c.id = v_parent_id
    AND c.deleted_at IS NULL;

  -- Notify all participants in this thread (distinct authors with active comments), excluding actor
  FOR v_user_id IN
    SELECT DISTINCT c.author_id
    FROM public.card_comments c
    WHERE c.thread_id = v_thread_id
      AND c.deleted_at IS NULL
      AND c.author_id IS NOT NULL
      AND c.author_id <> v_actor_id
  LOOP
    -- Build meta json
    -- Distinguish target of reply vs other participants
    IF v_parent_author IS NOT NULL AND v_user_id = v_parent_author THEN
      -- Special body for the replied user
      INSERT INTO public.inbox_notifications (
        user_id, type, priority, title, body, meta, transient, applicant_id
      ) VALUES (
        v_user_id,
        'thread_reply',
        'low',
        format('%s respondeu a você', v_actor_name),
        -- body: "Respondeu você — {cardTitle}\n{snippet}"
        format('Respondeu você — %s\n%s', v_card_title, v_snippet),
        jsonb_build_object(
          'cardId', v_card_id,
          'threadId', v_thread_id,
          'commentId', NEW.id,
          'parentCommentId', v_parent_id,
          'actorId', v_actor_id,
          'kind', 'reply_target'
        ),
        false,
        v_applicant_id
      )
      ON CONFLICT DO NOTHING;
    ELSE
      -- Body for other participants
      INSERT INTO public.inbox_notifications (
        user_id, type, priority, title, body, meta, transient, applicant_id
      ) VALUES (
        v_user_id,
        'thread_reply',
        'low',
        v_actor_name,
        -- body: "{cardTitle}\n{snippet}"
        format('%s\n%s', v_card_title, v_snippet),
        jsonb_build_object(
          'cardId', v_card_id,
          'threadId', v_thread_id,
          'commentId', NEW.id,
          'parentCommentId', v_parent_id,
          'actorId', v_actor_id,
          'kind', 'thread_participant'
        ),
        false,
        v_applicant_id
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_notify_thread_reply IS 'Creates thread_reply notifications for all participants on reply (WhatsApp-style titles/bodies).';

-- Trigger: after insert on replies
DROP TRIGGER IF EXISTS trg_thread_reply_notify ON public.card_comments;
CREATE TRIGGER trg_thread_reply_notify
  AFTER INSERT ON public.card_comments
  FOR EACH ROW
  WHEN (NEW.parent_id IS NOT NULL)
  EXECUTE FUNCTION public.fn_notify_thread_reply();

-- RLS Note:
-- This function runs as SECURITY DEFINER (owner: postgres), which bypasses RLS in Supabase.
-- No policy changes required for clients. Keep RLS enabled for inbox_notifications.
