alter table if exists public.participants
add column if not exists avatar_id text;
