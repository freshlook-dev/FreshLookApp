-- Harden reward redemption and device push-token ownership at the database
-- boundary. Existing UI flows keep the same function signatures.

create or replace function public.create_point_redemption_qr(
  p_points integer,
  p_expires_at timestamp with time zone default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_active boolean;
  v_balance integer;
  v_reserved_points bigint;
  v_redemption public.point_redemptions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Nuk jeni te kycur' using errcode = '28000';
  end if;

  if p_points is null or p_points < 10 then
    raise exception 'Minimumi per shperblim eshte 10 Fresh Points' using errcode = '22023';
  end if;

  -- Serialize QR creation with every other balance-sensitive operation for
  -- this client. This closes concurrent over-reservation of the same points.
  select role, is_active, coalesce(points, 0)
    into v_role, v_active, v_balance
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Profili i klientit nuk u gjet' using errcode = 'P0002';
  end if;

  if coalesce(v_active, true) = false or v_role is distinct from 'client' then
    raise exception 'Vetem klientet aktive mund te krijojne kode QR shperblimi' using errcode = '42501';
  end if;

  select coalesce(sum(points), 0)
    into v_reserved_points
  from public.point_redemptions
  where user_id = v_user_id
    and status = 'pending'
    and (expires_at is null or expires_at > now());

  if v_balance - v_reserved_points < p_points then
    raise exception 'Nuk keni mjaftueshem Fresh Points te pa rezervuara' using errcode = 'P0001';
  end if;

  -- Reward QRs are intentionally non-expiring. Keep p_expires_at in the
  -- signature for compatibility with older clients, but never trust it to
  -- change the current reward rule.
  insert into public.point_redemptions (user_id, points, status, expires_at)
  values (v_user_id, p_points, 'pending', null)
  returning * into v_redemption;

  return jsonb_build_object(
    'id', v_redemption.id,
    'user_id', v_redemption.user_id,
    'points', v_redemption.points,
    'status', v_redemption.status,
    'expires_at', v_redemption.expires_at,
    'created_at', v_redemption.created_at
  );
end;
$$;

revoke all on function public.create_point_redemption_qr(integer, timestamp with time zone)
  from public, anon;
grant execute on function public.create_point_redemption_qr(integer, timestamp with time zone)
  to authenticated;

create or replace function public.redeem_points_qr(
  p_redemption_id uuid,
  p_scanned_at timestamp with time zone default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_actor_active boolean;
  v_client_role text;
  v_client_active boolean;
  v_redemption public.point_redemptions%rowtype;
  v_previous_points integer;
  v_new_points integer;
  v_scanned_at timestamp with time zone := now();
begin
  if v_actor_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select role, is_active
    into v_actor_role, v_actor_active
  from public.profiles
  where id = v_actor_id
  for share;

  if not found
    or coalesce(v_actor_active, true) = false
    or v_actor_role is null
    or v_actor_role not in ('staff', 'manager', 'owner') then
    raise exception 'Not allowed to redeem QR discounts' using errcode = '42501';
  end if;

  select *
    into v_redemption
  from public.point_redemptions
  where id = p_redemption_id
  for update;

  if not found then
    raise exception 'QR nuk u gjet' using errcode = 'P0002';
  end if;

  if v_redemption.status is distinct from 'pending' then
    raise exception 'QR nuk eshte pending: %', v_redemption.status using errcode = 'P0001';
  end if;

  if v_redemption.expires_at is not null and v_redemption.expires_at <= now() then
    raise exception 'QR ka skaduar' using errcode = 'P0001';
  end if;

  if coalesce(v_redemption.points, 0) <= 0 then
    raise exception 'QR ka vlere te pavlefshme' using errcode = '22023';
  end if;

  select role, is_active, coalesce(points, 0)
    into v_client_role, v_client_active, v_previous_points
  from public.profiles
  where id = v_redemption.user_id
  for update;

  if not found then
    raise exception 'Profili i klientit nuk u gjet' using errcode = 'P0002';
  end if;

  if v_client_role is distinct from 'client' or coalesce(v_client_active, true) = false then
    raise exception 'Profili i klientit nuk eshte aktiv' using errcode = '42501';
  end if;

  if v_previous_points < v_redemption.points then
    raise exception 'Klienti nuk ka me pike te mjaftueshme per kete QR' using errcode = 'P0001';
  end if;

  v_new_points := v_previous_points - v_redemption.points;

  update public.profiles
  set points = v_new_points
  where id = v_redemption.user_id;

  update public.point_redemptions
  set
    status = 'used',
    scanned_by = v_actor_id,
    scanned_at = v_scanned_at
  where id = v_redemption.id
    and status = 'pending'
  returning * into v_redemption;

  if not found then
    raise exception 'QR nuk mund te perdoret me' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'redemption', jsonb_build_object(
      'id', v_redemption.id,
      'user_id', v_redemption.user_id,
      'points', v_redemption.points,
      'status', v_redemption.status,
      'expires_at', v_redemption.expires_at,
      'created_at', v_redemption.created_at,
      'scanned_by', v_redemption.scanned_by,
      'scanned_at', v_redemption.scanned_at
    ),
    'previous_points', v_previous_points,
    'new_points', v_new_points,
    'deducted_points', v_redemption.points
  );
end;
$$;

revoke all on function public.redeem_points_qr(uuid, timestamp with time zone)
  from public, anon;
grant execute on function public.redeem_points_qr(uuid, timestamp with time zone)
  to authenticated;

-- Reward state changes must go through the validated RPCs above (or the
-- existing user-scoped delete RPC), never through a client-side table write.
update public.point_redemptions
set status = 'expired'
where status = 'pending'
  and expires_at is not null
  and expires_at <= now();

revoke insert, update, delete on table public.point_redemptions from public, anon, authenticated;
grant select on table public.point_redemptions to authenticated;
revoke all on function public.delete_pending_reward_qr(uuid) from public, anon;
grant execute on function public.delete_pending_reward_qr(uuid) to authenticated;

create or replace function public.register_visit_atomic(
  p_appointment_id uuid,
  p_payment_method text,
  p_paid_cash numeric,
  p_paid_bank numeric,
  p_visit_notes text,
  p_selected_treatments jsonb,
  p_total_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_actor_active boolean;
  v_appointment public.appointments%rowtype;
  v_client_role text;
  v_client_active boolean;
  v_current_points integer;
  v_new_points integer;
  v_requested_delta integer := 0;
  v_actual_delta integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select role, is_active
    into v_actor_role, v_actor_active
  from public.profiles
  where id = auth.uid()
  for share;

  if not found
    or coalesce(v_actor_active, true) = false
    or v_actor_role is null
    or v_actor_role not in ('manager', 'owner') then
    raise exception 'Not allowed to register visits' using errcode = '42501';
  end if;

  if p_payment_method is null
    or p_payment_method not in ('cash', 'bank', 'mixed')
    or p_total_amount is null
    or p_total_amount <= 0
    or coalesce(p_paid_cash, 0) < 0
    or coalesce(p_paid_bank, 0) < 0
    or (
      case
        when jsonb_typeof(p_selected_treatments) = 'array'
          then jsonb_array_length(p_selected_treatments) = 0
        else true
      end
    )
    or (p_payment_method = 'cash' and (
      abs(coalesce(p_paid_cash, 0) - p_total_amount) >= 0.01
      or coalesce(p_paid_bank, 0) <> 0
    ))
    or (p_payment_method = 'bank' and (
      abs(coalesce(p_paid_bank, 0) - p_total_amount) >= 0.01
      or coalesce(p_paid_cash, 0) <> 0
    ))
    or (p_payment_method = 'mixed' and
      abs(coalesce(p_paid_cash, 0) + coalesce(p_paid_bank, 0) - p_total_amount) >= 0.01
    ) then
    raise exception 'Invalid visit payment details' using errcode = '22023';
  end if;

  select *
    into v_appointment
  from public.appointments
  where id = p_appointment_id
    and coalesce(archived, false) = false
    and status in ('upcoming', 'arrived')
  for update;

  if not found then
    raise exception 'Appointment was archived or no longer exists' using errcode = 'P0002';
  end if;

  if v_actor_role = 'manager' and v_appointment.payment_method is not null then
    raise exception 'Managers cannot edit an already registered visit' using errcode = '42501';
  end if;

  -- Older registered visits predate total_amount. Their historical point award
  -- cannot be reconstructed safely, so an owner re-edit preserves the current
  -- balance instead of treating the unknown old total as zero and awarding the
  -- full visit a second time.
  if v_appointment.payment_method is not null
    and v_appointment.total_amount is null then
    v_requested_delta := 0;
  else
    v_requested_delta := floor(p_total_amount / 2)::integer
      - case
          when v_appointment.payment_method is null then 0
          else floor(coalesce(v_appointment.total_amount, 0) / 2)::integer
        end;
  end if;

  if v_appointment.user_id is not null and v_requested_delta <> 0 then
    select role, is_active, coalesce(points, 0)
      into v_client_role, v_client_active, v_current_points
    from public.profiles
    where id = v_appointment.user_id
    for update;

    if not found or v_client_role is distinct from 'client' then
      raise exception 'Client profile was not found' using errcode = 'P0002';
    end if;

    if coalesce(v_client_active, true) = false then
      raise exception 'Client profile is inactive' using errcode = '42501';
    end if;

    v_new_points := greatest(0, v_current_points + v_requested_delta);
    v_actual_delta := v_new_points - v_current_points;

    update public.profiles
    set points = v_new_points
    where id = v_appointment.user_id;
  end if;

  update public.appointments
  set
    status = 'arrived',
    payment_method = p_payment_method,
    paid_cash = p_paid_cash,
    paid_bank = p_paid_bank,
    visit_notes = nullif(btrim(p_visit_notes), ''),
    selected_treatments = p_selected_treatments,
    total_amount = p_total_amount
  where id = v_appointment.id;

  return jsonb_build_object(
    'appointment_id', v_appointment.id,
    'client_user_id', v_appointment.user_id,
    'requested_points_delta', v_requested_delta,
    'points_delta', v_actual_delta,
    'previous_points', v_current_points,
    'new_points', v_new_points
  );
end;
$$;

create or replace function public.set_appointment_status_atomic(
  p_appointment_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_actor_active boolean;
  v_appointment public.appointments%rowtype;
  v_client_role text;
  v_points_to_remove integer := 0;
  v_current_points integer;
  v_new_points integer;
  v_clears_registered_visit boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select role, is_active
    into v_actor_role, v_actor_active
  from public.profiles
  where id = auth.uid()
  for share;

  if not found
    or coalesce(v_actor_active, true) = false
    or v_actor_role is null
    or v_actor_role not in ('staff', 'manager', 'owner') then
    raise exception 'Not allowed to change appointment status' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('arrived', 'canceled', 'upcoming') then
    raise exception 'Invalid appointment status' using errcode = '22023';
  end if;

  select *
    into v_appointment
  from public.appointments
  where id = p_appointment_id
    and coalesce(archived, false) = false
  for update;

  if not found then
    raise exception 'Appointment was archived or no longer exists' using errcode = 'P0002';
  end if;

  v_clears_registered_visit := p_status <> 'arrived'
    and v_appointment.payment_method is not null;

  if v_clears_registered_visit and v_appointment.user_id is not null then
    v_points_to_remove := floor(coalesce(v_appointment.total_amount, 0) / 2)::integer;

    if v_points_to_remove > 0 then
      select role, coalesce(points, 0)
        into v_client_role, v_current_points
      from public.profiles
      where id = v_appointment.user_id
      for update;

      if not found or v_client_role is distinct from 'client' then
        raise exception 'Client profile was not found' using errcode = 'P0002';
      end if;

      v_new_points := greatest(0, v_current_points - v_points_to_remove);
      update public.profiles
      set points = v_new_points
      where id = v_appointment.user_id;
    end if;
  end if;

  if v_clears_registered_visit then
    update public.appointments
    set
      status = p_status,
      payment_method = null,
      paid_cash = null,
      paid_bank = null,
      visit_notes = null,
      selected_treatments = null,
      total_amount = null
    where id = v_appointment.id;
  else
    update public.appointments
    set status = p_status
    where id = v_appointment.id;
  end if;

  return jsonb_build_object(
    'appointment_id', v_appointment.id,
    'old_status', v_appointment.status,
    'new_status', p_status,
    'cleared_registered_visit', v_clears_registered_visit,
    'points_removed', coalesce(v_current_points - v_new_points, 0),
    'previous_points', v_current_points,
    'new_points', v_new_points
  );
end;
$$;

revoke all on function public.register_visit_atomic(uuid, text, numeric, numeric, text, jsonb, numeric)
  from public, anon;
revoke all on function public.set_appointment_status_atomic(uuid, text)
  from public, anon;
grant execute on function public.register_visit_atomic(uuid, text, numeric, numeric, text, jsonb, numeric)
  to authenticated;
grant execute on function public.set_appointment_status_atomic(uuid, text)
  to authenticated;

-- Keep the broad row-level appointment update permission needed by the
-- existing reschedule/cancel UI, but prevent it from becoming a way to forge
-- a registered/paid visit. Security-definer RPCs above execute as their
-- privileged owner and therefore remain the only client-facing payment path.
create or replace function public.client_service_names_are_current(p_service text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_names text[];
  v_name text;
  v_seen_names text[] := array[]::text[];
  v_match_count integer;
begin
  if p_service is null
    or btrim(p_service) = ''
    or char_length(p_service) > 1000 then
    return false;
  end if;

  -- A service name itself may contain a comma. Prefer one unambiguous exact
  -- catalog match before interpreting the value as a legacy comma-separated
  -- list of service names.
  select count(*)::integer
    into v_match_count
  from public.services
  where name = btrim(p_service)
    and coalesce(is_active, false);

  if v_match_count = 1 then
    return true;
  elsif v_match_count > 1 then
    return false;
  end if;

  v_names := regexp_split_to_array(btrim(p_service), '\s*,\s*');
  if coalesce(array_length(v_names, 1), 0) = 0
    or array_length(v_names, 1) > 100 then
    return false;
  end if;

  foreach v_name in array v_names
  loop
    v_name := btrim(v_name);
    if v_name = '' or v_name = any(v_seen_names) then
      return false;
    end if;

    select count(*)::integer
      into v_match_count
    from public.services
    where name = v_name
      and coalesce(is_active, false);

    if v_match_count <> 1 then
      return false;
    end if;

    v_seen_names := array_append(v_seen_names, v_name);
  end loop;

  return true;
end;
$$;

revoke all on function public.client_service_names_are_current(text)
  from public, anon, authenticated;
grant execute on function public.client_service_names_are_current(text)
  to anon, authenticated;

create or replace function public.client_treatment_snapshot_is_current(
  p_snapshot jsonb,
  p_service text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_service_id text;
  v_seen_ids text[] := array[]::text[];
  v_names text := '';
  v_price numeric;
  v_qty numeric;
  v_total numeric;
  v_duration numeric;
  v_expected_price numeric;
  v_service record;
begin
  if jsonb_typeof(p_snapshot) is distinct from 'array'
    or jsonb_array_length(p_snapshot) = 0
    or jsonb_array_length(p_snapshot) > 100 then
    return false;
  end if;

  for v_item in select value from jsonb_array_elements(p_snapshot)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or jsonb_typeof(v_item -> 'price') is distinct from 'number'
      or jsonb_typeof(v_item -> 'qty') is distinct from 'number'
      or jsonb_typeof(v_item -> 'total') is distinct from 'number' then
      return false;
    end if;

    v_service_id := nullif(btrim(v_item ->> 'id'), '');
    if v_service_id is null or v_service_id = any(v_seen_ids) then
      return false;
    end if;

    if (v_item ? 'duration')
      and jsonb_typeof(v_item -> 'duration') is distinct from 'number' then
      return false;
    end if;

    select id, name, price, duration, is_on_sale, sale_price
      into v_service
    from public.services
    where id::text = v_service_id
      and coalesce(is_active, false)
    limit 1;

    if not found or (v_item ->> 'name') is distinct from v_service.name then
      return false;
    end if;

    begin
      v_price := (v_item ->> 'price')::numeric;
      v_qty := (v_item ->> 'qty')::numeric;
      v_total := (v_item ->> 'total')::numeric;
      v_duration := case
        when v_item ? 'duration' then (v_item ->> 'duration')::numeric
        else null
      end;
    exception when others then
      return false;
    end;

    v_expected_price := case
      when coalesce(v_service.is_on_sale, false) and v_service.sale_price is not null
        then v_service.sale_price
      else v_service.price
    end;

    if v_expected_price is null
      or v_price < 0
      or v_qty <> 1
      or v_price <> v_expected_price
      or v_total <> v_price
      or (
        v_item ? 'duration'
        and v_duration is distinct from v_service.duration::numeric
      ) then
      return false;
    end if;

    v_seen_ids := array_append(v_seen_ids, v_service_id);
    v_names := case
      when v_names = '' then v_service.name
      else v_names || ', ' || v_service.name
    end;
  end loop;

  return coalesce(v_names = p_service, false);
end;
$$;

revoke all on function public.client_treatment_snapshot_is_current(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.client_treatment_snapshot_is_current(jsonb, text)
  to anon, authenticated;

create or replace function public.guard_appointment_direct_writes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_actor_active boolean;
begin
  if current_user not in ('anon', 'authenticated') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Preserve a public website's possible anonymous booking insert while still
  -- ensuring it can only create a normal unpaid/upcoming appointment. Anonymous
  -- callers never receive a direct appointment-update path from this guard.
  if current_user = 'anon' then
    if tg_op = 'INSERT'
      and new.payment_method is null
      and new.paid_cash is null
      and new.paid_bank is null
      and new.visit_notes is null
      and new.total_amount is null
      and new.status is not distinct from 'upcoming'
      and coalesce(new.archived, false) = false
      and new.user_id is null
      and new.created_by is null
      and new.client_name is not null
      and btrim(regexp_replace(new.client_name, '\s+', ' ', 'g')) <> ''
      and new.appointment_date is not null
      and new.appointment_time is not null
      and new.location is not null
      and btrim(regexp_replace(new.location, '\s+', ' ', 'g')) <> ''
      and (new.appointment_date + new.appointment_time) at time zone 'Europe/Belgrade'
        >= now() + interval '30 minutes'
      and (
        (
          new.selected_treatments is null
          and public.client_service_names_are_current(new.service)
        )
        or (
          new.selected_treatments is not null
          and public.client_treatment_snapshot_is_current(
            new.selected_treatments,
            new.service
          )
        )
      ) then
      return new;
    end if;

    raise exception 'Anonymous appointment write is not allowed' using errcode = '42501';
  end if;

  select role, is_active
    into v_actor_role, v_actor_active
  from public.profiles
  where id = v_actor_id;

  if not found
    or coalesce(v_actor_active, true) = false
    or v_actor_role is null
    or v_actor_role not in ('client', 'staff', 'manager', 'owner') then
    raise exception 'Active appointment profile not found' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Appointments cannot be deleted directly' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.payment_method is not null
      or new.paid_cash is not null
      or new.paid_bank is not null
      or new.visit_notes is not null
      or new.total_amount is not null
      or new.status is distinct from 'upcoming'
      or coalesce(new.archived, false) then
      raise exception 'New appointments must start as unpaid and upcoming' using errcode = '42501';
    end if;

    if new.client_name is null
      or btrim(regexp_replace(new.client_name, '\s+', ' ', 'g')) = ''
      or new.appointment_date is null
      or new.appointment_time is null
      or new.location is null
      or btrim(regexp_replace(new.location, '\s+', ' ', 'g')) = '' then
      raise exception 'New appointments require complete booking details' using errcode = '22023';
    end if;

    if (
      new.selected_treatments is null
      and not public.client_service_names_are_current(new.service)
    ) or (
      new.selected_treatments is not null
      and not public.client_treatment_snapshot_is_current(
          new.selected_treatments,
          new.service
        )
    ) then
      raise exception 'Treatment snapshot does not match the live catalog' using errcode = '22023';
    end if;

    if v_actor_role = 'client' then
      if new.user_id is distinct from v_actor_id or new.created_by is not null then
        raise exception 'Clients can only create their own appointments' using errcode = '42501';
      end if;

      if new.appointment_date is null
        or new.appointment_time is null
        or (new.appointment_date + new.appointment_time) at time zone 'Europe/Belgrade'
          < now() + interval '30 minutes' then
        raise exception 'Appointments require at least 30 minutes notice' using errcode = '22023';
      end if;

    elsif new.created_by is distinct from v_actor_id then
      raise exception 'Staff appointments must identify their creator' using errcode = '42501';
    end if;

    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'Appointment identity cannot be changed' using errcode = '42501';
  end if;

  if new.payment_method is distinct from old.payment_method
    or new.paid_cash is distinct from old.paid_cash
    or new.paid_bank is distinct from old.paid_bank
    or new.visit_notes is distinct from old.visit_notes
    or new.total_amount is distinct from old.total_amount then
    raise exception 'Visit payment fields must be changed through the visit RPC' using errcode = '42501';
  end if;

  if old.payment_method is not null
    and (
      new.status is distinct from old.status
      or new.client_name is distinct from old.client_name
      or new.phone is distinct from old.phone
      or new.service is distinct from old.service
      or new.appointment_date is distinct from old.appointment_date
      or new.appointment_time is distinct from old.appointment_time
      or new.location is distinct from old.location
      or new.comment is distinct from old.comment
      or new.selected_treatments is distinct from old.selected_treatments
      or new.user_id is distinct from old.user_id
    ) then
    raise exception 'Registered visits must be changed through the visit RPCs' using errcode = '42501';
  end if;

  if old.payment_method is null
    and (
      new.service is distinct from old.service
      or new.selected_treatments is distinct from old.selected_treatments
    )
    and (
      (
        new.selected_treatments is null
        and not public.client_service_names_are_current(new.service)
      )
      or (
        new.selected_treatments is not null
        and not public.client_treatment_snapshot_is_current(
          new.selected_treatments,
          new.service
        )
      )
    ) then
    raise exception 'Treatment snapshot does not match the live catalog' using errcode = '22023';
  end if;

  if v_actor_role = 'client' then
    if old.user_id is distinct from v_actor_id
      or new.user_id is distinct from v_actor_id
      or old.status is distinct from 'upcoming'
      or new.status is null
      or new.status not in ('upcoming', 'canceled')
      or coalesce(old.archived, false)
      or coalesce(new.archived, false)
      or new.client_name is distinct from old.client_name
      or new.phone is distinct from old.phone
      or new.service is distinct from old.service
      or new.created_by is distinct from old.created_by then
      raise exception 'Clients may only reschedule or cancel their own upcoming appointment' using errcode = '42501';
    end if;

    if (
      new.appointment_date is distinct from old.appointment_date
      or new.appointment_time is distinct from old.appointment_time
      or new.location is distinct from old.location
    ) and (
      new.appointment_date is null
      or new.appointment_time is null
      or (new.appointment_date + new.appointment_time) at time zone 'Europe/Belgrade'
        < now() + interval '30 minutes'
    ) then
      raise exception 'Appointment changes require at least 30 minutes notice' using errcode = '22023';
    end if;

    if new.status = 'canceled'
      and (
        new.appointment_date is distinct from old.appointment_date
        or new.appointment_time is distinct from old.appointment_time
        or new.location is distinct from old.location
        or new.comment is distinct from old.comment
        or new.selected_treatments is distinct from old.selected_treatments
      ) then
      raise exception 'Cancellation cannot rewrite appointment details' using errcode = '42501';
    end if;

    if new.selected_treatments is distinct from old.selected_treatments
      and not public.client_treatment_snapshot_is_current(
        new.selected_treatments,
        new.service
      ) then
      raise exception 'Treatment snapshot does not match the live catalog' using errcode = '22023';
    end if;
  elsif v_actor_role = 'staff' then
    if old.status is distinct from 'upcoming'
      or new.status is null
      or new.status not in ('arrived', 'canceled')
      or new.archived is distinct from old.archived
      or new.client_name is distinct from old.client_name
      or new.phone is distinct from old.phone
      or new.service is distinct from old.service
      or new.appointment_date is distinct from old.appointment_date
      or new.appointment_time is distinct from old.appointment_time
      or new.location is distinct from old.location
      or new.comment is distinct from old.comment
      or new.created_by is distinct from old.created_by
      or new.user_id is distinct from old.user_id
      or new.selected_treatments is distinct from old.selected_treatments then
      raise exception 'Staff may only mark an upcoming appointment arrived or canceled' using errcode = '42501';
    end if;
  elsif v_actor_role = 'manager' then
    if new.created_by is distinct from old.created_by
      or new.user_id is distinct from old.user_id then
      raise exception 'Only an owner may reassign an appointment' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_appointment_direct_writes_trigger on public.appointments;
create trigger guard_appointment_direct_writes_trigger
before insert or update or delete on public.appointments
for each row
execute function public.guard_appointment_direct_writes();

-- The client and website both check availability before saving, but that
-- read-then-write check can race. Serialize each active salon slot inside the
-- transaction and make the database the final authority for availability.
create or replace function public.prevent_appointment_slot_conflicts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_key text;
begin
  if new.status is not distinct from 'upcoming'
    and coalesce(new.archived, false) = false
    and (
      tg_op = 'INSERT'
      or new.client_name is distinct from old.client_name
      or new.phone is distinct from old.phone
      or new.service is distinct from old.service
      or new.appointment_date is distinct from old.appointment_date
      or new.appointment_time is distinct from old.appointment_time
      or new.location is distinct from old.location
      or new.status is distinct from old.status
      or new.archived is distinct from old.archived
    )
    and (
      new.client_name is null
      or btrim(regexp_replace(new.client_name, '\s+', ' ', 'g')) = ''
      or new.phone is null
      or btrim(regexp_replace(new.phone, '\s+', ' ', 'g')) = ''
      or new.service is null
      or btrim(regexp_replace(new.service, '\s+', ' ', 'g')) = ''
      or new.appointment_date is null
      or new.appointment_time is null
      or new.location is null
      or btrim(regexp_replace(new.location, '\s+', ' ', 'g')) = ''
    ) then
    raise exception 'Active appointments require complete booking details' using errcode = '22023';
  end if;

  if new.status is not distinct from 'upcoming'
    and coalesce(new.archived, false) = false
    and new.appointment_date is not null
    and new.appointment_time is not null
    and new.location is not null
    and (
      tg_op = 'INSERT'
      or new.appointment_date is distinct from old.appointment_date
      or new.appointment_time is distinct from old.appointment_time
      or new.location is distinct from old.location
      or new.status is distinct from old.status
      or new.archived is distinct from old.archived
    ) then
    v_slot_key := new.appointment_date::text
      || '|' || new.appointment_time::text
      || '|' || lower(btrim(regexp_replace(new.location, '\s+', ' ', 'g')));
    perform pg_advisory_xact_lock(hashtextextended(v_slot_key, 0));

    if exists (
      select 1
      from public.appointments appointment
      where appointment.id is distinct from new.id
        and appointment.appointment_date = new.appointment_date
        and appointment.appointment_time = new.appointment_time
        and lower(btrim(regexp_replace(appointment.location, '\s+', ' ', 'g')))
          = lower(btrim(regexp_replace(new.location, '\s+', ' ', 'g')))
        and appointment.status = 'upcoming'
        and coalesce(appointment.archived, false) = false
    ) then
      raise exception 'This appointment slot is no longer available' using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_appointment_slot_conflicts_trigger on public.appointments;
create trigger prevent_appointment_slot_conflicts_trigger
before insert or update on public.appointments
for each row
execute function public.prevent_appointment_slot_conflicts();

-- Profile self-service writes must stay on the caller's own row and must never
-- let a crafted request change authorization or loyalty fields. Direct owner
-- updates remain available for the existing user-management screen;
-- security-definer business RPCs and the service role are unaffected.
create or replace function public.guard_profile_direct_writes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if current_user = 'anon' or tg_op is distinct from 'UPDATE' then
    raise exception 'Profiles cannot be created or deleted directly' using errcode = '42501';
  end if;

  if new.id is distinct from old.id then
    raise exception 'Profile identity cannot be changed' using errcode = '42501';
  end if;

  if public.is_owner(auth.uid()) then
    return new;
  end if;

  if auth.uid() is null
    or old.id is distinct from auth.uid()
    or new.id is distinct from auth.uid()
    or new.points is distinct from old.points
    or new.role is distinct from old.role
    or new.is_active is distinct from old.is_active then
    raise exception 'Not allowed to change this profile' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_sensitive_updates_trigger on public.profiles;
drop trigger if exists guard_profile_direct_writes_trigger on public.profiles;
create trigger guard_profile_direct_writes_trigger
before insert or update or delete on public.profiles
for each row
execute function public.guard_profile_direct_writes();

-- Catalog rows are consumed by the public website, staff appointment screens,
-- client booking, cart, and checkout. Keep all those readers synchronized by
-- ensuring only an active owner (or a trusted service-role backend) can mutate
-- their shared database source.
create or replace function public.guard_active_owner_writes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if not public.is_owner(auth.uid()) then
      raise exception 'Only an active owner may perform this write' using errcode = '42501';
    end if;

    if tg_table_name = 'access_codes' and tg_op = 'INSERT' then
      if (
        new.created_by is distinct from auth.uid()
        or new.role is distinct from 'staff'
        or coalesce(new.used, false)
        or new.code is null
        or new.code !~ '^[0-9]{5}$'
      ) then
        raise exception 'Invalid staff access code' using errcode = '22023';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_table_name = 'services' then
    if new.name is null
      or btrim(regexp_replace(new.name, '\s+', ' ', 'g')) = ''
      or new.price is null
      or new.price::text in ('NaN', 'Infinity', '-Infinity')
      or new.price < 0
      or new.duration is null
      or new.duration <= 0
      or (
        new.is_on_sale is true
        and (
          new.sale_price is null
          or new.sale_price::text in ('NaN', 'Infinity', '-Infinity')
          or new.sale_price < 0
        )
      ) then
      raise exception 'Invalid service catalog values' using errcode = '22023';
    end if;

    if tg_op = 'UPDATE' and new.id is distinct from old.id then
      raise exception 'Service identity cannot be changed' using errcode = '42501';
    end if;
  elsif tg_table_name = 'products' then
    if new.name is null
      or btrim(regexp_replace(new.name, '\s+', ' ', 'g')) = ''
      or new.price is null
      or new.price::text in ('NaN', 'Infinity', '-Infinity')
      or new.price < 0
      or (
        new.is_on_sale is true
        and (
          new.sale_price is null
          or new.sale_price::text in ('NaN', 'Infinity', '-Infinity')
          or new.sale_price < 0
        )
      ) then
      raise exception 'Invalid product catalog values' using errcode = '22023';
    end if;

    if tg_op = 'UPDATE' and new.id is distinct from old.id then
      raise exception 'Product identity cannot be changed' using errcode = '42501';
    end if;
  elsif tg_table_name = 'content' then
    if new.key is null
      or btrim(regexp_replace(new.key, '\s+', ' ', 'g')) = '' then
      raise exception 'Invalid content key' using errcode = '22023';
    end if;

    if tg_op = 'UPDATE' and new.key is distinct from old.key then
      raise exception 'Content identity cannot be changed' using errcode = '42501';
    end if;
  elsif tg_table_name = 'promo_codes' then
    if new.code is null
      or btrim(regexp_replace(new.code, '\s+', ' ', 'g')) = ''
      or new.discount_type is null
      or new.discount_type not in ('percentage', 'fixed')
      or new.discount_value is null
      or new.discount_value::text in ('NaN', 'Infinity', '-Infinity')
      or new.discount_value < 0
      or (new.discount_type = 'percentage' and new.discount_value > 100) then
      raise exception 'Invalid promotion values' using errcode = '22023';
    end if;

    if tg_op = 'UPDATE' and new.code is distinct from old.code then
      raise exception 'Promotion identity cannot be changed' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_owner_service_writes_trigger on public.services;
create trigger guard_owner_service_writes_trigger
before insert or update or delete on public.services
for each row
execute function public.guard_active_owner_writes();

drop trigger if exists guard_owner_product_writes_trigger on public.products;
drop trigger if exists guard_owner_product_create_delete_trigger on public.products;
drop trigger if exists guard_owner_product_catalog_update_trigger on public.products;
create trigger guard_owner_product_create_delete_trigger
before insert or delete on public.products
for each row
execute function public.guard_active_owner_writes();

-- Inventory quantities are intentionally excluded because checkout's existing
-- inventory RPC owns those mutations. Product presentation/pricing remains
-- owner-only even if a crafted client request reaches the table directly.
create trigger guard_owner_product_catalog_update_trigger
before update of id, name, subtitle, description, price, sale_price, is_on_sale, image_url, is_active
on public.products
for each row
execute function public.guard_active_owner_writes();

drop trigger if exists guard_owner_content_writes_trigger on public.content;
create trigger guard_owner_content_writes_trigger
before insert or update or delete on public.content
for each row
execute function public.guard_active_owner_writes();

drop trigger if exists guard_owner_promo_code_writes_trigger on public.promo_codes;
create trigger guard_owner_promo_code_writes_trigger
before insert or update or delete on public.promo_codes
for each row
execute function public.guard_active_owner_writes();

drop trigger if exists guard_owner_access_code_create_trigger on public.access_codes;
create trigger guard_owner_access_code_create_trigger
before insert on public.access_codes
for each row
execute function public.guard_active_owner_writes();

-- Operational audit history is append-only from the application boundary and
-- must always identify the active staff member who performed the action.
create or replace function public.guard_audit_log_writes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
begin
  if current_user not in ('anon', 'authenticated') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op is distinct from 'INSERT' then
    raise exception 'Audit logs are append-only' using errcode = '42501';
  end if;

  select role, is_active
    into v_role, v_active
  from public.profiles
  where id = auth.uid();

  if not found
    or coalesce(v_active, true) = false
    or v_role is null
    or v_role not in ('staff', 'manager', 'owner')
    or new.actor_id is distinct from auth.uid() then
    raise exception 'Invalid audit-log actor' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_audit_log_writes_trigger on public.audit_logs;
create trigger guard_audit_log_writes_trigger
before insert or update or delete on public.audit_logs
for each row
execute function public.guard_audit_log_writes();

create or replace function public.register_push_token(
  p_expo_push_token text,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
      and role in ('client', 'staff', 'manager', 'owner')
      and coalesce(is_active, true)
  ) then
    raise exception 'Active profile not found' using errcode = '42501';
  end if;

  if p_expo_push_token is null
    or btrim(p_expo_push_token) = ''
    or char_length(p_expo_push_token) > 255 then
    raise exception 'Invalid Expo push token' using errcode = '22023';
  end if;

  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'Invalid push platform' using errcode = '22023';
  end if;

  insert into public.push_tokens (user_id, expo_push_token, platform, updated_at)
  values (v_user_id, btrim(p_expo_push_token), p_platform, now())
  on conflict (expo_push_token) do update
  set
    user_id = excluded.user_id,
    platform = excluded.platform,
    updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_expo_push_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  delete from public.push_tokens
  where user_id = auth.uid()
    and expo_push_token = btrim(p_expo_push_token);
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

revoke all on table public.push_tokens from public, anon, authenticated;

-- Inactive owners must not retain service-image write access.
drop policy if exists "Owners can upload service images" on storage.objects;
create policy "Owners can upload service images"
on storage.objects for insert to authenticated
with check (bucket_id = 'service-images' and public.is_owner());

drop policy if exists "Owners can update service images" on storage.objects;
create policy "Owners can update service images"
on storage.objects for update to authenticated
using (bucket_id = 'service-images' and public.is_owner())
with check (bucket_id = 'service-images' and public.is_owner());

drop policy if exists "Owners can delete service images" on storage.objects;
create policy "Owners can delete service images"
on storage.objects for delete to authenticated
using (bucket_id = 'service-images' and public.is_owner());
