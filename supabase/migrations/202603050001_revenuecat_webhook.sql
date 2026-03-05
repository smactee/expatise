-- RevenueCat production sync: tables + resolver function

create table if not exists public.premium_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_premium boolean not null default false,
  source text not null default 'none' check (source in ('none', 'trial', 'subscription', 'lifetime', 'admin', 'dev', 'demo')),
  expires_at timestamptz null,
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  rc_app_user_id text null,
  rc_original_app_user_id text null,
  rc_last_event_type text null,
  rc_last_event_id text null
);

alter table public.premium_entitlements
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists rc_app_user_id text null,
  add column if not exists rc_original_app_user_id text null,
  add column if not exists rc_last_event_type text null,
  add column if not exists rc_last_event_id text null;

create table if not exists public.revenuecat_webhook_events (
  event_id text primary key,
  app_user_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  processed_at timestamptz not null default timezone('utc', now()),
  payload jsonb not null
);

create index if not exists revenuecat_webhook_events_user_id_idx
  on public.revenuecat_webhook_events (user_id);

alter table public.premium_entitlements enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'premium_entitlements'
      and policyname = 'read_own_premium_entitlements'
  ) then
    create policy read_own_premium_entitlements
      on public.premium_entitlements
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

create or replace function public.find_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select u.id
  from auth.users u
  where lower(trim(u.email)) = lower(trim(p_email))
  order by u.created_at asc
  limit 1;
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public;
revoke all on function public.find_auth_user_id_by_email(text) from anon;
revoke all on function public.find_auth_user_id_by_email(text) from authenticated;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;
