-- supabase/migrations/0001_agora_schema.sql
--
-- Agora lives in its own schema so it can share a Supabase project with EventSplit without ever
-- touching public.events or its grants. Nothing here references the public schema.
--
-- Posture from the first migration: RLS enabled, zero policies, no grants to anon. Every read and
-- write goes through the SECURITY DEFINER RPCs added in 0002.

create schema if not exists agora;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'proposal_status') then
    create type agora.proposal_status as enum
      ('open', 'approved', 'rejected', 'debating', 'completed', 'closed');
  end if;
  if not exists (select 1 from pg_type where typname = 'vote_value') then
    create type agora.vote_value as enum ('up', 'down', 'abstain');
  end if;
  if not exists (select 1 from pg_type where typname = 'link_kind') then
    create type agora.link_kind as enum ('related', 'supersedes');
  end if;
end $$;

create table if not exists agora.groups (
  id         uuid primary key default gen_random_uuid(),
  slug       varchar(8)  not null unique,
  name       varchar(80) not null,
  created_at timestamptz not null default now()
);

create table if not exists agora.participants (
  id                uuid        primary key default gen_random_uuid(),
  group_id          uuid        not null references agora.groups(id) on delete cascade,
  name              varchar(40) not null,
  device_token_hash text        not null,
  pin_hash          text,
  created_at        timestamptz not null default now()
);
-- Names identify people, so they are unique per agora whatever the casing.
create unique index if not exists participants_name_idx
  on agora.participants (group_id, lower(name));

create table if not exists agora.proposals (
  id              uuid         primary key default gen_random_uuid(),
  group_id        uuid         not null references agora.groups(id) on delete cascade,
  created_by      uuid         not null references agora.participants(id) on delete restrict,
  title           varchar(120) not null check (char_length(btrim(title)) between 3 and 120),
  description     text         not null default '' check (char_length(description) <= 20000),
  status          agora.proposal_status not null default 'open',
  round           int          not null default 1 check (round >= 1),
  deadline        timestamptz,
  closed_reason   text         check (closed_reason is null or char_length(btrim(closed_reason)) >= 10),
  estimated_cents int          check (estimated_cents is null or estimated_cents between 0 and 99999999),
  actual_cents    int          check (actual_cents is null or actual_cents between 0 and 99999999),
  completed_at    timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);
create index if not exists proposals_group_idx on agora.proposals (group_id, status, created_at);

create table if not exists agora.proposal_tags (
  proposal_id uuid        not null references agora.proposals(id) on delete cascade,
  tag         varchar(24) not null,
  primary key (proposal_id, tag)
);

create table if not exists agora.proposal_links (
  from_id uuid not null references agora.proposals(id) on delete cascade,
  to_id   uuid not null references agora.proposals(id) on delete cascade,
  kind    agora.link_kind not null,
  primary key (from_id, to_id, kind),
  check (from_id <> to_id)
);

-- Criterion 5 lives here: one vote per participant, proposal and round, enforced by the database
-- and not by the UI. Reopening a tie bumps the round and keeps the old votes readable.
create table if not exists agora.votes (
  id             uuid        primary key default gen_random_uuid(),
  proposal_id    uuid        not null references agora.proposals(id) on delete cascade,
  participant_id uuid        not null references agora.participants(id) on delete cascade,
  round          int         not null,
  value          agora.vote_value not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (proposal_id, participant_id, round)
);
create index if not exists votes_proposal_idx on agora.votes (proposal_id, round);

-- Threads and comments carry the id the client generated (uuidv7), so replaying a queued action
-- after being offline inserts nothing twice.
create table if not exists agora.comment_threads (
  id          uuid primary key,
  proposal_id uuid not null references agora.proposals(id) on delete cascade,
  author_id   uuid not null references agora.participants(id) on delete restrict,
  resolved_at timestamptz,
  resolved_by uuid references agora.participants(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists threads_proposal_idx on agora.comment_threads (proposal_id, created_at);

create table if not exists agora.comments (
  id         uuid        primary key,
  thread_id  uuid        not null references agora.comment_threads(id) on delete cascade,
  author_id  uuid        not null references agora.participants(id) on delete restrict,
  body       text        not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists comments_thread_idx on agora.comments (thread_id, created_at);

create table if not exists agora.proposal_images (
  id          uuid primary key,
  proposal_id uuid not null references agora.proposals(id) on delete cascade,
  path        text not null,
  thumb_path  text not null,
  width       int  not null,
  height      int  not null,
  bytes       int  not null check (bytes <= 204800),
  position    int  not null default 0
);
create unique index if not exists images_position_idx
  on agora.proposal_images (proposal_id, position);

create table if not exists agora.expense_shares (
  proposal_id    uuid    not null references agora.proposals(id) on delete cascade,
  participant_id uuid    not null references agora.participants(id) on delete cascade,
  opted_in       boolean not null default false,
  primary key (proposal_id, participant_id)
);

create table if not exists agora.manual_liquidations (
  id          uuid        primary key,
  proposal_id uuid        not null references agora.proposals(id) on delete cascade,
  cents       int         not null check (cents > 0 and cents <= 99999999),
  paid_by     uuid        references agora.participants(id) on delete set null,
  affects     uuid[]      not null default '{}',
  paid_shares uuid[]      not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists agora.history (
  id             uuid        primary key default gen_random_uuid(),
  group_id       uuid        not null references agora.groups(id) on delete cascade,
  proposal_id    uuid        references agora.proposals(id) on delete cascade,
  participant_id uuid        references agora.participants(id) on delete set null,
  type           varchar(40) not null,
  description    text        not null,
  created_at     timestamptz not null default now()
);
create index if not exists history_group_idx on agora.history (group_id, created_at desc);

create table if not exists agora.pin_attempts (
  participant_id uuid        primary key references agora.participants(id) on delete cascade,
  fails          int         not null default 0,
  window_start   timestamptz not null default now()
);

-- Lockdown from the start: RLS on with no policies, and no direct grants. Scoped to this schema,
-- so EventSplit's tables and grants in public are untouched.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'agora' loop
    execute format('alter table agora.%I enable row level security', t);
    execute format('revoke all on agora.%I from anon, authenticated', t);
  end loop;
end $$;
