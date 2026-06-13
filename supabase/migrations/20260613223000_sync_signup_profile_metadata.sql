-- Keep editable profile fields in sync with signup metadata after the existing
-- auth-user profile creation trigger has run.
create or replace function public.sync_signup_profile_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    full_name = coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), full_name),
    phone = coalesce(nullif(new.raw_user_meta_data->>'phone', ''), phone)
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists zzzz_sync_signup_profile_metadata on auth.users;
create trigger zzzz_sync_signup_profile_metadata
after insert on auth.users
for each row execute function public.sync_signup_profile_metadata();
