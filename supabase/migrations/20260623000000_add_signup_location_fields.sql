-- Store the country and city selected during account registration.
alter table public.profiles
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists phone_country_code text;

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
    phone = coalesce(nullif(new.raw_user_meta_data->>'phone', ''), phone),
    country = coalesce(nullif(new.raw_user_meta_data->>'country', ''), country),
    city = coalesce(nullif(new.raw_user_meta_data->>'city', ''), city),
    phone_country_code = coalesce(nullif(new.raw_user_meta_data->>'phone_country_code', ''), phone_country_code)
  where id = new.id;

  return new;
end;
$$;
