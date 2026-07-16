-- One order workflow everywhere:
-- ordered (Porositur) -> confirmed (Konfirmuar) -> delivered (Dorezuar)
--                                      \-> cancelled (Anuluar)
-- Clients may cancel only during the first three hours. Delivery awards the
-- existing loyalty rate (one Fresh Point per EUR 2) exactly once.

-- Retire the legacy completed/deleted point triggers before normalizing rows.
do $$
declare
  trigger_row record;
begin
  for trigger_row in
    select trigger_name
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'orders'
      and action_statement ilike '%handle_order_completed_points%'
  loop
    execute format('drop trigger if exists %I on public.orders', trigger_row.trigger_name);
  end loop;

  for trigger_row in
    select trigger_name
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'orders'
      and action_statement ilike '%handle_order_deleted_points%'
  loop
    execute format('drop trigger if exists %I on public.orders', trigger_row.trigger_name);
  end loop;
end;
$$;

alter table public.orders
  add column if not exists confirmed_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists points_awarded integer not null default 0;

-- Remove a historical status check before translating legacy values.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname as constraint_name
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint if exists %I', constraint_row.constraint_name);
  end loop;
end;
$$;

-- Orders already completed under the old workflow already received points.
-- Mark old delivered rows too, avoiding an unexpected retroactive award.
update public.orders
set points_awarded = greatest(0, floor(coalesce(total, 0) / 2)::integer)
where status in ('completed', 'delivered')
  and points_awarded = 0;

update public.orders
set
  status = case
    when status in ('pending') then 'ordered'
    when status in ('processing', 'ready', 'shipped') then 'confirmed'
    when status in ('delivered', 'completed') then 'delivered'
    when status in ('cancelled', 'canceled') then 'cancelled'
    else 'ordered'
  end,
  confirmed_at = case
    when status in ('processing', 'ready', 'shipped', 'delivered', 'completed')
      then coalesce(confirmed_at, created_at + interval '3 hours')
    else confirmed_at
  end,
  delivered_at = case
    when status in ('delivered', 'completed') then coalesce(delivered_at, created_at)
    else delivered_at
  end;

alter table public.orders
  add constraint orders_status_workflow_check
  check (status in ('ordered', 'confirmed', 'delivered', 'cancelled'));

create or replace function public.normalize_new_order_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status is null or new.status = 'pending' then
    new.status := 'ordered';
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_new_order_status_trigger on public.orders;
create trigger normalize_new_order_status_trigger
before insert on public.orders
for each row execute function public.normalize_new_order_status();

create or replace function public.confirm_due_orders()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_count integer;
begin
  update public.orders
  set status = 'confirmed', confirmed_at = coalesce(confirmed_at, now())
  where status = 'ordered'
    and created_at <= now() - interval '3 hours';
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.confirm_due_orders() from public, anon, authenticated;
grant execute on function public.confirm_due_orders() to service_role;

create extension if not exists pg_cron with schema extensions;
do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'freshlook-confirm-orders'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;
select cron.schedule(
  'freshlook-confirm-orders',
  '* * * * *',
  $job$select public.confirm_due_orders();$job$
);

drop function if exists public.owner_manage_order(uuid, text, text);
create function public.owner_manage_order(
  p_order_id uuid,
  p_action text,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_order public.orders%rowtype;
  points_to_award integer := 0;
  new_balance integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner' and is_active is not false
  ) then
    raise exception 'Only an active owner can manage orders' using errcode = '42501';
  end if;

  perform public.confirm_due_orders();
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  if p_action = 'set_status' then
    if p_status not in ('ordered', 'confirmed', 'delivered', 'cancelled') then
      raise exception 'Invalid order status' using errcode = '22023';
    end if;
    if current_order.status in ('delivered', 'cancelled') and p_status <> current_order.status then
      raise exception 'Delivered and cancelled orders are final' using errcode = '22023';
    end if;
    if current_order.status = 'confirmed' and p_status = 'ordered' then
      raise exception 'A confirmed order cannot return to ordered' using errcode = '22023';
    end if;

    if p_status = 'delivered' and current_order.status <> 'delivered' then
      points_to_award := case
        when current_order.user_id is null then 0
        else greatest(0, floor(coalesce(current_order.total, 0) / 2)::integer)
      end;

      if points_to_award > 0 and current_order.points_awarded = 0 then
        update public.profiles
        set points = coalesce(points, 0) + points_to_award
        where id = current_order.user_id
          and role = 'client'
          and is_active is not false
        returning points into new_balance;

        if new_balance is null then points_to_award := 0; end if;
      else
        points_to_award := 0;
      end if;
    end if;

    update public.orders
    set
      status = p_status,
      confirmed_at = case
        when p_status in ('confirmed', 'delivered') then coalesce(confirmed_at, now())
        else confirmed_at
      end,
      delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
      points_awarded = case
        when p_status = 'delivered' then greatest(points_awarded, points_to_award)
        else points_awarded
      end
    where id = p_order_id;

    return jsonb_build_object(
      'status', p_status,
      'points_awarded', points_to_award,
      'new_balance', new_balance
    );
  elsif p_action = 'delete' then
    if current_order.status = 'delivered' then
      raise exception 'Delivered orders cannot be deleted' using errcode = '22023';
    end if;
    delete from public.orders where id = p_order_id;
    return jsonb_build_object('deleted', true, 'points_awarded', 0);
  else
    raise exception 'Invalid order action' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.owner_manage_order(uuid,text,text) from public, anon;
grant execute on function public.owner_manage_order(uuid,text,text) to authenticated, service_role;

revoke all on function public.normalize_new_order_status() from public, anon, authenticated;
