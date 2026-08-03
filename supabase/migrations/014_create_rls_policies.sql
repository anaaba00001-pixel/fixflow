-- Base tenant-isolation policies. Migration 020 tightens these for registered reporters.

create policy "organization members read own organization" on public.organizations for select to authenticated
using (id = public.current_organization_id());

create policy "profiles read same organization" on public.profiles for select to authenticated
using (id = auth.uid() or organization_id = public.current_organization_id());

create policy "managers manage profiles" on public.profiles for all to authenticated
using (organization_id = public.current_organization_id() and public.is_manager())
with check (organization_id = public.current_organization_id() and public.is_manager());

create policy "members read locations" on public.locations for select to authenticated
using (organization_id = public.current_organization_id());
create policy "admins manage locations" on public.locations for all to authenticated
using (organization_id = public.current_organization_id() and public.is_manager())
with check (organization_id = public.current_organization_id() and public.is_manager());

create policy "members read categories" on public.categories for select to authenticated
using (organization_id = public.current_organization_id());
create policy "admins manage categories" on public.categories for all to authenticated
using (organization_id = public.current_organization_id() and public.is_manager())
with check (organization_id = public.current_organization_id() and public.is_manager());

create policy "members read assets" on public.assets for select to authenticated
using (organization_id = public.current_organization_id());
create policy "admins manage assets" on public.assets for all to authenticated
using (organization_id = public.current_organization_id() and public.is_manager())
with check (organization_id = public.current_organization_id() and public.is_manager());

create policy "authorized members read tickets" on public.tickets for select to authenticated
using (organization_id = public.current_organization_id() and ((select role from public.current_profile()) <> 'TECHNICIAN' or assigned_technician_id = auth.uid()));
create policy "managers update tickets" on public.tickets for update to authenticated
using (organization_id = public.current_organization_id() and public.is_manager())
with check (organization_id = public.current_organization_id());
create policy "technicians update assigned tickets" on public.tickets for update to authenticated
using (organization_id = public.current_organization_id() and assigned_technician_id = auth.uid())
with check (organization_id = public.current_organization_id() and assigned_technician_id = auth.uid());

create policy "members read ticket comments" on public.ticket_comments for select to authenticated
using (organization_id = public.current_organization_id());
create policy "members add ticket comments" on public.ticket_comments for insert to authenticated
with check (organization_id = public.current_organization_id() and author_id = auth.uid());

create policy "members read attachments" on public.ticket_attachments for select to authenticated
using (organization_id = public.current_organization_id());
create policy "members add attachments" on public.ticket_attachments for insert to authenticated
with check (organization_id = public.current_organization_id() and uploaded_by = auth.uid());

create policy "members read ticket history" on public.ticket_history for select to authenticated
using (organization_id = public.current_organization_id());
create policy "members read ratings" on public.ticket_ratings for select to authenticated
using (organization_id = public.current_organization_id());

create policy "users read notifications" on public.notifications for select to authenticated
using (organization_id = public.current_organization_id() and user_id = auth.uid());
create policy "admins read audit logs" on public.audit_logs for select to authenticated
using (organization_id = public.current_organization_id() and public.is_manager());
