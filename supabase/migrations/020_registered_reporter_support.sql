-- =========================================================
-- FixFlow
-- Migration 020
-- دعم المبلّغ المسجّل والبلاغ العام وسياسات الوصول الآمنة
--
-- يجب تشغيل migration 019 أولًا لإضافة:
-- BRANCH_MANAGER
-- INVENTORY_MANAGER
-- REGISTERED_REPORTER
-- =========================================================

-- =========================================================
-- 1. تحديث جدول البلاغات
-- =========================================================

-- السماح ببلاغ عام لا يرتبط بجهاز.
alter table public.tickets
alter column asset_id drop not null;

-- ربط البلاغ بحساب المبلّغ المسجّل.
alter table public.tickets
add column if not exists reporter_user_id uuid
references public.profiles(id)
on delete set null;

-- حفظ بيانات التواصل في أعمدة مستقلة.
alter table public.tickets
add column if not exists reporter_email text;

alter table public.tickets
add column if not exists reporter_phone text;

-- فهارس لتحسين عرض بلاغات المستخدم.
create index if not exists
tickets_reporter_user_created_idx
on public.tickets (
  reporter_user_id,
  created_at desc
);

create index if not exists
tickets_reporter_user_status_idx
on public.tickets (
  reporter_user_id,
  status
);

-- =========================================================
-- 2. دوال مساعدة للصلاحيات
-- =========================================================

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

create or replace function public.current_user_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_user_role() = 'PLATFORM_ADMIN',
    false
  );
$$;

-- تحديث تعريف المدير ليشمل مدير الفرع.
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_user_role() in (
      'ORGANIZATION_ADMIN',
      'BRANCH_MANAGER',
      'SUPERVISOR'
    ),
    false
  );
$$;

