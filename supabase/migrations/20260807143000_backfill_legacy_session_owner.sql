-- Assign pre-multi-admin sessions to the deployment master.
--
-- A null owner_id predates the owner_id column itself, so those rows were
-- created when the master was the only account and are the master's own
-- history. Every admin, master included, is now scoped to their own owner_id
-- for session history and analytics, so without this backfill the master's
-- earliest sessions disappear from their dashboard.
--
-- Safe to run more than once: it only touches rows that are still null.

update public.sessions
set owner_id = (
  select id from public.admins where role = 'master' order by id limit 1
)
where owner_id is null
  and exists (select 1 from public.admins where role = 'master');
