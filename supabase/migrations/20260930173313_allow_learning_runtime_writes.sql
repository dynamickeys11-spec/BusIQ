create policy "members can insert learning embeddings"
on public.learning_embeddings for insert to authenticated
with check (private.is_business_member(business_id));

create policy "members can insert learned rule candidates"
on public.learned_rules for insert to authenticated
with check (private.is_business_member(business_id));
