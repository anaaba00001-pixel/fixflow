-- Private storage policies. Paths always start with organization_id.

drop policy if exists "organization storage read" on storage.objects;
create policy "organization storage read" on storage.objects for select to authenticated
using (bucket_id in ('ticket-attachments','organization-assets') and (storage.foldername(name))[1] = public.current_organization_id()::text);

drop policy if exists "organization storage insert" on storage.objects;
create policy "organization storage insert" on storage.objects for insert to authenticated
with check (bucket_id in ('ticket-attachments','organization-assets') and (storage.foldername(name))[1] = public.current_organization_id()::text);

create policy "organization storage delete" on storage.objects for delete to authenticated
using (bucket_id in ('ticket-attachments','organization-assets') and (storage.foldername(name))[1] = public.current_organization_id()::text and public.is_manager());
