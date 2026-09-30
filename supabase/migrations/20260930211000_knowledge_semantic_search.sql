create or replace function public.match_knowledge_chunks(
  query_embedding extensions.vector(384),
  match_threshold float,
  match_count integer,
  filter_business_id uuid
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql
security invoker
set search_path = ''
as $$
  select
    kc.id,
    kc.document_id,
    kc.content,
    1 - (kc.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from public.knowledge_chunks kc
  where kc.business_id = filter_business_id
    and kc.embedding is not null
    and (select private.is_business_member(filter_business_id))
    and 1 - (kc.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
  order by kc.embedding OPERATOR(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

revoke execute on function public.match_knowledge_chunks(extensions.vector(384), float, integer, uuid) from public, anon;
grant execute on function public.match_knowledge_chunks(extensions.vector(384), float, integer, uuid) to authenticated;
