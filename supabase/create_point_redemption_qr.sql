-- Manual SQL Editor copy of the hardened reward-QR creation function.
-- The timestamp parameter remains for older app builds; reward QRs are
-- intentionally non-expiring.

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

revoke insert, update, delete on table public.point_redemptions from public, anon, authenticated;
grant select on table public.point_redemptions to authenticated;
