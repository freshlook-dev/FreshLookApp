-- Manual SQL Editor copy of the hardened reward-QR redemption function.

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

revoke insert, update, delete on table public.point_redemptions from public, anon, authenticated;
grant select on table public.point_redemptions to authenticated;
