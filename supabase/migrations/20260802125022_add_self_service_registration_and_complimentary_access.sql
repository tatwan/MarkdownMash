alter table public.admins
  add column if not exists provisioning_source text not null default 'deployment',
  add column if not exists access_override text not null default 'none',
  add column if not exists complimentary_access_until timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'admins_provisioning_source_check'
      and conrelid = 'public.admins'::regclass
  ) then
    alter table public.admins
      add constraint admins_provisioning_source_check
      check (provisioning_source in ('deployment', 'master_invite', 'self_service'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'admins_access_override_check'
      and conrelid = 'public.admins'::regclass
  ) then
    alter table public.admins
      add constraint admins_access_override_check
      check (access_override in ('none', 'complimentary'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'admins_complimentary_access_check'
      and conrelid = 'public.admins'::regclass
  ) then
    alter table public.admins
      add constraint admins_complimentary_access_check
      check (
        access_override = 'complimentary'
        or complimentary_access_until is null
      );
  end if;
end
$$;

update public.admins
set provisioning_source = 'master_invite'
where auth_source = 'hosted'
  and created_by is not null
  and provisioning_source = 'deployment';

alter table public.account_invitations
  add column if not exists purpose text not null default 'master_invite';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_invitations_purpose_check'
      and conrelid = 'public.account_invitations'::regclass
  ) then
    alter table public.account_invitations
      add constraint account_invitations_purpose_check
      check (purpose in ('master_invite', 'self_signup'));
  end if;
end
$$;

create index if not exists idx_admins_complimentary_expiry
on public.admins (complimentary_access_until)
where access_override = 'complimentary'
  and complimentary_access_until is not null;
