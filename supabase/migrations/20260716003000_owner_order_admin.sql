-- Keep order administration owner-only without restoring direct table writes.
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
  select status into v_current_status from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if p_action = 'set_status' then
    if p_status is null or p_status not in ('pending','processing','ready','delivered','completed','cancelled') then
      raise exception 'Invalid order status' using errcode = '22023';
    end if;
    update public.orders set status = p_status where id = p_order_id;
  elsif p_action = 'delete' then
    -- Marking it cancelled first lets the existing inventory trigger restore
    -- online stock exactly once before the history row is removed.
    if v_current_status not in ('cancelled','canceled') then
      update public.orders set status = 'cancelled' where id = p_order_id;
    end if;
    delete from public.orders where id = p_order_id;
  else
    raise exception 'Invalid order action' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.owner_manage_order(uuid,text,text) from public, anon;
grant execute on function public.owner_manage_order(uuid,text,text) to authenticated, service_role;

-- Cover the bilingual catalog columns and every inventory location at the
-- database boundary. Checkout uses SECURITY DEFINER and is unaffected.
drop trigger if exists guard_owner_product_catalog_update_trigger on public.products;
create trigger guard_owner_product_catalog_update_trigger
before update of id, name, subtitle, description, name_sq, name_en, description_sq, description_en, price, sale_price, is_on_sale, image_url, is_active, is_out_of_stock, stock_online, stock_prishtine, stock_fushe_kosove
on public.products for each row execute function public.guard_active_owner_writes();
