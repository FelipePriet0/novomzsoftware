# Canal de Avisos — Setup Backend (Supabase)

Este documento contém as queries SQL para criar o backend do canal de avisos (#Avisos): tabelas, constraints, índices, RLS e Storage. Rode em ordem. Se algo falhar, copie o erro de volta aqui para ajustarmos.

Assumptions
- Tabela `public.profiles(id, role, full_name)` existe e `role` usa valores: `gestor`, `analista`, `vendedor`.
- RLS ativo no projeto. Vamos criar policies simples (todos autenticados leem; publicar somente gestores).

---

## 1) Extensões e Tipos
```sql
-- UUIDs (se ainda não estiver ativo)
create extension if not exists "pgcrypto";

-- Enum para reações
do $$ begin
  if not exists (select 1 from pg_type where typname = 'channel_reaction_type') then
    create type public.channel_reaction_type as enum ('like','seen','important');
  end if;
end $$;
```

Verificação:
```sql
select typname from pg_type where typname = 'channel_reaction_type';
```

---

## 2) Tabelas
```sql
-- Canal (ex.: slug = 'avisos')
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_-]+$'),
  name text not null,
  is_system boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mensagens publicadas (avisos)
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

-- Reações (👍, 👀, ❗)
create table if not exists public.channel_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.channel_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction public.channel_reaction_type not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, reaction)
);

-- Metadados de anexos (arquivo fica no Storage)
create table if not exists public.channel_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.channel_messages(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);
```

Verificação:
```sql
select table_name from information_schema.tables where table_schema='public' and table_name in (
  'channels','channel_messages','channel_reactions','channel_attachments'
);
```

---

## 3) Índices
```sql
create index if not exists idx_channel_messages_channel_created_at on public.channel_messages(channel_id, created_at desc);
create index if not exists idx_channel_messages_author on public.channel_messages(author_id);
create index if not exists idx_channel_reactions_message on public.channel_reactions(message_id);
create index if not exists idx_channel_attachments_message on public.channel_attachments(message_id);
```

Verificação:
```sql
select indexname from pg_indexes where schemaname='public' and indexname like 'idx_channel_%';
```

---

## 4) Triggers (updated_at)
```sql
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
```

Verificação:
```sql
select tgname, tgrelid::regclass from pg_trigger where tgname like 'trg_channel%';
```

---

## 5) Seed do Canal #Avisos
```sql
insert into public.channels (slug, name, is_system)
values ('avisos','Canal de Avisos', true)
on conflict (slug) do nothing;
```

Verificação:
```sql
select id, slug, name from public.channels where slug='avisos';
```

---

## 6) RLS (Row Level Security)
Habilita RLS e cria policies simples. Leitura para autenticados; publicar/gerenciar apenas gestores.

```sql
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

-- MESSAGES
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

-- REACTIONS
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

-- ATTACHMENTS
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
```

Verificação:
```sql
select tablename, policyname, cmd from pg_policies where schemaname='public' and tablename in (
  'channels','channel_messages','channel_reactions','channel_attachments'
) order by tablename, policyname;
```

---

## 7) Storage (Bucket para anexos do canal)
```sql
-- Cria bucket privado (se não existir)
select storage.create_bucket('channel-attachments', public => false);

-- Policies de leitura/escrita simples
create policy if not exists "channel-attachments-read"
  on storage.objects for select
  using (bucket_id = 'channel-attachments' and auth.role() = 'authenticated');

create policy if not exists "channel-attachments-insert"
  on storage.objects for insert
  with check (bucket_id = 'channel-attachments' and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor'
  ));

create policy if not exists "channel-attachments-update"
  on storage.objects for update
  using (bucket_id = 'channel-attachments' and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor'
  ));

create policy if not exists "channel-attachments-delete"
  on storage.objects for delete
  using (bucket_id = 'channel-attachments' and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor'
  ));
```

Verificação:
```sql
select id, name from storage.buckets where id='channel-attachments';
```

---

## 8) Consultas de Verificação (end‑to‑end)
```sql
-- Canal avisos
select id, slug, name from public.channels where slug='avisos';

-- Policies ativas
select tablename, policyname from pg_policies where schemaname='public' and tablename like 'channel%';
```

---

## 9) Rollback (se precisar voltar)
```sql
-- Remover dependências em ordem segura
alter table if exists public.channel_attachments disable trigger all;
alter table if exists public.channel_reactions disable trigger all;
alter table if exists public.channel_messages disable trigger all;
alter table if exists public.channels disable trigger all;

drop table if exists public.channel_attachments cascade;
drop table if exists public.channel_reactions cascade;
drop table if exists public.channel_messages cascade;
drop table if exists public.channels cascade;

-- Opcional: remover enum (apenas se tiver certeza de que nada mais usa)
-- drop type if exists public.channel_reaction_type;

-- Opcional: remover policies do storage
-- drop policy if exists "channel-attachments-read" on storage.objects;
-- drop policy if exists "channel-attachments-insert" on storage.objects;
-- drop policy if exists "channel-attachments-update" on storage.objects;
-- drop policy if exists "channel-attachments-delete" on storage.objects;
-- select storage.delete_bucket('channel-attachments');
```

---

## 10) Integração (nota rápida)
- Buscar `channel_id` do slug `'avisos'` e usar nas consultas do feed.
- Publicar aviso:
  1) Upload de arquivo(s) no bucket `channel-attachments` (path sugerido: `avisos/<messageId>/<file>`).
  2) Insert em `channel_messages` (title, body, links, author_id=auth.uid(), channel_id).
  3) Insert em `channel_attachments` (message_id, file_name, storage_path, mime_type, file_size).
- Reações: upsert em `channel_reactions` (ou `insert` seguido de `delete` para toggle).

> Rode os blocos em ordem e, se algum falhar, cole aqui o trecho falho e o erro exibido para ajustarmos.

