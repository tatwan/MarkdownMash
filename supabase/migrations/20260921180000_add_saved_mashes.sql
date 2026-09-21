-- My library (v1.7.0): Mashes a host saves before any room exists.
-- Additive. owner_id is integer because admins.id is integer today.

create table if not exists public.saved_mashes (
  id bigint generated always as identity primary key,
  owner_id integer not null references public.admins(id) on delete cascade,
  kind text not null check (kind in ('quiz', 'survey')),
  name text not null check (char_length(name) between 1 and 80),
  markdown text not null,
  question_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_mashes_owner_updated_idx
  on public.saved_mashes (owner_id, updated_at desc);
