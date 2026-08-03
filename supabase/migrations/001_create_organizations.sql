-- FixFlow fresh database foundation.
-- This migration creates every base object required by migrations 019 and 020.

create extension if not exists pgcrypto;

do $$ begin create type public.organization_status as enum ('ACTIVE','SUSPENDED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.user_role as enum ('PLATFORM_ADMIN','ORGANIZATION_ADMIN','SUPERVISOR','TECHNICIAN'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ticket_status as enum ('NEW','ASSIGNED','ACCEPTED','IN_PROGRESS','WAITING_PARTS','PENDING_APPROVAL','CLOSED','REOPENED','CANCELLED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ticket_priority as enum ('LOW','MEDIUM','HIGH','EMERGENCY'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attachment_type as enum ('REPORT','BEFORE_REPAIR','AFTER_REPAIR'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notification_status as enum ('PENDING','SENT','FAILED'); exception when duplicate_object then null; end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  status public.organization_status not null default 'ACTIVE',
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  email text not null,
  phone text,
  role public.user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((role = 'PLATFORM_ADMIN' and organization_id is null) or (role <> 'PLATFORM_ADMIN' and organization_id is not null))
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  address text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,name)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id,name)
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  asset_number text,
  serial_number text,
  qr_token_hash text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,asset_number)
);

create table if not exists public.ticket_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year smallint not null,
  last_value integer not null default 0,
  primary key (organization_id,year)
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ticket_number text not null,
  tracking_token_hash text not null unique,
  asset_id uuid not null references public.assets(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  title text not null check (char_length(trim(title)) between 3 and 180),
  description text not null check (char_length(trim(description)) between 10 and 5000),
  priority public.ticket_priority not null default 'MEDIUM',
  status public.ticket_status not null default 'NEW',
  reporter_name text,
  reporter_contact text,
  assigned_technician_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  assigned_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  diagnosis text,
  resolution text,
  estimated_cost numeric(12,2) check (estimated_cost is null or estimated_cost >= 0),
  is_overdue boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,ticket_number)
);

create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  comment text not null check (char_length(trim(comment)) between 1 and 5000),
  is_internal boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  storage_path text not null unique,
  type public.attachment_type not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  from_status public.ticket_status,
  to_status public.ticket_status not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_ratings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ticket_id uuid not null unique references public.tickets(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete cascade,
  channel text not null check (channel in ('IN_APP','EMAIL')),
  event_type text not null,
  status public.notification_status not null default 'PENDING',
  attempts smallint not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tickets_org_status_created_idx on public.tickets(organization_id,status,created_at desc);
create index if not exists tickets_technician_status_idx on public.tickets(assigned_technician_id,status);
create index if not exists tickets_due_idx on public.tickets(due_at) where status not in ('CLOSED','CANCELLED');
create index if not exists history_ticket_created_idx on public.ticket_history(ticket_id,created_at);
create index if not exists notifications_retry_idx on public.notifications(status,created_at) where status in ('PENDING','FAILED');

create or replace function public.current_profile() returns public.profiles language sql stable security definer set search_path=public as $$ select * from public.profiles where id=auth.uid() and is_active limit 1 $$;
create or replace function public.current_organization_id() returns uuid language sql stable security definer set search_path=public as $$ select organization_id from public.current_profile() $$;
create or replace function public.is_manager() returns boolean language sql stable security definer set search_path=public as $$ select coalesce((select role in ('ORGANIZATION_ADMIN','SUPERVISOR') from public.current_profile()),false) $$;
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;

create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger locations_updated_at before update on public.locations for each row execute function public.set_updated_at();
create trigger assets_updated_at before update on public.assets for each row execute function public.set_updated_at();
create trigger tickets_updated_at before update on public.tickets for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.categories enable row level security;
alter table public.assets enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_history enable row level security;
alter table public.ticket_ratings enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('ticket-attachments','ticket-attachments',false,5242880,array['image/jpeg','image/png','image/webp']),('organization-assets','organization-assets',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
