create table if not exists public.welcome_email_log (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.welcome_email_log enable row level security;

create policy "Users can reserve their own welcome email"
on public.welcome_email_log
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can view their own welcome email record"
on public.welcome_email_log
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can retry their own failed welcome email"
on public.welcome_email_log
for delete
to authenticated
using (auth.uid() = user_id);