-- التحقق من إمكانية المستخدم الحالي الوصول إلى بلاغ.
create or replace function public.can_access_ticket_id(
  p_ticket_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_organization_id uuid;
  v_ticket_organization_id uuid;
  v_reporter_user_id uuid;
  v_assigned_technician_id uuid;
begin
  select
    role,
    organization_id
  into
    v_role,
    v_organization_id
  from public.profiles
  where id = auth.uid()
    and is_active = true;

  if v_role is null then
    return false;
  end if;

  select
    organization_id,
    reporter_user_id,
    assigned_technician_id
  into
    v_ticket_organization_id,
    v_reporter_user_id,
    v_assigned_technician_id
  from public.tickets
  where id = p_ticket_id;

  if v_ticket_organization_id is null then
    return false;
  end if;

  if v_role = 'PLATFORM_ADMIN' then
    return true;
  end if;

  if v_ticket_organization_id <> v_organization_id then
    return false;
  end if;

  if v_role in (
    'ORGANIZATION_ADMIN',
    'BRANCH_MANAGER',
    'SUPERVISOR',
    'INVENTORY_MANAGER'
  ) then
    return true;
  end if;

  if v_role = 'TECHNICIAN' then
    return v_assigned_technician_id = auth.uid();
  end if;

  if v_role = 'REGISTERED_REPORTER' then
    return v_reporter_user_id = auth.uid();
  end if;

  return false;
end;
$$;

-- تحويل النص إلى UUID دون حدوث خطأ.
create or replace function public.try_uuid(
  p_value text
)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return p_value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

-- =========================================================
-- 3. التحقق من ارتباط الموقع والجهاز بالمنشأة
-- =========================================================

create or replace function public.validate_ticket_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_organization_id uuid;
  v_asset_organization_id uuid;
  v_asset_location_id uuid;
  v_category_organization_id uuid;

  v_reporter_organization_id uuid;
  v_reporter_role public.user_role;
  v_reporter_name text;
  v_reporter_email text;
  v_reporter_phone text;

  v_current_role public.user_role;
begin
  -- التحقق من الموقع.
  select organization_id
  into v_location_organization_id
  from public.locations
  where id = new.location_id
    and is_active = true;

  if v_location_organization_id is null then
    raise exception 'INVALID_LOCATION';
  end if;

  if v_location_organization_id <> new.organization_id then
    raise exception 'LOCATION_ORGANIZATION_MISMATCH';
  end if;

  -- الجهاز اختياري للبلاغات العامة.
  if new.asset_id is not null then
    select
      organization_id,
      location_id
    into
      v_asset_organization_id,
      v_asset_location_id
    from public.assets
    where id = new.asset_id
      and is_active = true;

    if v_asset_organization_id is null then
      raise exception 'INVALID_ASSET';
    end if;

    if v_asset_organization_id <> new.organization_id then
      raise exception 'ASSET_ORGANIZATION_MISMATCH';
    end if;

    if v_asset_location_id <> new.location_id then
      raise exception 'ASSET_LOCATION_MISMATCH';
    end if;
  end if;

  -- التصنيف اختياري، لكن يجب أن يتبع المنشأة.
  if new.category_id is not null then
    select organization_id
    into v_category_organization_id
    from public.categories
    where id = new.category_id
      and is_active = true;

    if v_category_organization_id is null then
      raise exception 'INVALID_CATEGORY';
    end if;

    if v_category_organization_id <> new.organization_id then
      raise exception 'CATEGORY_ORGANIZATION_MISMATCH';
    end if;
  end if;

  v_current_role := public.current_user_role();

  -- عند إنشاء البلاغ من حساب مبلّغ مسجّل،
  -- يُربط البلاغ بحسابه تلقائيًا.
  if v_current_role = 'REGISTERED_REPORTER' then
    new.reporter_user_id := auth.uid();
  end if;

  -- التحقق من حساب المبلّغ.
  if new.reporter_user_id is not null then
    select
      organization_id,
      role,
      full_name,
      email,
      phone
    into
      v_reporter_organization_id,
      v_reporter_role,
      v_reporter_name,
      v_reporter_email,
      v_reporter_phone
    from public.profiles
    where id = new.reporter_user_id
      and is_active = true;

    if v_reporter_role is null then
      raise exception 'INVALID_REPORTER_USER';
    end if;

    if v_reporter_role <> 'REGISTERED_REPORTER' then
      raise exception 'USER_IS_NOT_REGISTERED_REPORTER';
    end if;

    if v_reporter_organization_id <> new.organization_id then
      raise exception 'REPORTER_ORGANIZATION_MISMATCH';
    end if;

    new.reporter_name :=
      coalesce(
        nullif(trim(new.reporter_name), ''),
        v_reporter_name
      );

    new.reporter_email :=
      coalesce(
        nullif(trim(new.reporter_email), ''),
        v_reporter_email
      );

    new.reporter_phone :=
      coalesce(
        nullif(trim(new.reporter_phone), ''),
        v_reporter_phone
      );

    if new.reporter_contact is null then
      new.reporter_contact :=
        concat_ws(
          ' | ',
          case
            when new.reporter_phone is not null
            then 'الهاتف: ' || new.reporter_phone
          end,
          case
            when new.reporter_email is not null
            then 'البريد: ' || new.reporter_email
          end
        );

      if trim(coalesce(new.reporter_contact, '')) = '' then
        new.reporter_contact := null;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists
validate_ticket_scope_trigger
on public.tickets;

create trigger validate_ticket_scope_trigger
before insert or update of
  organization_id,
  location_id,
  asset_id,
  category_id,
  reporter_user_id,
  reporter_name,
  reporter_email,
  reporter_phone,
  reporter_contact
on public.tickets
for each row
execute function public.validate_ticket_scope();

-- =========================================================
-- 4. تحديث سياسات profiles
--
-- يمنع المبلّغ المسجّل من مشاهدة حسابات
-- باقي موظفي المنشأة.
-- =========================================================

drop policy if exists
"profiles read same organization"
on public.profiles;

create policy
"profiles read permitted users"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()

  or public.current_user_is_platform_admin()

  or (
    organization_id =
      public.current_organization_id()

    and public.current_user_role()
      <> 'REGISTERED_REPORTER'
  )
);

