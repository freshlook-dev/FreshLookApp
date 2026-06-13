create or replace function public.prevent_double_booking()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'upcoming' and coalesce(new.archived, false) = false then
    perform pg_advisory_xact_lock(
      hashtextextended(
        concat_ws('|', new.location, new.appointment_date::text, new.appointment_time::text),
        0
      )
    );

    if exists (
      select 1
      from public.appointments existing
      where existing.location = new.location
        and existing.appointment_date = new.appointment_date
        and existing.appointment_time = new.appointment_time
        and existing.status = 'upcoming'
        and coalesce(existing.archived, false) = false
        and (tg_op = 'INSERT' or existing.id <> new.id)
    ) then
      raise exception 'This appointment time is already taken.' using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_double_booking_trigger on public.appointments;

create trigger prevent_double_booking_trigger
before insert or update of location, appointment_date, appointment_time, status, archived
on public.appointments
for each row
execute function public.prevent_double_booking();
