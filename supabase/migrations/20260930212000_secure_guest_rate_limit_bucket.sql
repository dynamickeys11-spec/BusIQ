-- Keep the guest rate-limit bucket server-only while satisfying the RLS policy audit.
create policy "guest rate limit buckets are server only"
on public.guest_rate_limit_buckets
as restrictive
for all
to authenticated
using (false)
with check (false);
