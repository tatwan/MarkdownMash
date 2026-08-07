-- Survey sessions (v1.5.0): distinguish quiz vs survey at the session level.
-- Additive; existing rows keep session_type = 'quiz' via the default.

alter table public.sessions
  add column if not exists session_type text not null default 'quiz';

alter table public.sessions
  drop constraint if exists sessions_session_type_check;

alter table public.sessions
  add constraint sessions_session_type_check
  check (session_type in ('quiz', 'survey'));
