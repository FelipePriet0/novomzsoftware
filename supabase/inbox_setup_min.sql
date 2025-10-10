create extension if not exists "pgcrypto";

do $$ begin
  if not exists (select 1 from pg_type where typname = 'inbox_notification_type') then
    create type public.inbox_notification_type as enum (
      'task_assigned',
      'task_due',
      'task_critical',
      'mention',
      'thread_reply',
      'card_linked',
      'new_ficha',
      'ficha_dispute',
      'ficha_overdue'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'inbox_priority') then
    create type public.inbox_priority as enum ('high','medium','low');
  end if;
end $$;

create table if not exists public.inbox_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.inbox_notification_type not null,
  priority public.inbox_priority not null default 'low',
  title text not null,
  body text not null,
  meta jsonb not null default '{}'::jsonb,
  task_id uuid null,
  card_id uuid null references public.kanban_cards(id) on delete set null,
  comment_id uuid null,
  link_url text null,
  transient boolean not null default false,
  expires_at timestamptz null,
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inbox_user_unread on public.inbox_notifications(user_id, read_at, priority desc, created_at desc);
create index if not exists idx_inbox_user_created on public.inbox_notifications(user_id, created_at desc);
create index if not exists idx_inbox_expires_at on public.inbox_notifications(expires_at) where transient is true;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_inbox_updated_at on public.inbox_notifications;
create trigger trg_inbox_updated_at before update on public.inbox_notifications
for each row execute function public.set_updated_at();

-- Helpers: marcar todas como lidas para um usuário
create or replace function public.inbox_mark_all_read(p_user uuid)
returns void language sql as $$
  update public.inbox_notifications set read_at = now()
  where user_id = p_user and read_at is null;
$$;

-- Helper: criar notificação (uso programático)
create or replace function public.inbox_push(
  p_user uuid,
  p_type public.inbox_notification_type,
  p_priority public.inbox_priority,
  p_title text,
  p_body text,
  p_meta jsonb default '{}'::jsonb,
  p_transient boolean default false,
  p_ttl_seconds int default null
)
returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.inbox_notifications(
    user_id, type, priority, title, body, meta, transient, expires_at
  ) values (
    p_user, p_type, p_priority, p_title, p_body, coalesce(p_meta,'{}'::jsonb), p_transient,
    case when p_ttl_seconds is not null then now() + make_interval(secs => p_ttl_seconds) else null end
  ) returning id into v_id;
  return v_id;
end $$;

