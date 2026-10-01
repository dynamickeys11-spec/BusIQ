-- BUSIQ: make business creation RLS-authorized and remove SECURITY DEFINER from the exposed RPC.
-- Applied to Supabase project nmkyclxahjsvikheinbv on 2026-09-30.

create or replace function private.is_business_creator(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = target_business_id
      and b.created_by = (select auth.uid())
  );
$$;

revoke all on function private.is_business_creator(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_business_creator(uuid) to authenticated;

drop policy if exists businesses_insert_owner on public.businesses;
create policy businesses_insert_owner
on public.businesses
for insert
to authenticated
with check ((select auth.uid()) = created_by);

drop policy if exists business_members_insert_owner on public.business_members;
create policy business_members_insert_owner
on public.business_members
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (select private.is_business_creator(business_id))
);

create or replace function public.create_business(business_name text, business_slug text)
returns public.businesses
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  new_business public.businesses;
  caller_id uuid := (select auth.uid());
  normalized_name text := btrim(business_name);
  normalized_slug text := lower(btrim(business_slug));
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if length(normalized_name) not between 1 and 160 then
    raise exception 'Business name must be between 1 and 160 characters';
  end if;

  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Business slug is invalid';
  end if;

  insert into public.businesses (name, slug, created_by)
  values (normalized_name, normalized_slug, caller_id)
  returning * into new_business;

  insert into public.business_members (business_id, user_id, role)
  values (new_business.id, caller_id, 'owner');

  return new_business;
exception
  when unique_violation then
    raise exception 'Business slug is already in use' using errcode = '23505';
end;
$function$;

revoke execute on function public.create_business(text, text) from public, anon;
grant execute on function public.create_business(text, text) to authenticated;
