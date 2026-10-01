-- BUSIQ: move membership authorization helpers out of exposed public schema.
-- Applied to Supabase project nmkyclxahjsvikheinbv on 2026-09-30.

create schema if not exists private;

create or replace function private.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_business_role(target_business_id uuid, required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = (select auth.uid())
      and case required_role
        when 'owner' then bm.role = 'owner'
        when 'admin' then bm.role in ('owner','admin')
        when 'member' then bm.role in ('owner','admin','member')
        when 'viewer' then bm.role in ('owner','admin','member','viewer')
        else false
      end
  );
$$;

revoke all on function private.is_business_member(uuid) from public, anon, authenticated;
revoke all on function private.has_business_role(uuid, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_business_member(uuid) to authenticated;
grant execute on function private.has_business_role(uuid, text) to authenticated;

drop policy if exists businesses_select_member on public.businesses;
drop policy if exists business_members_select_member on public.business_members;

create policy businesses_select_member
on public.businesses
for select
to authenticated
using ((select private.is_business_member(id)));

create policy business_members_select_member
on public.business_members
for select
to authenticated
using ((select private.is_business_member(business_id)));

drop function if exists public.is_business_member(uuid);
drop function if exists public.has_business_role(uuid, text);

revoke execute on function public.create_business(text, text) from public, anon, authenticated;
