-- Follow-up hardening based on a read-only audit of the linked production
-- schema. This migration removes legacy public data paths while preserving the
-- current app workflows through narrow RPCs and role-aware policies.

-- Legacy appointment triggers inserted a client-identifying notification for
-- every profile on every appointment mutation. The current apps use
-- push_notification_history instead, so stop this unused privacy leak and its
-- unbounded row growth.
drop trigger if exists appointments_notify_all on public.appointments;
revoke all on function public._broadcast_notification_to_all(text, text)
  from public, anon, authenticated;
grant execute on function public._broadcast_notification_to_all(text, text)
  to service_role;

-- Anonymous availability checks must never require SELECT access to client
-- names, phone numbers, email addresses, comments, or visit/payment fields.
create or replace function public.get_booked_appointment_times(
  p_date date,
  p_location text
)
returns table(booked_time time without time zone)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_date is null
    or p_location is null
    or btrim(regexp_replace(p_location, '\s+', ' ', 'g')) = ''
    or char_length(p_location) > 160 then
    raise exception 'Invalid appointment availability request' using errcode = '22023';
  end if;

  return query
  select appointment.appointment_time
  from public.appointments appointment
  where appointment.appointment_date = p_date
    and lower(btrim(regexp_replace(appointment.location, '\s+', ' ', 'g')))
      = lower(btrim(regexp_replace(p_location, '\s+', ' ', 'g')))
    and appointment.status = 'upcoming'
    and coalesce(appointment.archived, false) = false
  order by appointment.appointment_time;
end;
$$;

revoke all on function public.get_booked_appointment_times(date, text)
  from public;
grant execute on function public.get_booked_appointment_times(date, text)
  to anon, authenticated;

-- Replace the accumulated permissive appointment policies with one explicit
-- policy per operation. The before-write guards from the previous migration
-- remain the final field-level authority.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'appointments'
  loop
    execute format('drop policy %I on public.appointments', v_policy.policyname);
  end loop;
end;
$$;

alter table public.appointments enable row level security;

create policy appointments_read_authorized
on public.appointments for select to authenticated
using (
  public.is_staff_member(auth.uid())
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid()
        and profile.role = 'client'
        and coalesce(profile.is_active, true)
    )
  )
);

create policy appointments_create_authorized
on public.appointments for insert to anon, authenticated
with check (
  status = 'upcoming'
  and coalesce(archived, false) = false
  and payment_method is null
  and paid_cash is null
  and paid_bank is null
  and total_amount is null
  and visit_notes is null
  and (
    (
      auth.uid() is null
      and user_id is null
      and created_by is null
    )
    or exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid()
        and coalesce(profile.is_active, true)
        and (
          (profile.role = 'client' and user_id = auth.uid() and created_by is null)
          or (
            profile.role in ('staff', 'manager', 'owner')
            and created_by = auth.uid()
          )
        )
    )
  )
);

create policy appointments_update_authorized
on public.appointments for update to authenticated
using (
  public.is_staff_member(auth.uid())
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid()
        and profile.role = 'client'
        and coalesce(profile.is_active, true)
    )
  )
)
with check (
  public.is_staff_member(auth.uid())
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid()
        and profile.role = 'client'
        and coalesce(profile.is_active, true)
    )
  )
);

revoke all on table public.appointments from anon, authenticated;
grant insert on table public.appointments to anon, authenticated;
grant select, update on table public.appointments to authenticated;

-- Restrict profile reads to the profile owner or active salon staff. The old
-- profiles_read_for_joins policy exposed every profile to every signed-in
-- client, including contact and loyalty fields.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.profiles', v_policy.policyname);
  end loop;
end;
$$;

create policy profiles_read_own_or_staff
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_staff_member(auth.uid()));

revoke select on table public.profiles from anon;
grant select on table public.profiles to authenticated;

create or replace function public.is_admin(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user
      and role in ('owner', 'manager')
      and coalesce(is_active, true)
  );
$$;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

-- Access codes are credentials, not public catalog content. Owners may create
-- and inspect them; authenticated users may consume one only through an atomic
-- single-use RPC after signup.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'access_codes'
  loop
    execute format('drop policy %I on public.access_codes', v_policy.policyname);
  end loop;
