create extension if not exists pgcrypto with schema extensions;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index businesses_created_by_idx on public.businesses(created_by);
create index business_members_user_id_idx on public.business_members(user_id);
create index business_members_business_id_role_idx on public.business_members(business_id, role);

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;

create or replace function public.is_business_member(target_business_id uuid)
returns boolean language sql stable security invoker
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.business_members bm
    where bm.business_id = target_business_id and bm.user_id = auth.uid()
  );
$$;

create or replace function public.has_business_role(target_business_id uuid, required_role text)
returns boolean language sql stable security invoker
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.business_members bm
    where bm.business_id = target_business_id and bm.user_id = auth.uid()
      and case required_role
        when 'owner' then bm.role = 'owner'
        when 'admin' then bm.role in ('owner','admin')
        when 'member' then bm.role in ('owner','admin','member')
        when 'viewer' then bm.role in ('owner','admin','member','viewer')
        else false end
  );
$$;

create policy businesses_select_member on public.businesses for select to authenticated
using (public.is_business_member(id));

create policy business_members_select_member on public.business_members for select to authenticated
using (public.is_business_member(business_id));

create or replace function public.create_business(business_name text, business_slug text)
returns public.businesses language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  new_business public.businesses;
  caller_id uuid := auth.uid();
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
exception when unique_violation then
  raise exception 'Business slug is already in use' using errcode = '23505';
end;
$$;

revoke all on function public.create_business(text,text) from public;
revoke all on function public.create_business(text,text) from anon;
grant execute on function public.create_business(text,text) to authenticated;

revoke all on public.businesses from anon;
revoke all on public.business_members from anon;
grant select on public.businesses to authenticated;
grant select on public.business_members to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_set_updated_at before update on public.businesses
for each row execute function public.set_updated_at();

create trigger business_members_set_updated_at before update on public.business_members
for each row execute function public.set_updated_at();

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.set_updated_at() from anon;
revoke execute on function public.set_updated_at() from authenticated;