-- =========================================================
-- 5. تحديث سياسات tickets
-- =========================================================

drop policy if exists
"authorized members read tickets"
on public.tickets;

create policy
"authorized users read tickets"
on public.tickets
for select
to authenticated
using (
  public.current_user_is_platform_admin()

  or (
    organization_id =
      public.current_organization_id()

    and (
      public.current_user_role() in (
        'ORGANIZATION_ADMIN',
        'BRANCH_MANAGER',
        'SUPERVISOR',
        'INVENTORY_MANAGER'
      )

      or (
        public.current_user_role() = 'TECHNICIAN'
        and assigned_technician_id = auth.uid()
      )

      or (
        public.current_user_role() =
          'REGISTERED_REPORTER'
        and reporter_user_id = auth.uid()
      )
    )
  )
);

drop policy if exists
"authorized users create tickets"
on public.tickets;

create policy
"authorized users create tickets"
on public.tickets
for insert
to authenticated
with check (
  organization_id =
    public.current_organization_id()

  and (
    public.current_user_role() in (
      'ORGANIZATION_ADMIN',
      'BRANCH_MANAGER',
      'SUPERVISOR'
    )

    or (
      public.current_user_role() =
        'REGISTERED_REPORTER'

      and reporter_user_id = auth.uid()
      and status = 'NEW'
      and assigned_technician_id is null
    )
  )
);

-- المدراء والمشرفون يحدثون بلاغات منشأتهم.
drop policy if exists
"managers update tickets"
on public.tickets;

create policy
"managers update tickets"
on public.tickets
for update
to authenticated
using (
  organization_id =
    public.current_organization_id()

  and public.current_user_role() in (
    'ORGANIZATION_ADMIN',
    'BRANCH_MANAGER',
    'SUPERVISOR'
  )
)
with check (
  organization_id =
    public.current_organization_id()
);

-- الفني يحدث البلاغ المسند إليه فقط.
drop policy if exists
"technicians update assigned tickets"
on public.tickets;

create policy
"technicians update assigned tickets"
on public.tickets
for update
to authenticated
using (
  organization_id =
    public.current_organization_id()

  and public.current_user_role() =
    'TECHNICIAN'

  and assigned_technician_id =
    auth.uid()
)
with check (
  organization_id =
    public.current_organization_id()

  and assigned_technician_id =
    auth.uid()
);

-- =========================================================
-- 6. التعليقات
-- =========================================================

drop policy if exists
"members read ticket comments"
on public.ticket_comments;

create policy
"authorized users read ticket comments"
on public.ticket_comments
for select
to authenticated
using (
  public.can_access_ticket_id(ticket_id)

  and (
    public.current_user_role()
      <> 'REGISTERED_REPORTER'

    or is_internal = false
  )
);

drop policy if exists
"members add ticket comments"
on public.ticket_comments;

create policy
"authorized users add ticket comments"
on public.ticket_comments
for insert
to authenticated
with check (
  author_id = auth.uid()

  and organization_id =
    public.current_organization_id()

  and public.can_access_ticket_id(ticket_id)

  and (
    public.current_user_role()
      <> 'REGISTERED_REPORTER'

    or is_internal = false
  )
);

-- =========================================================
-- 7. المرفقات
-- =========================================================

drop policy if exists
"members read attachments"
on public.ticket_attachments;

create policy
"authorized users read attachments"
on public.ticket_attachments
for select
to authenticated
using (
  public.can_access_ticket_id(ticket_id)
);

drop policy if exists
"members add attachments"
on public.ticket_attachments;

create policy
"authorized users add attachments"
on public.ticket_attachments
for insert
to authenticated
with check (
  uploaded_by = auth.uid()

  and organization_id =
    public.current_organization_id()

  and public.can_access_ticket_id(ticket_id)

  and (
    public.current_user_role()
      <> 'REGISTERED_REPORTER'

    or type = 'REPORT'
  )
);