end;
$$;

create policy access_codes_owner_read
on public.access_codes for select to authenticated
using (public.is_owner(auth.uid()));

create policy access_codes_owner_create
on public.access_codes for insert to authenticated
with check (
  public.is_owner(auth.uid())
  and created_by = auth.uid()
  and role = 'staff'
  and coalesce(used, false) = false
  and code ~ '^[0-9]{5}$'
);

create or replace function public.consume_staff_access_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_access_code_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_code is null or btrim(p_code) !~ '^[0-9]{5}$' then
    raise exception 'Invalid access code' using errcode = '22023';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found
    or v_profile.role is distinct from 'client'
    or coalesce(v_profile.is_active, true) = false then
    raise exception 'The account cannot consume a staff access code' using errcode = '42501';
  end if;

  select access_code.id into v_access_code_id
  from public.access_codes access_code
  where access_code.code = btrim(p_code)
    and access_code.role = 'staff'
    and coalesce(access_code.used, false) = false
  order by access_code.created_at
  limit 1
  for update;

  if not found then
    raise exception 'Access code is invalid or already used' using errcode = 'P0002';
  end if;

  update public.access_codes
  set used = true, used_at = now()
  where id = v_access_code_id
    and coalesce(used, false) = false;

  if not found then
    raise exception 'Access code is already used' using errcode = 'P0001';
  end if;

  update public.profiles
  set role = 'staff'
  where id = v_user_id;
end;
$$;

revoke all on table public.access_codes from anon, authenticated;
grant select, insert on table public.access_codes to authenticated;
revoke all on function public.consume_staff_access_code(text) from public, anon;
grant execute on function public.consume_staff_access_code(text) to authenticated;

-- Restore the intended owner-only write boundary for legacy website content.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'site_images'
  loop
    execute format('drop policy %I on public.site_images', v_policy.policyname);
  end loop;
end;
$$;

create policy site_images_public_read
on public.site_images for select to anon, authenticated
using (true);

create policy site_images_owner_insert
on public.site_images for insert to authenticated
with check (public.is_owner(auth.uid()));

create policy site_images_owner_update
on public.site_images for update to authenticated
using (public.is_owner(auth.uid()))
with check (public.is_owner(auth.uid()));

create policy site_images_owner_delete
on public.site_images for delete to authenticated
using (public.is_owner(auth.uid()));

drop trigger if exists guard_owner_site_image_writes_trigger on public.site_images;
create trigger guard_owner_site_image_writes_trigger
before insert or update or delete on public.site_images
for each row execute function public.guard_active_owner_writes();

revoke all on table public.site_images from anon, authenticated;
grant select on table public.site_images to anon, authenticated;
grant insert, update, delete on table public.site_images to authenticated;

-- Public asset buckets remain readable because the website and apps use public
-- URLs, but only an active owner may change website/product/service assets.
drop policy if exists "Allow public upload" on storage.objects;
drop policy if exists "Allow uploads to site-images" on storage.objects;
drop policy if exists "Authenticated can upload hero images" on storage.objects;
drop policy if exists "Authenticated can update hero images" on storage.objects;
drop policy if exists "Authenticated can delete hero images" on storage.objects;
drop policy if exists "Authenticated can upload product images" on storage.objects;
drop policy if exists "Authenticated can update product images" on storage.objects;
drop policy if exists "Authenticated can delete product images" on storage.objects;
drop policy if exists "Authenticated can upload service images" on storage.objects;
drop policy if exists "Authenticated can update service images" on storage.objects;
drop policy if exists "Authenticated can delete service images" on storage.objects;

drop policy if exists "Owners can upload website assets" on storage.objects;
create policy "Owners can upload website assets"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('hero', 'products', 'services', 'site-images')
  and public.is_owner(auth.uid())
);

drop policy if exists "Owners can update website assets" on storage.objects;
create policy "Owners can update website assets"
on storage.objects for update to authenticated
using (
  bucket_id in ('hero', 'products', 'services', 'site-images')
  and public.is_owner(auth.uid())
)
with check (
  bucket_id in ('hero', 'products', 'services', 'site-images')
  and public.is_owner(auth.uid())
);

