create or replace function public.delete_pending_reward_qr(p_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  delete from public.point_redemptions
  where id = p_redemption_id
    and user_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Pending QR code not found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.delete_pending_reward_qr(uuid) to authenticated;
