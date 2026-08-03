-- Development/Staging demo data only. Never apply to a customer production tenant.
insert into public.organizations (id,name,slug,status)
values ('00000000-0000-0000-0000-000000000001','شركة FixFlow التجريبية','fixflow-demo','ACTIVE')
on conflict (id) do nothing;

insert into public.locations (id,organization_id,name,address)
values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','فرع الرياض','الرياض'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','فرع جدة','جدة')
on conflict (id) do nothing;

insert into public.categories (id,organization_id,name)
values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','تكييف'),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','كهرباء'),
 ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','سباكة')
on conflict (id) do nothing;

insert into public.assets (id,organization_id,location_id,category_id,name,asset_number,qr_token_hash)
values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','مكيف غرفة الاجتماعات','AC-204',encode(digest('development-only-qr-token','sha256'),'hex'))
on conflict (id) do nothing;
