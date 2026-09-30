-- BUSIQ business intelligence domains.
-- Authenticated membership is the row-level boundary; anonymous sessions have no business membership.

create table if not exists public.business_customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  external_id text,
  name text not null,
  email text,
  phone text,
  status text,
  source text not null,
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  external_id text,
  name text not null,
  sku text,
  category text,
  price numeric,
  currency text,
  status text,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  external_id text,
  occurred_at timestamptz not null,
  amount numeric not null,
  currency text not null,
  customer_id uuid references public.business_customers(id) on delete set null,
  product_id uuid references public.business_products(id) on delete set null,
  quantity numeric,
  status text,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_money (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  external_id text,
  occurred_at timestamptz not null,
  type text not null check (type in ('income','expense','transfer','refund','unknown')),
  amount numeric not null,
  currency text not null,
  category text,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_inventory (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  external_id text,
  product_id uuid references public.business_products(id) on delete set null,
  location text,
  quantity numeric not null,
  occurred_at timestamptz not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  external_id text,
  name text not null,
  status text,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_operations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  external_id text,
  operation_type text not null,
  status text,
  occurred_at timestamptz not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  external_id text,
  name text not null,
  status text,
  start_at timestamptz,
  end_at timestamptz,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_marketing (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  external_id text,
  channel text not null,
  campaign text,
  metric text not null,
  value numeric not null,
  occurred_at timestamptz not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_people (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  external_id text,
  name text not null,
  role text,
  status text,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_decisions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  question text not null,
  context jsonb not null default '[]'::jsonb,
  evidence_ids jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  status text not null check (status in ('draft','ready','confirmed','acted','observed','closed')),
  selected_option_id uuid,
  confirmation_required boolean not null default false,
  confirmation_confirmed boolean not null default false,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_decision_options (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.business_decisions(id) on delete cascade,
  label text not null,
  description text,
  evidence_ids jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.business_decision_scenarios (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.business_decisions(id) on delete cascade,
  label text not null,
  assumptions jsonb not null default '[]'::jsonb,
  expected_outcomes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.business_decisions
  add constraint business_decisions_selected_option_fk
  foreign key (selected_option_id) references public.business_decision_options(id) on delete set null;

create table if not exists public.action_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  action_id text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  state text not null check (state in ('requested','blocked','confirmed','executed','failed')),
  confirmation_id text,
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.business_outcomes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  decision_id uuid references public.business_decisions(id) on delete set null,
  action_event_id uuid references public.action_events(id) on delete set null,
  metric text not null,
  expected_value numeric,
  observed_value numeric,
  unit text,
  observed_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.busiq_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  type text not null,
  status text not null check (status in ('queued','processing','completed','failed','retrying')),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  storage_path text,
  mime_type text,
  source text not null,
  status text not null check (status in ('queued','processing','ready','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding extensions.vector(384),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);

create index if not exists business_customers_business_idx on public.business_customers(business_id);
create index if not exists business_products_business_idx on public.business_products(business_id);
create index if not exists business_sales_business_time_idx on public.business_sales(business_id, occurred_at desc);
create index if not exists business_money_business_time_idx on public.business_money(business_id, occurred_at desc);
create index if not exists business_inventory_business_product_idx on public.business_inventory(business_id, product_id);
create index if not exists business_suppliers_business_idx on public.business_suppliers(business_id);
create index if not exists business_operations_business_time_idx on public.business_operations(business_id, occurred_at desc);
create index if not exists business_projects_business_idx on public.business_projects(business_id);
create index if not exists business_marketing_business_time_idx on public.business_marketing(business_id, occurred_at desc);
create index if not exists business_people_business_idx on public.business_people(business_id);
create index if not exists business_decisions_business_idx on public.business_decisions(business_id);
create index if not exists business_decision_options_decision_idx on public.business_decision_options(decision_id);
create index if not exists business_decision_scenarios_decision_idx on public.business_decision_scenarios(decision_id);
create index if not exists action_events_business_time_idx on public.action_events(business_id, created_at desc);
create index if not exists business_outcomes_business_time_idx on public.business_outcomes(business_id, observed_at desc);
create index if not exists busiq_jobs_status_time_idx on public.busiq_jobs(status, available_at);
create index if not exists knowledge_documents_business_idx on public.knowledge_documents(business_id);
create index if not exists knowledge_chunks_business_idx on public.knowledge_chunks(business_id);
create index if not exists knowledge_chunks_document_idx on public.knowledge_chunks(document_id);
create index if not exists knowledge_chunks_hnsw_idx on public.knowledge_chunks using hnsw (embedding vector_cosine_ops);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_customers','business_products','business_sales','business_money',
    'business_inventory','business_suppliers','business_operations','business_projects',
    'business_marketing','business_people','business_decisions','business_decision_options',
    'business_decision_scenarios','action_events','business_outcomes','busiq_jobs',
    'knowledge_documents','knowledge_chunks'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

revoke all on table
  public.business_customers, public.business_products, public.business_sales, public.business_money,
  public.business_inventory, public.business_suppliers, public.business_operations, public.business_projects,
  public.business_marketing, public.business_people, public.business_decisions,
  public.business_decision_options, public.business_decision_scenarios, public.action_events,
  public.business_outcomes, public.busiq_jobs, public.knowledge_documents, public.knowledge_chunks
from anon;

grant select, insert, update, delete on table
  public.business_customers, public.business_products, public.business_sales, public.business_money,
  public.business_inventory, public.business_suppliers, public.business_operations, public.business_projects,
  public.business_marketing, public.business_people, public.business_decisions,
  public.business_decision_options, public.business_decision_scenarios, public.business_outcomes,
  public.knowledge_documents, public.knowledge_chunks
to authenticated;

grant select on table public.action_events, public.busiq_jobs to authenticated;

grant all on table
  public.business_customers, public.business_products, public.business_sales, public.business_money,
  public.business_inventory, public.business_suppliers, public.business_operations, public.business_projects,
  public.business_marketing, public.business_people, public.business_decisions,
  public.business_decision_options, public.business_decision_scenarios, public.action_events,
  public.business_outcomes, public.busiq_jobs, public.knowledge_documents, public.knowledge_chunks
to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_customers','business_products','business_sales','business_money',
    'business_inventory','business_suppliers','business_operations','business_projects',
    'business_marketing','business_people','business_decisions','action_events',
    'business_outcomes','busiq_jobs','knowledge_documents','knowledge_chunks'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_member_select', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_business_member(business_id)))', table_name || '_member_select', table_name);
  end loop;
end $$;

create policy "business decision options member select"
on public.business_decision_options for select to authenticated
using (exists (select 1 from public.business_decisions d where d.id = decision_id and (select private.is_business_member(d.business_id))));

create policy "business decision scenarios member select"
on public.business_decision_scenarios for select to authenticated
using (exists (select 1 from public.business_decisions d where d.id = decision_id and (select private.is_business_member(d.business_id))));

create policy "business customers member write"
on public.business_customers for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "business products member write"
on public.business_products for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "business sales member write"
on public.business_sales for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "business money member write"
on public.business_money for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "business inventory member write"
on public.business_inventory for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "business suppliers member write"
on public.business_suppliers for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "business operations member write"
on public.business_operations for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "business projects member write"
on public.business_projects for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "business marketing member write"
on public.business_marketing for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "business people member write"
on public.business_people for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "business decisions member write"
on public.business_decisions for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "business decision options member write"
on public.business_decision_options for all to authenticated
using (exists (select 1 from public.business_decisions d where d.id = decision_id and (select private.is_business_member(d.business_id))))
with check (exists (select 1 from public.business_decisions d where d.id = decision_id and (select private.is_business_member(d.business_id))));

create policy "business decision scenarios member write"
on public.business_decision_scenarios for all to authenticated
using (exists (select 1 from public.business_decisions d where d.id = decision_id and (select private.is_business_member(d.business_id))))
with check (exists (select 1 from public.business_decisions d where d.id = decision_id and (select private.is_business_member(d.business_id))));

create policy "business outcomes member write"
on public.business_outcomes for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "knowledge documents member write"
on public.knowledge_documents for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "knowledge chunks member write"
on public.knowledge_chunks for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "action events member select"
on public.action_events for select to authenticated
using ((select private.is_business_member(business_id)));

create policy "job member select"
on public.busiq_jobs for select to authenticated
using (business_id is null or (select private.is_business_member(business_id)));

revoke insert, update, delete on table public.action_events, public.busiq_jobs from authenticated;
