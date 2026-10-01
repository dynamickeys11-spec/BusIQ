-- Prevent anonymous Supabase Auth users from reaching business-owned data.
-- Anonymous Auth users use the authenticated Postgres role, so this restrictive
-- policy must explicitly distinguish them via the is_anonymous JWT claim.

do $$
declare
  t text;
begin
  foreach t in array array[
    'businesses','business_members','business_context','business_customers','business_decisions',
    'business_inventory','business_marketing','business_members','business_money','business_operations',
    'business_outcomes','business_people','business_products','business_projects','business_sales',
    'business_suppliers','busiq_jobs','intelligence_runs','knowledge_chunks','knowledge_documents',
    'learned_rules','learning_embeddings','learning_examples','library_items','work_items','action_events'
  ]
  loop
    execute format('drop policy if exists "permanent_users_only" on public.%I', t);
    execute format(
      'create policy "permanent_users_only" on public.%I as restrictive for all to authenticated using ((select coalesce((auth.jwt()->>''is_anonymous'')::boolean, false)) is false) with check ((select coalesce((auth.jwt()->>''is_anonymous'')::boolean, false)) is false)',
      t
    );
  end loop;
end $$;
