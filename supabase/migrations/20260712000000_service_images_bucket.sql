insert into storage.buckets (id, name, public)
values ('service-images', 'service-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view service images" on storage.objects;
create policy "Public can view service images"
on storage.objects for select
using (bucket_id = 'service-images');

drop policy if exists "Owners can upload service images" on storage.objects;
create policy "Owners can upload service images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'service-images'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'owner'
  )
);

drop policy if exists "Owners can update service images" on storage.objects;
create policy "Owners can update service images"
on storage.objects for update to authenticated
using (
  bucket_id = 'service-images'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'owner'
  )
)
with check (
  bucket_id = 'service-images'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'owner'
  )
);

drop policy if exists "Owners can delete service images" on storage.objects;
create policy "Owners can delete service images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'service-images'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'owner'
  )
);
