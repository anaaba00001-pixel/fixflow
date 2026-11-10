-- FixFlow workflow hardening. Apply after 020_registered_reporter_support.sql.

alter table public.profiles add column if not exists specialization text;
alter table public.profiles add column if not exists availability_status text not null default 'AVAILABLE';
alter table public.profiles drop constraint if exists profiles_availability_status_check;
alter table public.profiles add constraint profiles_availability_status_check
  check (availability_status in ('AVAILABLE', 'BUSY', 'OFF_DUTY'));

-- QR secrets are isolated from the client-readable assets table. RLS is enabled
-- without client policies; only the service role Edge Function can access it.
create table if not exists public.asset_qr_secrets (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  rotated_at timestamptz not null default now()
);
alter table public.asset_qr_secrets enable row level security;
revoke all on public.asset_qr_secrets from anon, authenticated;

create or replace function public.store_asset_qr_secret(
  p_asset_id uuid,
  p_token_hash text,
  p_ciphertext text,
  p_iv text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  update public.assets set qr_token_hash = p_token_hash, is_active = true, updated_at = now()
  where id = p_asset_id;
  if not found then raise exception 'ASSET_NOT_FOUND'; end if;
  insert into public.asset_qr_secrets (asset_id, ciphertext, iv, rotated_at)
  values (p_asset_id, p_ciphertext, p_iv, now())
  on conflict (asset_id) do update set ciphertext = excluded.ciphertext, iv = excluded.iv, rotated_at = excluded.rotated_at;
end;
$$;
revoke all on function public.store_asset_qr_secret(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.store_asset_qr_secret(uuid, text, text, text) to service_role;

create table if not exists public.user_locations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, location_id)
);
create index if not exists user_locations_org_location_idx on public.user_locations (organization_id, location_id);
alter table public.user_locations enable row level security;

create or replace function public.user_has_location(p_user_id uuid, p_location_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_locations ul
    where ul.user_id = p_user_id and ul.location_id = p_location_id
  );
$$;

drop policy if exists "users read permitted locations" on public.user_locations;
create policy "users read permitted locations" on public.user_locations for select to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() in ('PLATFORM_ADMIN', 'ORGANIZATION_ADMIN')
  or (organization_id = public.current_organization_id() and public.current_user_role() in ('BRANCH_MANAGER', 'SUPERVISOR'))
);
drop policy if exists "organization admins manage user locations" on public.user_locations;
create policy "organization admins manage user locations" on public.user_locations for all to authenticated
using (
  public.current_user_role() = 'PLATFORM_ADMIN'
  or (organization_id = public.current_organization_id() and public.current_user_role() = 'ORGANIZATION_ADMIN')
)
with check (
  public.current_user_role() = 'PLATFORM_ADMIN'
  or (organization_id = public.current_organization_id() and public.current_user_role() = 'ORGANIZATION_ADMIN')
);

alter table public.tickets add column if not exists supervisor_approved_at timestamptz;
alter table public.tickets add column if not exists supervisor_approved_by uuid references public.profiles(id) on delete set null;
alter table public.tickets add column if not exists reporter_confirmed_at timestamptz;
alter table public.tickets add column if not exists first_closed_at timestamptz;
alter table public.tickets add column if not exists last_closed_at timestamptz;
alter table public.tickets add column if not exists reopened_at timestamptz;
alter table public.tickets add column if not exists reopen_count integer not null default 0;
alter table public.tickets add column if not exists current_cycle_started_at timestamptz not null default now();

