-- Storage objects must be removed through the Storage API. The protected
-- delete-own-account Edge Function removes the avatar before invoking this
-- transactional account cleanup function.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  target_user_id uuid := auth.uid();
begin
  if target_user_id is null then
    raise exception 'You must be signed in to delete an account.' using errcode = '28000';
  end if;

  delete from public.profiles where id = target_user_id;
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
