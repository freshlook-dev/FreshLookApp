-- Lets active client users create their own pending point-redemption QR safely.

create or replace function public.create_point_redemption_qr(
  p_points integer,
  p_expires_at timestamp with time zone default (now() + interval '15 minutes')
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
  v_redemption public.point_redemptions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Nuk jeni të kyçur' using errcode = '28000';
  end if;

  if p_points is null or p_points <= 0 then
    raise exception 'Shuma e Fresh Points nuk është valide' using errcode = '22023';
  end if;

  select role, is_active, coalesce(points, 0)
    into v_role, v_active, v_balance
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Profili i klientit nuk u gjet' using errcode = 'P0002';
  end if;

  if coalesce(v_active, true) = false or v_role <> 'client' then
    raise exception 'Vetëm klientët aktivë mund të krijojnë kode QR shpërblimi' using errcode = '42501';
  end if;

  if v_balance < p_points then
    raise exception 'Nuk keni mjaftueshëm Fresh Points' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.point_redemptions
    where user_id = v_user_id
      and status = 'pending'
      and (expires_at is null or expires_at > now())
  ) then
    raise exception 'Një kod QR shpërblimi është tashmë aktiv' using errcode = 'P0001';
  end if;

  insert into public.point_redemptions (
    user_id,
    points,
    status,
    expires_at
  )
  values (
    v_user_id,
    p_points,
    'pending',
    coalesce(p_expires_at, now() + interval '15 minutes')
  )
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

grant execute on function public.create_point_redemption_qr(integer, timestamp with time zone)
  to authenticated;
