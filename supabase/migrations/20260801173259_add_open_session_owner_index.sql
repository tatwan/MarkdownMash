create index if not exists idx_sessions_open_owner
on public.sessions (owner_id, created_at desc)
where owner_id is not null and status in ('created', 'active');
