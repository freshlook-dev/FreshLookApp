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
    phone_country_code = coalesce(nullif(new.raw_user_meta_data->>'phone_country_code', ''), phone_country_code),
    role = 'client'
  where id = new.id;

  return new;
end;
$$;
