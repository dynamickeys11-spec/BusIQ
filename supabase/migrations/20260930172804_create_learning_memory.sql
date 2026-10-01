create table public.learning_examples (
  id uuid primary key default gen_random_uuid(), business_id uuid references public.businesses(id) on delete cascade,
  request text not null, context text, answer text not null, expected_answer text,
  source text not null check (source in ('user-feedback','model-critique','benchmark','correction')),
  created_at timestamptz not null default now()
);
create table public.learning_evaluations (
  id uuid primary key default gen_random_uuid(), example_id uuid not null references public.learning_examples(id) on delete cascade,
  score numeric(5,4) not null check(score between 0 and 1), factuality numeric(5,4) not null check(factuality between 0 and 1),
  usefulness numeric(5,4) not null check(usefulness between 0 and 1), safety numeric(5,4) not null check(safety between 0 and 1),
  groundedness numeric(5,4) not null check(groundedness between 0 and 1), notes jsonb not null default '[]'::jsonb,
  passed boolean not null default false, evaluated_at timestamptz not null default now()
);
create table public.learned_rules (
  id uuid primary key default gen_random_uuid(), business_id uuid references public.businesses(id) on delete cascade,
  statement text not null, evidence_example_ids uuid[] not null default '{}',
  version integer not null default 1 check(version > 0), status text not null check(status in ('candidate','active','retired')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.learning_embeddings (
  id uuid primary key default gen_random_uuid(), business_id uuid references public.businesses(id) on delete cascade,
  example_id uuid references public.learning_examples(id) on delete cascade, content text not null,
  embedding extensions.vector(384), created_at timestamptz not null default now()
);
create index learning_examples_business_created_idx on public.learning_examples(business_id, created_at desc);
create index learning_evaluations_example_idx on public.learning_evaluations(example_id, evaluated_at desc);
create index learned_rules_business_status_idx on public.learned_rules(business_id, status);
create index learning_embeddings_business_idx on public.learning_embeddings(business_id);
create index learning_embeddings_hnsw_idx on public.learning_embeddings using hnsw (embedding vector_cosine_ops);
alter table public.learning_examples enable row level security;
alter table public.learning_evaluations enable row level security;
alter table public.learned_rules enable row level security;
alter table public.learning_embeddings enable row level security;
revoke all on public.learning_examples from anon;
revoke all on public.learning_evaluations from anon;
revoke all on public.learned_rules from anon;
revoke all on public.learning_embeddings from anon;
grant select, insert on public.learning_examples to authenticated;
grant select, insert on public.learning_evaluations to authenticated;
grant select on public.learned_rules to authenticated;
grant select on public.learning_embeddings to authenticated;
create policy learning_examples_select on public.learning_examples for select to authenticated using (business_id is null or private.is_business_member(business_id));
create policy learning_examples_insert on public.learning_examples for insert to authenticated with check (business_id is null or private.is_business_member(business_id));
create policy learning_evaluations_select on public.learning_evaluations for select to authenticated using (example_id in (select e.id from public.learning_examples e where e.business_id is null or private.is_business_member(e.business_id)));
create policy learning_evaluations_insert on public.learning_evaluations for insert to authenticated with check (example_id in (select e.id from public.learning_examples e where e.business_id is null or private.is_business_member(e.business_id)));
create policy learned_rules_select on public.learned_rules for select to authenticated using (business_id is null or private.is_business_member(business_id));
create policy learning_embeddings_select on public.learning_embeddings for select to authenticated using (business_id is null or private.is_business_member(business_id));
