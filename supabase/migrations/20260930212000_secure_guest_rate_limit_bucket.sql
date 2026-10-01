-- Keep the guest rate-limit bucket server-only while satisfying the RLS policy audit.
do $$
begin
  create policy "guest rate limit buckets are server only"
  on public.guest_rate_limit_buckets
  as restrictive
  for all
  to authenticated
  using (false)
  with check (false);
exception when duplicate_object then null;
end $$;