-- =========================================================
-- 8. سجل البلاغ
-- =========================================================

drop policy if exists
"members read ticket history"
on public.ticket_history;

create policy
"authorized users read ticket history"
on public.ticket_history
for select
to authenticated
using (
  public.can_access_ticket_id(ticket_id)
);

-- =========================================================
-- 9. تقييم الخدمة
-- =========================================================

drop policy if exists
"members read ratings"
on public.ticket_ratings;

create policy
"authorized users read ratings"
on public.ticket_ratings
for select
to authenticated
using (
  public.can_access_ticket_id(ticket_id)
);

drop policy if exists
"reporters add own ticket ratings"
on public.ticket_ratings;

create policy
"reporters add own ticket ratings"
on public.ticket_ratings
for insert
to authenticated
with check (
  organization_id =
    public.current_organization_id()

  and public.current_user_role() =
    'REGISTERED_REPORTER'

  and exists (
    select 1
    from public.tickets ticket
    where ticket.id = ticket_id
      and ticket.organization_id =
        public.current_organization_id()
      and ticket.reporter_user_id =
        auth.uid()
      and ticket.status = 'CLOSED'
  )
);

-- =========================================================
-- 10. حماية ملفات المرفقات في Storage
-- =========================================================

drop policy if exists
"organization storage read"
on storage.objects;

create policy
"authorized organization storage read"
on storage.objects
for select
to authenticated
using (
  bucket_id in (
    'ticket-attachments',
    'organization-assets'
  )

  and (
    public.current_user_is_platform_admin()

    or (
      (storage.foldername(name))[1] =
        public.current_organization_id()::text

      and (
        public.current_user_role()
          <> 'REGISTERED_REPORTER'

        or (
          bucket_id = 'ticket-attachments'

          and public.can_access_ticket_id(
            public.try_uuid(
              (storage.foldername(name))[2]
            )
          )
        )
      )
    )
  )
);

drop policy if exists
"organization storage insert"
on storage.objects;

create policy
"authorized organization storage insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in (
    'ticket-attachments',
    'organization-assets'
  )

  and (
    public.current_user_is_platform_admin()

    or (
      (storage.foldername(name))[1] =
        public.current_organization_id()::text

      and (
        public.current_user_role()
          <> 'REGISTERED_REPORTER'

        or (
          bucket_id = 'ticket-attachments'

          and public.can_access_ticket_id(
            public.try_uuid(
              (storage.foldername(name))[2]
            )
          )
        )
      )
    )
  )
);

-- =========================================================
-- 11. ضبط تغيير حالة البلاغ
-- =========================================================

create or replace function public.change_ticket_status(
  p_ticket_id uuid,
  p_new_status public.ticket_status,
  p_reason text default null
)
returns public.tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets;
  v_old_status public.ticket_status;
  v_role public.user_role;
  v_allowed boolean := false;
