alter table public.push_notification_history
add column if not exists recipient_id uuid references auth.users(id) on delete set null;

alter table public.push_notification_history
add column if not exists audience text not null default 'direct'
check (audience in ('all', 'direct'));

create index if not exists push_notification_history_recipient_id_idx
on public.push_notification_history(recipient_id);

create or replace function public.is_staff_member(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user
      and role in ('owner', 'manager', 'staff')
      and coalesce(is_active, true)
  );
$$;

drop policy if exists "Owners read notification history" on public.push_notification_history;
drop policy if exists "Users read relevant notification history" on public.push_notification_history;

create policy "Users read relevant notification history"
on public.push_notification_history for select to authenticated
using (
  public.is_staff_member()
  or recipient_id = auth.uid()
  or audience = 'all'
);