create or replace function public.can_manage_ticket_location(p_location_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case public.current_user_role()
    when 'PLATFORM_ADMIN' then true
    when 'ORGANIZATION_ADMIN' then true
    when 'BRANCH_MANAGER' then public.user_has_location(auth.uid(), p_location_id)
    when 'SUPERVISOR' then public.user_has_location(auth.uid(), p_location_id)
    else false
  end;
$$;

drop policy if exists "authorized users read tickets" on public.tickets;
create policy "authorized users read tickets" on public.tickets for select to authenticated using (
  public.current_user_is_platform_admin()
  or (
    organization_id = public.current_organization_id()
    and (
      public.current_user_role() in ('ORGANIZATION_ADMIN', 'INVENTORY_MANAGER')
      or (public.current_user_role() in ('BRANCH_MANAGER', 'SUPERVISOR') and public.user_has_location(auth.uid(), location_id))
      or (public.current_user_role() = 'TECHNICIAN' and assigned_technician_id = auth.uid())
      or (public.current_user_role() = 'REGISTERED_REPORTER' and reporter_user_id = auth.uid())
    )
  )
);

drop policy if exists "managers update tickets" on public.tickets;
create policy "managers update tickets" on public.tickets for update to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('ORGANIZATION_ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
  and public.can_manage_ticket_location(location_id)
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_ticket_location(location_id)
);

create or replace function public.guard_profile_privilege_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor_role public.user_role := public.current_user_role();
begin
  if auth.role() = 'service_role' then return new; end if;
  if new.organization_id is distinct from old.organization_id then raise exception 'ORGANIZATION_CHANGE_FORBIDDEN'; end if;
  if new.role is distinct from old.role then
    if v_actor_role = 'PLATFORM_ADMIN' then return new; end if;
    if v_actor_role = 'ORGANIZATION_ADMIN'
       and old.role not in ('PLATFORM_ADMIN', 'ORGANIZATION_ADMIN')
       and new.role in ('BRANCH_MANAGER', 'SUPERVISOR', 'TECHNICIAN', 'INVENTORY_MANAGER', 'REGISTERED_REPORTER') then
      return new;
    end if;
    raise exception 'ROLE_CHANGE_FORBIDDEN';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_privilege_change on public.profiles;
create trigger guard_profile_privilege_change before update on public.profiles
for each row execute function public.guard_profile_privilege_change();

drop policy if exists "managers manage profiles" on public.profiles;
create policy "organization admins update subordinate profiles" on public.profiles for update to authenticated
using (
  public.current_user_role() = 'PLATFORM_ADMIN'
  or (
    organization_id = public.current_organization_id()
    and public.current_user_role() = 'ORGANIZATION_ADMIN'
    and role not in ('PLATFORM_ADMIN', 'ORGANIZATION_ADMIN')
  )
)
with check (
  public.current_user_role() = 'PLATFORM_ADMIN'
  or (organization_id = public.current_organization_id() and public.current_user_role() = 'ORGANIZATION_ADMIN')
);

create or replace function public.valid_ticket_transition(p_old public.ticket_status, p_new public.ticket_status)
returns boolean language sql immutable as $$
  select case p_old
    when 'NEW' then p_new in ('ASSIGNED', 'CANCELLED')
    when 'ASSIGNED' then p_new in ('ACCEPTED', 'NEW', 'CANCELLED')
    when 'ACCEPTED' then p_new in ('IN_PROGRESS', 'ASSIGNED', 'CANCELLED')
    when 'IN_PROGRESS' then p_new in ('WAITING_PARTS', 'PENDING_APPROVAL', 'CANCELLED')
    when 'WAITING_PARTS' then p_new in ('IN_PROGRESS', 'CANCELLED')
    when 'PENDING_APPROVAL' then p_new in ('CLOSED', 'IN_PROGRESS', 'REOPENED')
    when 'CLOSED' then p_new = 'REOPENED'
    when 'REOPENED' then p_new in ('ASSIGNED', 'IN_PROGRESS', 'CANCELLED')
    when 'CANCELLED' then p_new = 'NEW'
    else false end;
$$;

create or replace function public.enforce_ticket_status_transition()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if not public.valid_ticket_transition(old.status, new.status) then raise exception 'INVALID_STATUS_TRANSITION'; end if;
  if auth.role() = 'service_role' then return new; end if;
  if old.status = 'PENDING_APPROVAL' and new.status = 'CLOSED' then
    if public.current_user_role() <> 'REGISTERED_REPORTER'
       or old.reporter_user_id <> auth.uid()
       or old.supervisor_approved_at is null then
      raise exception 'REPORTER_CONFIRMATION_REQUIRED';
    end if;
    new.reporter_confirmed_at := coalesce(new.reporter_confirmed_at, now());
  end if;
  -- Authenticated clients must use change_ticket_status so authorization and history are atomic.
  if current_setting('fixflow.status_change_rpc', true) is distinct from 'on' then
    raise exception 'STATUS_UPDATE_REQUIRES_RPC';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_ticket_status_transition on public.tickets;
create trigger enforce_ticket_status_transition before update of status on public.tickets
for each row execute function public.enforce_ticket_status_transition();

create or replace function public.guard_ticket_sensitive_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if new.assigned_technician_id is distinct from old.assigned_technician_id
     and current_setting('fixflow.assignment_rpc', true) is distinct from 'on' then
    raise exception 'ASSIGNMENT_UPDATE_REQUIRES_SERVER_OPERATION';
  end if;
  if (
    new.closed_at is distinct from old.closed_at
    or new.completed_at is distinct from old.completed_at
    or new.cancelled_at is distinct from old.cancelled_at
    or new.first_closed_at is distinct from old.first_closed_at
    or new.last_closed_at is distinct from old.last_closed_at
    or new.reopened_at is distinct from old.reopened_at
    or new.reopen_count is distinct from old.reopen_count
    or new.current_cycle_started_at is distinct from old.current_cycle_started_at
    or new.supervisor_approved_at is distinct from old.supervisor_approved_at
    or new.supervisor_approved_by is distinct from old.supervisor_approved_by
    or new.reporter_confirmed_at is distinct from old.reporter_confirmed_at
  ) and current_setting('fixflow.status_change_rpc', true) is distinct from 'on'
      and current_setting('fixflow.approval_rpc', true) is distinct from 'on' then
    raise exception 'WORKFLOW_FIELDS_REQUIRE_SERVER_OPERATION';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_ticket_sensitive_fields on public.tickets;
create trigger guard_ticket_sensitive_fields before update on public.tickets
for each row execute function public.guard_ticket_sensitive_fields();

create or replace function public.approve_ticket_resolution(p_ticket_id uuid, p_note text default null)
returns public.tickets language plpgsql security definer set search_path = public as $$
declare v_ticket public.tickets;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if v_ticket.id is null then raise exception 'TICKET_NOT_FOUND'; end if;
  if v_ticket.status <> 'PENDING_APPROVAL' then raise exception 'TICKET_NOT_PENDING_APPROVAL'; end if;
  if public.current_user_role() not in ('PLATFORM_ADMIN', 'ORGANIZATION_ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR') then raise exception 'FORBIDDEN'; end if;
  if public.current_user_role() <> 'PLATFORM_ADMIN' and (v_ticket.organization_id is distinct from public.current_organization_id() or not public.can_manage_ticket_location(v_ticket.location_id)) then raise exception 'FORBIDDEN'; end if;
  perform set_config('fixflow.approval_rpc', 'on', true);
  update public.tickets set supervisor_approved_at = now(), supervisor_approved_by = auth.uid(), updated_at = now()
  where id = p_ticket_id returning * into v_ticket;
  insert into public.ticket_history (organization_id, ticket_id, actor_id, from_status, to_status, reason)
  values (v_ticket.organization_id, v_ticket.id, auth.uid(), v_ticket.status, v_ticket.status, coalesce(p_note, 'Resolution approved by supervisor'));
  return v_ticket;
end;
$$;
grant execute on function public.approve_ticket_resolution(uuid, text) to authenticated;

-- Make the existing status RPC the only authenticated path through the status trigger.
alter function public.change_ticket_status(uuid, public.ticket_status, text)
  rename to change_ticket_status_internal;
revoke all on function public.change_ticket_status_internal(uuid, public.ticket_status, text) from public, authenticated;

create function public.change_ticket_status(
  p_ticket_id uuid,
  p_new_status public.ticket_status,
  p_reason text default null
)
returns public.tickets language plpgsql security definer set search_path = public as $$
declare
  v_ticket public.tickets;
  v_old_status public.ticket_status;
  v_role public.user_role;
  v_allowed boolean := false;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if v_ticket.id is null then raise exception 'TICKET_NOT_FOUND'; end if;
  v_role := public.current_user_role();
  v_old_status := v_ticket.status;
  if v_role is null then raise exception 'UNAUTHENTICATED'; end if;
  if v_role <> 'PLATFORM_ADMIN' and v_ticket.organization_id is distinct from public.current_organization_id() then raise exception 'FORBIDDEN'; end if;

  if v_role = 'TECHNICIAN' then
    if v_ticket.assigned_technician_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
    v_allowed := (v_old_status = 'ASSIGNED' and p_new_status = 'ACCEPTED')
      or (v_old_status = 'ACCEPTED' and p_new_status = 'IN_PROGRESS')
      or (v_old_status = 'IN_PROGRESS' and p_new_status in ('WAITING_PARTS', 'PENDING_APPROVAL'))
      or (v_old_status = 'WAITING_PARTS' and p_new_status = 'IN_PROGRESS');
  elsif v_role = 'REGISTERED_REPORTER' then
    if v_ticket.reporter_user_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
    v_allowed := (v_old_status = 'PENDING_APPROVAL' and p_new_status in ('CLOSED', 'REOPENED'))
      or (v_old_status = 'CLOSED' and p_new_status = 'REOPENED');
    if p_new_status = 'CLOSED' and v_ticket.supervisor_approved_at is null then raise exception 'SUPERVISOR_APPROVAL_REQUIRED'; end if;
  elsif v_role in ('PLATFORM_ADMIN', 'ORGANIZATION_ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR') then
    if v_role <> 'PLATFORM_ADMIN' and not public.can_manage_ticket_location(v_ticket.location_id) then raise exception 'FORBIDDEN'; end if;
    -- The configured workflow requires supervisor approval followed by reporter confirmation.
    -- Managers approve through approve_ticket_resolution; they do not close directly.
    v_allowed := public.valid_ticket_transition(v_old_status, p_new_status)
      and not (v_old_status = 'PENDING_APPROVAL' and p_new_status = 'CLOSED');
  else
    raise exception 'FORBIDDEN';
  end if;
  if not v_allowed then raise exception 'INVALID_STATUS_TRANSITION'; end if;

  perform set_config('fixflow.status_change_rpc', 'on', true);
  update public.tickets set
    status = p_new_status,
    accepted_at = case when p_new_status = 'ACCEPTED' then now() else accepted_at end,
    started_at = case when p_new_status = 'IN_PROGRESS' and started_at is null then now() else started_at end,
    completed_at = case when p_new_status = 'PENDING_APPROVAL' then now() when p_new_status = 'REOPENED' then null else completed_at end,
    closed_at = case when p_new_status = 'CLOSED' then now() when p_new_status = 'REOPENED' then null else closed_at end,
    first_closed_at = case when p_new_status = 'CLOSED' then coalesce(first_closed_at, now()) else first_closed_at end,
    last_closed_at = case when p_new_status = 'CLOSED' then now() else last_closed_at end,
    reopened_at = case when p_new_status = 'REOPENED' then now() else reopened_at end,
    reopen_count = case when p_new_status = 'REOPENED' then reopen_count + 1 else reopen_count end,
    current_cycle_started_at = case when p_new_status = 'REOPENED' then now() else current_cycle_started_at end,
    cancelled_at = case when p_new_status = 'CANCELLED' then now() when p_new_status = 'NEW' then null else cancelled_at end,
    supervisor_approved_at = case when p_new_status = 'REOPENED' then null else supervisor_approved_at end,
    supervisor_approved_by = case when p_new_status = 'REOPENED' then null else supervisor_approved_by end,
    reporter_confirmed_at = case when p_new_status = 'CLOSED' then now() when p_new_status = 'REOPENED' then null else reporter_confirmed_at end,
    updated_at = now()
  where id = p_ticket_id returning * into v_ticket;

  insert into public.ticket_history (organization_id, ticket_id, actor_id, from_status, to_status, reason)
  values (v_ticket.organization_id, v_ticket.id, auth.uid(), v_old_status, p_new_status, p_reason);
  return v_ticket;
end;
$$;
revoke all on function public.change_ticket_status(uuid, public.ticket_status, text) from public;
grant execute on function public.change_ticket_status(uuid, public.ticket_status, text) to authenticated;
