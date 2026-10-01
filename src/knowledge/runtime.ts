import type { SupabaseClient } from "@supabase/supabase-js";

export type RetrievedKnowledge = {
  id: string;
  documentId: string;
  content: string;
  similarity: number;
};

export async function retrieveKnowledge(
  supabase: SupabaseClient,
  businessId: string,
  query: string,
): Promise<RetrievedKnowledge[]> {
  const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke("busiq-embed", {
    body: { input: query },
  });
  if (embeddingError || !embeddingData?.embedding) {
    throw new Error(embeddingError?.message || "Knowledge embedding generation failed.");
  }

  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: embeddingData.embedding,
    match_threshold: 0.72,
    match_count: 8,
    filter_business_id: businessId,
  });

  if (error) throw new Error("Knowledge retrieval failed: " + error.message);

  return (data ?? []).map((row: { id: string; document_id: string; content: string; similarity: number }) => ({
    id: row.id,
    documentId: row.document_id,
    content: row.content,
    similarity: Number(row.similarity),
  }));
}
