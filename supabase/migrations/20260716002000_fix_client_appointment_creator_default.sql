-- created_by identifies the staff member who created an appointment. Its old
-- auth.uid() default also populated the field for clients, conflicting with the
-- ownership guard and preventing legitimate authenticated client bookings.

begin;

alter table public.appointments
  alter column created_by drop default;

create or replace function public.normalize_client_appointment_creator()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
begin
  if current_user <> 'authenticated' or auth.uid() is null then
    return new;
  end if;

  select profile.role
    into v_role
  from public.profiles profile
  where profile.id = auth.uid();

  -- Accept either an omitted creator or the client's own ID (including the
  -- previous column default), then normalize it so staff attribution remains
  -- semantically correct. Other user IDs are left untouched for the main
  -- appointment guard to reject.
  if v_role = 'client'
    and new.user_id = auth.uid()
    and (new.created_by is null or new.created_by = auth.uid()) then
    new.created_by := null;
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_client_appointment_creator() from public;
revoke all on function public.normalize_client_appointment_creator() from anon;
revoke all on function public.normalize_client_appointment_creator() from authenticated;
grant execute on function public.normalize_client_appointment_creator() to service_role;

drop trigger if exists client_appointment_creator_normalizer_trigger
  on public.appointments;

create trigger client_appointment_creator_normalizer_trigger
before insert on public.appointments
for each row execute function public.normalize_client_appointment_creator();

commit;
