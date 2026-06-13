-- Client account settings and Expo push notification registration.
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;

create table if not exists public.push_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);

create table if not exists public.push_notification_history (
  id bigint generated always as identity primary key,
  sent_by uuid references auth.users(id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  message text not null check (char_length(message) between 1 and 500),
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.is_owner(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user and role = 'owner' and coalesce(is_active, true)
  );
$$;

alter table public.push_tokens enable row level security;
alter table public.push_notification_history enable row level security;

drop policy if exists "Users manage their push tokens" on public.push_tokens;
create policy "Users manage their push tokens"
on public.push_tokens for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Owners read notification history" on public.push_notification_history;
create policy "Owners read notification history"
on public.push_notification_history for select to authenticated
using (public.is_owner());

-- Storage bucket/policies are idempotent and match the existing avatar path convention: <user-id>.jpg.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Public avatar images" on storage.objects;
create policy "Public avatar images"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Users upload their avatar" on storage.objects;
create policy "Users upload their avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and name = auth.uid()::text || '.jpg'
);

drop policy if exists "Users update their avatar" on storage.objects;
create policy "Users update their avatar"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg')
with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
