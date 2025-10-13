-- Canal de Avisos — Setup Backend (Supabase)
-- Rode este arquivo por blocos (ou inteiro) no SQL editor do Supabase.
-- OBS: Não copie blocos Markdown (```); aqui é SQL puro.

-- 1) Extensões e Tipos
create extension if not exists "pgcrypto";

do $$ begin
  if not exists (select 1 from pg_type where typname = 'channel_reaction_type') then
    create type public.channel_reaction_type as enum ('like','seen','important');
  end if;
end $$;

-- 2) Tabelas
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_-]+$'),
  name text not null,
  is_system boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  body text not null,
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.channel_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction public.channel_reaction_type not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, reaction)
);

create table if not exists public.channel_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.channel_messages(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

-- 3) Índices
create index if not exists idx_channel_messages_channel_created_at on public.channel_messages(channel_id, created_at desc);
create index if not exists idx_channel_messages_author on public.channel_messages(author_id);
create index if not exists idx_channel_reactions_message on public.channel_reactions(message_id);
create index if not exists idx_channel_attachments_message on public.channel_attachments(message_id);

-- 4) Trigger updated_at
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_channels_updated_at on public.channels;
create trigger trg_channels_updated_at before update on public.channels
for each row execute function public.set_updated_at();

drop trigger if exists trg_channel_messages_updated_at on public.channel_messages;
create trigger trg_channel_messages_updated_at before update on public.channel_messages
for each row execute function public.set_updated_at();

-- 5) Seed do canal #avisos
insert into public.channels (slug, name, is_system)
values ('avisos','Canal de Avisos', true)
on conflict (slug) do nothing;

-- 6) RLS (políticas simples)
alter table public.channels enable row level security;
alter table public.channel_messages enable row level security;
alter table public.channel_reactions enable row level security;
alter table public.channel_attachments enable row level security;

-- CHANNELS
drop policy if exists channels_select on public.channels;
create policy channels_select on public.channels
  for select using (auth.role() = 'authenticated');

drop policy if exists channels_insert on public.channels;
create policy channels_insert on public.channels
  for insert with check (
    auth.role() = 'authenticated'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

drop policy if exists channels_update on public.channels;
create policy channels_update on public.channels
  for update using (
    auth.role() = 'authenticated'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

drop policy if exists channels_delete on public.channels;
create policy channels_delete on public.channels
  for delete using (
    auth.role() = 'authenticated'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

-- CHANNEL_MESSAGES
drop policy if exists channel_messages_select on public.channel_messages;
create policy channel_messages_select on public.channel_messages
  for select using (auth.role() = 'authenticated');

drop policy if exists channel_messages_insert on public.channel_messages;
create policy channel_messages_insert on public.channel_messages
  for insert with check (
    auth.role() = 'authenticated'
    and author_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

drop policy if exists channel_messages_update on public.channel_messages;
create policy channel_messages_update on public.channel_messages
  for update using (
    auth.role() = 'authenticated'
    and (
      author_id = auth.uid()
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor')
    )
  );

drop policy if exists channel_messages_delete on public.channel_messages;
create policy channel_messages_delete on public.channel_messages
  for delete using (
    auth.role() = 'authenticated'
    and (
      author_id = auth.uid()
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor')
    )
  );

-- CHANNEL_REACTIONS
drop policy if exists channel_reactions_select on public.channel_reactions;
create policy channel_reactions_select on public.channel_reactions
  for select using (auth.role() = 'authenticated');

drop policy if exists channel_reactions_insert on public.channel_reactions;
create policy channel_reactions_insert on public.channel_reactions
  for insert with check (auth.role() = 'authenticated' and user_id = auth.uid());

drop policy if exists channel_reactions_delete on public.channel_reactions;
create policy channel_reactions_delete on public.channel_reactions
  for delete using (
    auth.role() = 'authenticated'
    and (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor'))
  );

-- CHANNEL_ATTACHMENTS
drop policy if exists channel_attachments_select on public.channel_attachments;
create policy channel_attachments_select on public.channel_attachments
  for select using (auth.role() = 'authenticated');

drop policy if exists channel_attachments_insert on public.channel_attachments;
create policy channel_attachments_insert on public.channel_attachments
  for insert with check (
    auth.role() = 'authenticated' and exists (
      select 1
      from public.channel_messages m
      where m.id = message_id
        and (m.author_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor'))
    )
  );

drop policy if exists channel_attachments_delete on public.channel_attachments;
create policy channel_attachments_delete on public.channel_attachments
  for delete using (
    auth.role() = 'authenticated' and exists (
      select 1
      from public.channel_messages m
      where m.id = message_id
        and (m.author_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor'))
    )
  );

-- 7) Storage: bucket + policies
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'channel-attachments') then
    perform storage.create_bucket('channel-attachments', false);
  end if;
end $$;

drop policy if exists "channel-attachments-read" on storage.objects;
create policy "channel-attachments-read"
  on storage.objects for select
  using (bucket_id = 'channel-attachments' and auth.role() = 'authenticated');

drop policy if exists "channel-attachments-insert" on storage.objects;
create policy "channel-attachments-insert"
  on storage.objects for insert
  with check (bucket_id = 'channel-attachments' and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor'
  ));

drop policy if exists "channel-attachments-update" on storage.objects;
create policy "channel-attachments-update"
  on storage.objects for update
  using (bucket_id = 'channel-attachments' and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor'
  ));

drop policy if exists "channel-attachments-delete" on storage.objects;
create policy "channel-attachments-delete"
  on storage.objects for delete
  using (bucket_id = 'channel-attachments' and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor'
  ));

-- 8) Verificações rápidas (opcionais)
-- select id, slug, name from public.channels where slug='avisos';
-- select tablename, policyname from pg_policies where schemaname='public' and tablename like 'channel%';

-- 9) Rollback (manual, se precisar)
-- drop table if exists public.channel_attachments cascade;
-- drop table if exists public.channel_reactions cascade;
-- drop table if exists public.channel_messages cascade;
-- drop table if exists public.channels cascade;
-- drop type if exists public.channel_reaction_type;
-- drop policy if exists "channel-attachments-read" on storage.objects;
-- drop policy if exists "channel-attachments-insert" on storage.objects;
-- drop policy if exists "channel-attachments-update" on storage.objects;
-- drop policy if exists "channel-attachments-delete" on storage.objects;
-- select storage.delete_bucket('channel-attachments');

