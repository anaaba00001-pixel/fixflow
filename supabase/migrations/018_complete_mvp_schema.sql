-- FixFlow MVP database foundation.
-- This additive migration is safe to review and apply to a fresh Supabase project.

create extension if not exists pgcrypto;

do $$
begin
  create type public.organization_status
  as enum ('ACTIVE', 'SUSPENDED');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.user_role
  as enum (
    'PLATFORM_ADMIN',
    'ORGANIZATION_ADMIN',
    'SUPERVISOR',
    'TECHNICIAN'
  );
exception
  when duplicate_object then null;
end
$$;