begin
  select *
  into v_ticket
  from public.tickets
  where id = p_ticket_id
  for update;

  if v_ticket.id is null then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  v_role := public.current_user_role();
  v_old_status := v_ticket.status;

  if v_role is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if (
    v_role <> 'PLATFORM_ADMIN'
    and v_ticket.organization_id
      <> public.current_organization_id()
  ) then
    raise exception 'FORBIDDEN';
  end if;

  -- الفني يتعامل فقط مع البلاغ المسند إليه.
  if v_role = 'TECHNICIAN' then
    if v_ticket.assigned_technician_id
      <> auth.uid()
    then
      raise exception 'FORBIDDEN';
    end if;

    v_allowed :=
      (
        v_old_status = 'ASSIGNED'
        and p_new_status = 'ACCEPTED'
      )
      or (
        v_old_status = 'ACCEPTED'
        and p_new_status = 'IN_PROGRESS'
      )
      or (
        v_old_status = 'IN_PROGRESS'
        and p_new_status in (
          'WAITING_PARTS',
          'PENDING_APPROVAL'
        )
      )
      or (
        v_old_status = 'WAITING_PARTS'
        and p_new_status = 'IN_PROGRESS'
      );

  -- المبلّغ يتعامل فقط مع بلاغاته.
  elsif v_role = 'REGISTERED_REPORTER' then
    if v_ticket.reporter_user_id
      <> auth.uid()
    then
      raise exception 'FORBIDDEN';
    end if;

    v_allowed :=
      (
        v_old_status = 'PENDING_APPROVAL'
        and p_new_status in (
          'CLOSED',
          'REOPENED'
        )
      )
      or (
        v_old_status = 'CLOSED'
        and p_new_status = 'REOPENED'
      );

  -- الإدارة والمشرف.
  elsif v_role in (
    'PLATFORM_ADMIN',
    'ORGANIZATION_ADMIN',
    'BRANCH_MANAGER',
    'SUPERVISOR'
  ) then
    v_allowed :=
      case v_old_status
        when 'NEW' then
          p_new_status in (
            'ASSIGNED',
            'CANCELLED'
          )

        when 'ASSIGNED' then
          p_new_status in (
            'ACCEPTED',
            'NEW',
            'CANCELLED'
          )

        when 'ACCEPTED' then
          p_new_status in (
            'IN_PROGRESS',
            'ASSIGNED',
            'CANCELLED'
          )

        when 'IN_PROGRESS' then
          p_new_status in (
            'WAITING_PARTS',
            'PENDING_APPROVAL',
            'CANCELLED'
          )

        when 'WAITING_PARTS' then
          p_new_status in (
            'IN_PROGRESS',
            'CANCELLED'
          )

        when 'PENDING_APPROVAL' then
          p_new_status in (
            'CLOSED',
            'IN_PROGRESS',
            'REOPENED'
          )

        when 'CLOSED' then
          p_new_status = 'REOPENED'

        when 'REOPENED' then
          p_new_status in (
            'ASSIGNED',
            'IN_PROGRESS',
            'CANCELLED'
          )

        when 'CANCELLED' then
          p_new_status = 'NEW'

        else false
      end;

  else
    raise exception 'FORBIDDEN';
  end if;

  if not v_allowed then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;

  update public.tickets
  set
    status = p_new_status,

    accepted_at =
      case
        when p_new_status = 'ACCEPTED'
        then now()
        else accepted_at
      end,

    started_at =
      case
        when p_new_status = 'IN_PROGRESS'
          and started_at is null
        then now()
        else started_at
      end,

    completed_at =
      case
        when p_new_status = 'PENDING_APPROVAL'
        then now()
        else completed_at
      end,

    closed_at =
      case
        when p_new_status = 'CLOSED'
        then now()
        else closed_at
      end,

    cancelled_at =
      case
        when p_new_status = 'CANCELLED'
        then now()
        else cancelled_at
      end

  where id = p_ticket_id

  returning *
  into v_ticket;

  insert into public.ticket_history (
    organization_id,
    ticket_id,
    actor_id,
    from_status,
    to_status,
    reason
  )
  values (
    v_ticket.organization_id,
    v_ticket.id,
    auth.uid(),
    v_old_status,
    p_new_status,
    p_reason
  );

  return v_ticket;
end;
$$;

-- =========================================================
-- 12. منح تنفيذ الدوال للمستخدمين المسجلين
-- =========================================================

revoke all on function
public.current_user_role()
from public;

revoke all on function
public.current_user_is_platform_admin()
from public;

revoke all on function
public.can_access_ticket_id(uuid)
from public;

revoke all on function
public.change_ticket_status(
  uuid,
  public.ticket_status,
  text
)
from public;

grant execute on function
public.current_user_role()
to authenticated;

grant execute on function
public.current_user_is_platform_admin()
to authenticated;

grant execute on function
public.can_access_ticket_id(uuid)
to authenticated;

grant execute on function
public.change_ticket_status(
  uuid,
  public.ticket_status,
  text
)
to authenticated;