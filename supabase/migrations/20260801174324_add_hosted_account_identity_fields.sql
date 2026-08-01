alter table public.admins
  add column if not exists email_verified_at timestamptz,
  add column if not exists account_status text not null default 'active',
  add column if not exists auth_source text not null default 'deployment';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admins_account_status_check'
      and conrelid = 'public.admins'::regclass
  ) then
    alter table public.admins
      add constraint admins_account_status_check
      check (account_status in ('invited', 'active', 'past_due', 'suspended', 'deleted'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'admins_auth_source_check'
      and conrelid = 'public.admins'::regclass
  ) then
    alter table public.admins
      add constraint admins_auth_source_check
      check (auth_source in ('deployment', 'hosted'));
  end if;
end
$$;

create unique index if not exists idx_admins_email_normalized
on public.admins (lower(email))
where email is not null;