drop policy if exists "Owners can delete website assets" on storage.objects;
create policy "Owners can delete website assets"
on storage.objects for delete to authenticated
using (
  bucket_id in ('hero', 'products', 'services', 'site-images')
  and public.is_owner(auth.uid())
);

-- Remove duplicate avatar policies that allowed arbitrary object names. The
-- application always stores the signed-in user's avatar as <user-id>.jpg.
drop policy if exists "Upload Avatars" on storage.objects;
drop policy if exists "Update Own Avatar" on storage.objects;
drop policy if exists "Delete Own Avatar" on storage.objects;
drop policy if exists "Users upload their avatar" on storage.objects;
drop policy if exists "Users update their avatar" on storage.objects;

create policy "Users upload their avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and name = auth.uid()::text || '.jpg'
);

create policy "Users update their avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and name = auth.uid()::text || '.jpg'
)
with check (
  bucket_id = 'avatars'
  and name = auth.uid()::text || '.jpg'
);

create policy "Users delete their avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and name = auth.uid()::text || '.jpg'
);

-- Redemption rows must be visible only to their client or active salon staff.
-- The old "Service role full access" policy was assigned to PUBLIC and exposed
-- every row and mutation to anonymous callers.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'point_redemptions'
  loop
    execute format('drop policy %I on public.point_redemptions', v_policy.policyname);
  end loop;
end;
$$;

create policy point_redemptions_read_own_or_staff
on public.point_redemptions for select to authenticated
using (user_id = auth.uid() or public.is_staff_member(auth.uid()));

revoke all on table public.point_redemptions from anon, authenticated;
grant select on table public.point_redemptions to authenticated;

-- The current apps no longer read the legacy notifications table. Its existing
-- rows contain appointment broadcasts created by the removed trigger, so make
-- them inaccessible through the Data API without deleting historical data.
revoke all on table public.notifications from anon, authenticated;

-- The legacy QR table is empty in the audited database and is read only by the
-- staff scanner's compatibility fallback. Enable RLS and allow only active
-- salon staff to inspect it.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'qr_codes'
  loop
    execute format('drop policy %I on public.qr_codes', v_policy.policyname);
  end loop;
end;
$$;

alter table public.qr_codes enable row level security;
create policy qr_codes_staff_read
on public.qr_codes for select to authenticated
using (public.is_staff_member(auth.uid()));
revoke all on table public.qr_codes from anon, authenticated;
grant select on table public.qr_codes to authenticated;

-- Orders contain names, addresses, phones, emails, and item history. Remove all
-- direct public writes and expose reads only to the owning active client or
-- active salon staff.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'orders'
  loop
    execute format('drop policy %I on public.orders', v_policy.policyname);
  end loop;
end;
$$;

create policy orders_read_own_or_staff
on public.orders for select to authenticated
using (
  public.is_staff_member(auth.uid())
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid()
        and profile.role = 'client'
        and coalesce(profile.is_active, true)
    )
  )
);

revoke all on table public.orders from anon, authenticated;
grant select on table public.orders to authenticated;

