-- App Store account-deletion support. The function can only remove the account
-- identified by the caller's JWT; it cannot delete another user's account.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = auth, public, storage
as $$
declare
  target_user_id uuid := auth.uid();
begin
  if target_user_id is null then
    raise exception 'You must be signed in to delete an account.';
  end if;

  -- Remove the public avatar before the account identity is removed.
  delete from storage.objects
  where bucket_id = 'avatars'
    and name = target_user_id::text || '.jpg';

  -- Remove the application profile explicitly in case it does not cascade.
  delete from public.profiles where id = target_user_id;

  -- Supabase Auth owns the account record. Dependent application tables should
  -- use their existing foreign-key deletion policies.
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
