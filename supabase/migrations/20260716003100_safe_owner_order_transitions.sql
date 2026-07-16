-- Preserve inventory consistency when an owner manages an order. A cancelled
-- order has already restored its stock, so reopening it without a fresh stock
-- reservation is intentionally rejected. Deleting matches the website's
-- existing behavior and does not manufacture a cancellation transition.
create or replace function public.owner_manage_order(
  p_order_id uuid,
  p_action text,
  p_status text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_status text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner' and is_active is not false
  ) then
    raise exception 'Only an active owner can manage orders' using errcode = '42501';
  end if;

  select status into v_current_status
  from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  if p_action = 'set_status' then
    if p_status is null or p_status not in ('pending','processing','ready','delivered','completed','cancelled') then
      raise exception 'Invalid order status' using errcode = '22023';
    end if;
    if v_current_status in ('cancelled','canceled') and p_status not in ('cancelled','canceled') then
      raise exception 'A cancelled order cannot be reopened because its stock was restored' using errcode = '22023';
    end if;
    update public.orders set status = p_status where id = p_order_id;
  elsif p_action = 'delete' then
    delete from public.orders where id = p_order_id;
  else
    raise exception 'Invalid order action' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.owner_manage_order(uuid,text,text) from public, anon;
grant execute on function public.owner_manage_order(uuid,text,text) to authenticated, service_role;
