-- Canonical loyalty contract:
--   EUR 1 paid = 1 Fresh Point earned (whole points, rounded down)
--   100 Fresh Points = EUR 10 when redeemed

create table if not exists public.fresh_points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points_delta integer not null check (points_delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  event_type text not null check (event_type in ('opening_balance','visit_earned','order_earned','reward_spent','manual_adjustment')),
  source_type text,
  source_id uuid,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fresh_points_ledger_user_created_idx
  on public.fresh_points_ledger(user_id, created_at desc);
create unique index if not exists fresh_points_ledger_reward_once_idx
  on public.fresh_points_ledger(source_id, event_type)
  where source_id is not null and event_type in ('order_earned', 'reward_spent');

alter table public.fresh_points_ledger enable row level security;
drop policy if exists fresh_points_ledger_read_own_or_staff on public.fresh_points_ledger;
create policy fresh_points_ledger_read_own_or_staff
on public.fresh_points_ledger for select to authenticated
using (user_id = auth.uid() or public.is_staff_member(auth.uid()));
revoke all on table public.fresh_points_ledger from public, anon, authenticated;
grant select on table public.fresh_points_ledger to authenticated;

-- Preserve the current balance as the starting point for an honest history.
insert into public.fresh_points_ledger (
  user_id, points_delta, balance_after, event_type, description, metadata, created_at
)
select id, points, points, 'opening_balance', 'Bilanci para aktivizimit të historikut',
  jsonb_build_object('conversion', '100 points = 10 EUR'), now()
from public.profiles
where role = 'client' and coalesce(points, 0) > 0
  and not exists (
    select 1 from public.fresh_points_ledger ledger
    where ledger.user_id = profiles.id and ledger.event_type = 'opening_balance'
  );

-- Existing visit RPCs applied the former EUR 2 = 1 point rule before updating
-- the appointment. This trigger applies only the difference required by the
-- new EUR 1 = 1 point rule and records the complete visit delta in the ledger.
create or replace function public.reconcile_visit_fresh_points()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_points integer := 0;
  new_points integer := 0;
  old_legacy integer := 0;
  new_legacy integer := 0;
  full_delta integer;
  correction integer;
  resulting_balance integer;
begin
  if old.user_id is distinct from new.user_id then
    raise exception 'Appointment client cannot change during point reconciliation' using errcode = '42501';
  end if;
  if new.user_id is null then return new; end if;

  if old.payment_method is not null and old.total_amount is not null then
    old_points := greatest(0, floor(old.total_amount)::integer);
    old_legacy := greatest(0, floor(old.total_amount / 2)::integer);
  end if;
  if new.payment_method is not null and new.total_amount is not null then
    new_points := greatest(0, floor(new.total_amount)::integer);
    new_legacy := greatest(0, floor(new.total_amount / 2)::integer);
  end if;

  full_delta := new_points - old_points;
  correction := full_delta - (new_legacy - old_legacy);
  if correction <> 0 then
    update public.profiles
    set points = greatest(0, coalesce(points, 0) + correction)
    where id = new.user_id and role = 'client' and is_active is not false
    returning points into resulting_balance;
  else
    select points into resulting_balance from public.profiles where id = new.user_id;
  end if;

  if full_delta <> 0 and resulting_balance is not null then
    insert into public.fresh_points_ledger (
      user_id, points_delta, balance_after, event_type, source_type, source_id,
      description, metadata
    ) values (
      new.user_id, full_delta, resulting_balance,
      case when full_delta > 0 then 'visit_earned' else 'manual_adjustment' end,
      'appointment', new.id,
      case when full_delta > 0 then 'Fresh Points nga vizita' else 'Korrigjim i vizitës' end,
      jsonb_build_object('total_paid', new.total_amount, 'rule', '1 EUR = 1 point')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists reconcile_visit_fresh_points_trigger on public.appointments;
create trigger reconcile_visit_fresh_points_trigger
after update of payment_method, total_amount, status on public.appointments
for each row execute function public.reconcile_visit_fresh_points();
revoke all on function public.reconcile_visit_fresh_points() from public, anon, authenticated;

-- Record QR spending after the existing secure redemption RPC deducts points.
create or replace function public.log_reward_points_spent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resulting_balance integer;
begin
  if old.status = 'pending' and new.status = 'used' then
    select coalesce(points, 0) into resulting_balance from public.profiles where id = new.user_id;
    insert into public.fresh_points_ledger (
      user_id, points_delta, balance_after, event_type, source_type, source_id,
      description, metadata, created_at
    ) values (
      new.user_id, -new.points, resulting_balance, 'reward_spent',
      'point_redemption', new.id, 'Fresh Points të përdorura',
      jsonb_build_object('euro_value', new.points / 10.0, 'rule', '100 points = 10 EUR'),
      coalesce(new.scanned_at, now())
    ) on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists log_reward_points_spent_trigger on public.point_redemptions;
create trigger log_reward_points_spent_trigger
after update of status on public.point_redemptions
for each row execute function public.log_reward_points_spent();
revoke all on function public.log_reward_points_spent() from public, anon, authenticated;

-- Replace delivery handling with the canonical EUR 1 = 1 point award.
drop function if exists public.owner_manage_order(uuid, text, text);
create function public.owner_manage_order(p_order_id uuid, p_action text, p_status text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  current_order public.orders%rowtype;
  points_to_award integer := 0;
  new_balance integer;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and role = 'owner' and is_active is not false) then
    raise exception 'Only an active owner can manage orders' using errcode = '42501';
  end if;
  perform public.confirm_due_orders();
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  if p_action = 'set_status' then
    if p_status not in ('ordered','confirmed','delivered','cancelled') then raise exception 'Invalid order status' using errcode = '22023'; end if;
    if current_order.status in ('delivered','cancelled') and p_status <> current_order.status then raise exception 'Delivered and cancelled orders are final' using errcode = '22023'; end if;
    if current_order.status = 'confirmed' and p_status = 'ordered' then raise exception 'A confirmed order cannot return to ordered' using errcode = '22023'; end if;

    if p_status = 'delivered' and current_order.status <> 'delivered' and current_order.points_awarded = 0 and current_order.user_id is not null then
      points_to_award := greatest(0, floor(coalesce(current_order.total, 0))::integer);
      if points_to_award > 0 then
        update public.profiles set points = coalesce(points, 0) + points_to_award
        where id = current_order.user_id and role = 'client' and is_active is not false
        returning points into new_balance;
        if new_balance is null then points_to_award := 0; end if;
      end if;
    end if;

    update public.orders set status = p_status,
      confirmed_at = case when p_status in ('confirmed','delivered') then coalesce(confirmed_at, now()) else confirmed_at end,
      delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
      points_awarded = case when p_status = 'delivered' then greatest(points_awarded, points_to_award) else points_awarded end
    where id = p_order_id;

    if points_to_award > 0 then
      insert into public.fresh_points_ledger (
        user_id, points_delta, balance_after, event_type, source_type, source_id,
        description, metadata
      ) values (
        current_order.user_id, points_to_award, new_balance, 'order_earned',
        'order', current_order.id, 'Fresh Points nga porosia e dorëzuar',
        jsonb_build_object('order_number', current_order.display_order_id, 'total_paid', current_order.total, 'rule', '1 EUR = 1 point')
      ) on conflict do nothing;
    end if;
    return jsonb_build_object('status', p_status, 'points_awarded', points_to_award, 'new_balance', new_balance);
  elsif p_action = 'delete' then
    if current_order.status = 'delivered' then raise exception 'Delivered orders cannot be deleted' using errcode = '22023'; end if;
    delete from public.orders where id = p_order_id;
    return jsonb_build_object('deleted', true, 'points_awarded', 0);
  end if;
  raise exception 'Invalid order action' using errcode = '22023';
end;
$$;
revoke all on function public.owner_manage_order(uuid,text,text) from public, anon;
grant execute on function public.owner_manage_order(uuid,text,text) to authenticated, service_role;
