create table public.rate_limit_buckets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0)
);

alter table public.rate_limit_buckets enable row level security;

create policy "users can manage their rate limit bucket"
on public.rate_limit_buckets for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.rate_limit_buckets from anon;
grant select, insert, update on table public.rate_limit_buckets to authenticated;

create or replace function public.consume_distributed_rate_limit(
  p_user_id uuid, p_window_seconds integer, p_max_requests integer
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql security invoker set search_path = ''
as $$
declare
  now_at timestamptz := clock_timestamp();
  bucket public.rate_limit_buckets%rowtype;
  next_count integer;
  remaining_seconds integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 or p_max_requests < 1 or p_max_requests > 10000 then raise exception 'Invalid rate limit policy'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into bucket from public.rate_limit_buckets where user_id = p_user_id for update;
  if not found or now_at >= bucket.window_started_at + make_interval(secs => p_window_seconds) then
    insert into public.rate_limit_buckets(user_id, window_started_at, request_count)
    values (p_user_id, now_at, 1)
    on conflict (user_id) do update set window_started_at = excluded.window_started_at, request_count = 1;
    return query select true, 0; return;
  end if;
  next_count := bucket.request_count + 1;
  remaining_seconds := greatest(1, ceil(extract(epoch from ((bucket.window_started_at + make_interval(secs => p_window_seconds)) - now_at)))::integer);
  if next_count > p_max_requests then return query select false, remaining_seconds; return; end if;
  update public.rate_limit_buckets set request_count = next_count where user_id = p_user_id;
  return query select true, 0;
end;
$$;

revoke execute on function public.consume_distributed_rate_limit(uuid, integer, integer) from public;
revoke execute on function public.consume_distributed_rate_limit(uuid, integer, integer) from anon;
grant execute on function public.consume_distributed_rate_limit(uuid, integer, integer) to authenticated;
