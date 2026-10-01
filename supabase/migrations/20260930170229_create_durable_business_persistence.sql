create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  request text not null check (length(btrim(request)) between 1 and 20000),
  intent jsonb,
  status text not null default 'active' check (status in ('active','complete','archived')),
  pipeline jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 500),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_context (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  context jsonb not null default '{}'::jsonb,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table public.intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  request text not null check (length(btrim(request)) between 1 and 20000),
  status text not null,
  intent jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);

create index work_items_business_status_idx on public.work_items(business_id, status, created_at desc);
create index work_items_created_by_idx on public.work_items(created_by, created_at desc);
create index library_items_business_created_idx on public.library_items(business_id, created_at desc);
create index intelligence_runs_business_created_idx on public.intelligence_runs(business_id, created_at desc);
create index intelligence_runs_user_created_idx on public.intelligence_runs(user_id, created_at desc);

alter table public.work_items enable row level security;
alter table public.library_items enable row level security;
alter table public.business_context enable row level security;
alter table public.intelligence_runs enable row level security;

create policy "members can read work" on public.work_items for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy "members can create work" on public.work_items for insert to authenticated
  with check ((select private.is_business_member(business_id)) and (select auth.uid()) = created_by);
create policy "members can update work" on public.work_items for update to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)) and (select auth.uid()) = created_by);
create policy "members can delete work" on public.work_items for delete to authenticated
  using ((select private.is_business_member(business_id)));

create policy "members can read library" on public.library_items for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy "members can create library" on public.library_items for insert to authenticated
  with check ((select private.is_business_member(business_id)) and (select auth.uid()) = created_by);
create policy "members can update library" on public.library_items for update to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)) and (select auth.uid()) = created_by);
create policy "members can delete library" on public.library_items for delete to authenticated
  using ((select private.is_business_member(business_id)));

create policy "members can read business context" on public.business_context for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy "members can create business context" on public.business_context for insert to authenticated
  with check ((select private.is_business_member(business_id)) and (select auth.uid()) = updated_by);
create policy "members can update business context" on public.business_context for update to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)) and (select auth.uid()) = updated_by);

create policy "members can read intelligence history" on public.intelligence_runs for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy "members can create intelligence history" on public.intelligence_runs for insert to authenticated
  with check ((select private.is_business_member(business_id)) and (select auth.uid()) = user_id);

create trigger work_items_set_updated_at before update on public.work_items
for each row execute function public.set_updated_at();
create trigger library_items_set_updated_at before update on public.library_items
for each row execute function public.set_updated_at();
create trigger business_context_set_updated_at before update on public.business_context
for each row execute function public.set_updated_at();