-- Checkout is calculated from locked live product and promotion rows. Caller-
-- supplied names, prices, totals, discounts, promo values, and user IDs are
-- never trusted. Online and total inventory are decremented together.
create or replace function public.place_order_with_inventory(
  order_payload jsonb,
  order_items jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_active boolean;
  v_item jsonb;
  v_product public.products%rowtype;
  v_product_id uuid;
  v_quantity_numeric numeric;
  v_quantity integer;
  v_seen_product_ids uuid[] := array[]::uuid[];
  v_effective_price numeric;
  v_server_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_promo public.promo_codes%rowtype;
  v_promo_code text := nullif(upper(btrim(order_payload ->> 'promo_code')), '');
  v_full_name text := nullif(btrim(order_payload ->> 'full_name'), '');
  v_phone text := nullif(btrim(order_payload ->> 'phone'), '');
  v_address text := nullif(btrim(order_payload ->> 'address'), '');
  v_instructions text := coalesce(btrim(order_payload ->> 'instructions'), '');
  v_payment_method text := coalesce(nullif(btrim(order_payload ->> 'payment_method'), ''), 'cash');
  v_display_order_id text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select role, is_active into v_role, v_active
  from public.profiles
  where id = v_user_id
  for share;

  if not found
    or v_role is distinct from 'client'
    or coalesce(v_active, true) = false then
    raise exception 'Only active clients can place orders' using errcode = '42501';
  end if;

  if jsonb_typeof(order_payload) is distinct from 'object'
    or jsonb_typeof(order_items) is distinct from 'array'
    or jsonb_array_length(order_items) = 0
    or jsonb_array_length(order_items) > 100 then
    raise exception 'Invalid order payload' using errcode = '22023';
  end if;

  if v_full_name is null or char_length(v_full_name) > 160
    or v_phone is null or char_length(v_phone) > 50
    or v_address is null or char_length(v_address) > 500
    or char_length(v_instructions) > 1000
    or v_payment_method not in ('cash', 'card') then
    raise exception 'Invalid order details' using errcode = '22023';
  end if;

  for v_item in
    select element.value
    from jsonb_array_elements(order_items) element(value)
    order by element.value ->> 'id'
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or jsonb_typeof(v_item -> 'quantity') is distinct from 'number' then
      raise exception 'Invalid order item' using errcode = '22023';
    end if;

    begin
      v_product_id := (v_item ->> 'id')::uuid;
      v_quantity_numeric := (v_item ->> 'quantity')::numeric;
    exception when others then
      raise exception 'Invalid order item' using errcode = '22023';
    end;

    if v_product_id = any(v_seen_product_ids)
      or v_quantity_numeric <> trunc(v_quantity_numeric)
      or v_quantity_numeric <= 0
      or v_quantity_numeric > 1000 then
      raise exception 'Invalid or duplicate order item' using errcode = '22023';
    end if;
    v_quantity := v_quantity_numeric::integer;

    select * into v_product
    from public.products product
    where product.id = v_product_id
    for update;

    if not found
      or v_product.is_active is distinct from true
      or btrim(v_product.name) = '' then
      raise exception 'Product is unavailable' using errcode = 'P0002';
    end if;

    v_effective_price := case
      when coalesce(v_product.is_on_sale, false) and v_product.sale_price is not null
        then v_product.sale_price
      else v_product.price
    end;

    if v_effective_price is null
      or v_effective_price < 0
      or v_effective_price::text in ('NaN', 'Infinity', '-Infinity')
      or coalesce(v_product.stock_online, 0) < v_quantity
      or coalesce(v_product.stock_quantity, 0) < v_quantity
      or coalesce(v_product.is_out_of_stock, false) then
      raise exception 'Product is unavailable or has insufficient online stock' using errcode = 'P0001';
    end if;

    v_seen_product_ids := array_append(v_seen_product_ids, v_product_id);
    v_subtotal := v_subtotal + (v_effective_price * v_quantity);
    v_server_items := v_server_items || jsonb_build_array(jsonb_build_object(
      'id', v_product.id,
      'name', v_product.name,
      'quantity', v_quantity,
      'price', v_effective_price
    ));
  end loop;

  v_subtotal := round(v_subtotal, 2);

  if v_promo_code is not null then
    select * into v_promo
    from public.promo_codes promo
    where promo.code = v_promo_code
      and promo.is_active is true
      and (promo.expires_at is null or promo.expires_at > now())
    limit 1;

    if not found
      or v_promo.discount_type not in ('percentage', 'fixed')
      or v_promo.discount_value < 0
      or v_promo.discount_value::text in ('NaN', 'Infinity', '-Infinity')
      or (v_promo.discount_type = 'percentage' and v_promo.discount_value > 100) then
      raise exception 'Promotion is invalid or expired' using errcode = '22023';
    end if;

    v_discount := case
      when v_promo.discount_type = 'percentage'
        then round(v_subtotal * v_promo.discount_value / 100, 2)
      else v_promo.discount_value
    end;
  end if;

  v_discount := least(greatest(round(v_discount, 2), 0), v_subtotal);
  v_total := greatest(round(v_subtotal - v_discount, 2), 0);

  for v_item in select value from jsonb_array_elements(v_server_items)
  loop
    v_product_id := (v_item ->> 'id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    update public.products product
    set
      stock_online = product.stock_online - v_quantity,
      stock_quantity = product.stock_quantity - v_quantity,
      is_out_of_stock = (product.stock_online - v_quantity) <= 0
    where product.id = v_product_id
      and product.stock_online >= v_quantity
      and product.stock_quantity >= v_quantity;

    if not found then
      raise exception 'Online stock changed before checkout completed' using errcode = '40001';
    end if;
  end loop;

  insert into public.orders (
    user_id, full_name, phone, address, instructions, payment_method,
    items, subtotal, discount, total, display_order_id, promo_code, status
  ) values (
    v_user_id, v_full_name, v_phone, v_address, v_instructions, v_payment_method,
    v_server_items, v_subtotal, v_discount, v_total,
    public.generate_display_order_id(), v_promo_code, 'pending'
  )
  returning display_order_id into v_display_order_id;

  return v_display_order_id;
end;
$$;

revoke all on function public.place_order_with_inventory(jsonb, jsonb)
  from public, anon;
grant execute on function public.place_order_with_inventory(jsonb, jsonb)
  to authenticated;

-- Client cancellation changes the order through the service-role Edge
-- function. Restore both online and total inventory exactly once when the
-- order first enters either supported canceled spelling.
create or replace function public.restore_order_inventory_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
begin
  if old.status not in ('canceled', 'cancelled')
    and new.status in ('canceled', 'cancelled') then
    for v_item in
      select value
      from jsonb_array_elements(
        case when jsonb_typeof(old.items) = 'array' then old.items else '[]'::jsonb end
      )
    loop
      begin
        v_product_id := (v_item ->> 'id')::uuid;
        v_quantity := (v_item ->> 'quantity')::integer;
      exception when others then
        raise exception 'Stored order item is invalid' using errcode = '22023';
      end;

      if v_quantity <= 0 then
        raise exception 'Stored order quantity is invalid' using errcode = '22023';
      end if;

      update public.products product
      set
        stock_online = coalesce(product.stock_online, 0) + v_quantity,
        stock_quantity = coalesce(product.stock_quantity, 0) + v_quantity,
        is_out_of_stock = false
      where product.id = v_product_id;

      if not found then
        raise exception 'Stored order product no longer exists' using errcode = 'P0002';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists restore_order_inventory_on_cancel_trigger on public.orders;
create trigger restore_order_inventory_on_cancel_trigger
after update of status on public.orders
for each row execute function public.restore_order_inventory_on_cancel();

revoke all on function public.restore_order_inventory_on_cancel()
  from public, anon, authenticated;

-- Fix the live stock helper's ambiguous output-parameter reference and require
-- an active owner. It adjusts total stock only; online stock remains managed by
-- checkout and the product-management source.
create or replace function public.adjust_product_stock(
  product_id uuid,
  quantity_change integer
)
returns table(stock_quantity integer, is_out_of_stock boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock_quantity integer;
  v_is_out_of_stock boolean;
begin
  if not public.is_owner(auth.uid()) then
    raise exception 'Only an active owner may adjust stock' using errcode = '42501';
  end if;

  if quantity_change is null or quantity_change = 0 then
    raise exception 'Invalid stock adjustment' using errcode = '22023';
  end if;

  update public.products product
  set stock_quantity = greatest(coalesce(product.stock_quantity, 0) + $2, 0)
  where product.id = $1
  returning product.stock_quantity, product.is_out_of_stock
  into v_stock_quantity, v_is_out_of_stock;

  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  return query select v_stock_quantity, v_is_out_of_stock;
end;
$$;

revoke all on function public.adjust_product_stock(uuid, integer)
  from public, anon;
grant execute on function public.adjust_product_stock(uuid, integer)
  to authenticated;

-- The old generic point helper had no authorization and is unused by the app.
-- Loyalty mutations now go through the transactional visit/reward RPCs.
revoke all on function public.add_points(uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.add_points(uuid, numeric) to service_role;

-- Statistics contain staff identities and must not bypass RLS for anonymous
-- users. Preserve the current staff home/statistics behavior with an explicit
-- active-staff check.
create or replace function public.appointment_stats_by_user_month()
returns table(user_id uuid, full_name text, avatar_url text, month text, total integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff_member(auth.uid()) then
    raise exception 'Not allowed to view staff appointment statistics' using errcode = '42501';
  end if;

  return query
  select
    appointment.created_by,
    profile.full_name,
    profile.avatar_url,
    to_char(appointment.created_at, 'YYYY-MM'),
    count(*)::integer
  from public.appointments appointment
  join public.profiles profile on profile.id = appointment.created_by
  where appointment.archived = false
    and profile.role in ('staff', 'manager', 'owner')
    and coalesce(profile.is_active, true)
  group by appointment.created_by, profile.full_name, profile.avatar_url,
    to_char(appointment.created_at, 'YYYY-MM')
  order by to_char(appointment.created_at, 'YYYY-MM') desc, count(*) desc;
end;
$$;

create or replace function public.monthly_staff_stats()
returns table(user_id uuid, full_name text, total_appointments integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff_member(auth.uid()) then
    raise exception 'Not allowed to view staff appointment statistics' using errcode = '42501';
  end if;

  return query
  select profile.id, profile.full_name, count(appointment.id)::integer
  from public.profiles profile
  left join public.appointments appointment
    on appointment.created_by = profile.id
    and date_trunc('month', appointment.created_at) = date_trunc('month', now())
  where profile.role in ('staff', 'manager', 'owner')
    and coalesce(profile.is_active, true)
  group by profile.id, profile.full_name
  order by count(appointment.id) desc;
end;
$$;

revoke all on function public.appointment_stats_by_user_month()
  from public, anon;
revoke all on function public.monthly_staff_stats()
  from public, anon;
grant execute on function public.appointment_stats_by_user_month()
  to authenticated;
grant execute on function public.monthly_staff_stats()
  to authenticated;

create or replace function public.owner_broadcast_notification(
  p_title text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner(auth.uid()) then
    raise exception 'Only an active owner can send broadcast notifications' using errcode = '42501';
  end if;

  if p_title is null or btrim(p_title) = '' or char_length(p_title) > 80
    or p_message is null or btrim(p_message) = '' or char_length(p_message) > 500 then
    raise exception 'Invalid notification content' using errcode = '22023';
  end if;

  insert into public.notifications (user_id, title, message, type)
  select profile.id, btrim(p_title), btrim(p_message), 'custom'
  from public.profiles profile
  where profile.role in ('client', 'staff', 'manager', 'owner')
    and coalesce(profile.is_active, true);
end;
$$;

revoke all on function public.owner_broadcast_notification(text, text)
  from public, anon;
grant execute on function public.owner_broadcast_notification(text, text)
  to authenticated;

-- Trigger functions do not need direct API execution privileges. Pin mutable
-- search paths and remove direct execution where PostgreSQL triggers invoke
-- them internally.
alter function public.handle_new_user() set search_path = public;
alter function public.sync_signup_profile_metadata() set search_path = public;
alter function public.jsonb_diff(jsonb, jsonb) set search_path = public;
alter function public.set_used_at() set search_path = public;
alter function public.attach_client_name_to_audit_log() set search_path = public;
alter function public.handle_order_completed_points() set search_path = public;
alter function public.handle_order_deleted_points() set search_path = public;
alter function public.log_admin_change() set search_path = public;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_signup_profile_metadata() from public, anon, authenticated;
revoke all on function public.set_used_at() from public, anon, authenticated;
revoke all on function public.attach_client_name_to_audit_log() from public, anon, authenticated;
revoke all on function public.handle_order_completed_points() from public, anon, authenticated;
revoke all on function public.handle_order_deleted_points() from public, anon, authenticated;
revoke all on function public.log_admin_change() from public, anon, authenticated;

-- This unused view was created as a security-definer view and granted broadly.
-- Keep the object for compatibility but remove API visibility and make any
-- privileged direct use honor the caller's policies.
alter view public.staff_appointment_stats set (security_invoker = true);
revoke all on table public.staff_appointment_stats from public, anon, authenticated;

-- The helper is used by authenticated policies and RPCs only.
revoke all on function public.is_staff_member(uuid) from public, anon;
grant execute on function public.is_staff_member(uuid) to authenticated;
revoke all on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_owner(uuid) to authenticated;
