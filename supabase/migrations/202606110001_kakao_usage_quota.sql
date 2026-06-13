-- Central daily Kakao API usage counter (app-wide quota guard).
--
-- A static-export client has no server runtime, and a per-device localStorage
-- counter can't protect an app-wide daily quota. This table + atomic RPC are the
-- single source of truth. "Today" is computed in Asia/Seoul inside the function
-- so the daily reset matches Kakao's midnight-KST reset regardless of the
-- caller's clock/timezone. Best-effort overage guard — not tamper-proof.

create table if not exists public.kakao_usage (
  day_kst  date    not null,
  category text    not null check (category in ('local', 'map')),
  count    integer not null default 0,
  primary key (day_kst, category)
);

-- Counted-and-enforced (or monitored) in one atomic statement: upsert +1 for
-- today's Asia/Seoul date and RETURN the new count (no read-then-write race).
create or replace function public.increment_kakao_usage(p_category text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day   date := (now() at time zone 'Asia/Seoul')::date;
  v_count integer;
begin
  if p_category not in ('local', 'map') then
    raise exception 'invalid kakao usage category: %', p_category;
  end if;

  insert into public.kakao_usage (day_kst, category, count)
  values (v_day, p_category, 1)
  on conflict (day_kst, category)
  do update set count = public.kakao_usage.count + 1
  returning count into v_count;

  return v_count;
end;
$$;

-- RLS on, with NO client policies: the table is reachable only through the
-- SECURITY DEFINER function above (which runs as owner and bypasses RLS). Add a
-- read policy later if you want an in-app usage dashboard.
alter table public.kakao_usage enable row level security;

-- Only the RPC may be executed by the client roles; revoke ambient access.
revoke all on function public.increment_kakao_usage(text) from public;
grant execute on function public.increment_kakao_usage(text) to anon, authenticated;
