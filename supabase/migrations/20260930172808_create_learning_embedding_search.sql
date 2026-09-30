create or replace function public.match_learning_embeddings(
  query_embedding extensions.vector(384), match_threshold float, match_count integer, filter_business_id uuid
)
returns table (id uuid, example_id uuid, content text, similarity float)
language sql stable set search_path = ''
as $$
  select e.id, e.example_id, e.content, 1 - (e.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from public.learning_embeddings e
  where e.embedding is not null
    and (filter_business_id is null or e.business_id = filter_business_id)
    and (e.business_id is null or private.is_business_member(e.business_id))
    and 1 - (e.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
  order by e.embedding OPERATOR(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 50);
$$;
revoke all on function public.match_learning_embeddings(extensions.vector, float, integer, uuid) from public;
revoke all on function public.match_learning_embeddings(extensions.vector, float, integer, uuid) from anon;
grant execute on function public.match_learning_embeddings(extensions.vector, float, integer, uuid) to authenticated;
