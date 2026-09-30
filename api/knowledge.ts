import { getAuthenticatedUser, getAuthorizedBusinessIds } from "./auth";

const MAX_CONTENT_CHARS = 200_000;
const CHUNK_SIZE = 2_400;
const CHUNK_OVERLAP = 300;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + CHUNK_SIZE);
    chunks.push(normalized.slice(start, end));
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

export default async function handler(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (request.method !== "POST") return json({ error: "Method not allowed", requestId }, 405);

  const authentication = await getAuthenticatedUser(request);
  if (!authentication.user || !authentication.supabase) {
    return json({ error: "Sign in or create an account before adding business knowledge.", requestId }, 401);
  }
  if (authentication.isAnonymous) {
    return json({ error: "Sign in or create an account before adding business knowledge.", requestId }, 403);
  }

  try {
    const body = await request.json() as {
      businessId?: string;
      title?: string;
      content?: string;
      mimeType?: string;
      source?: string;
    };

    if (!body.businessId || !body.title || !body.content) {
      return json({ error: "businessId, title and content are required.", requestId }, 400);
    }
    if (body.content.length > MAX_CONTENT_CHARS) {
      return json({ error: "Document is too large for synchronous ingestion.", requestId }, 413);
    }

    const scope = await getAuthorizedBusinessIds(authentication.supabase, authentication.user.id);
    if (scope.error) return json({ error: scope.error, requestId }, 500);
    if (!scope.businessIds.includes(body.businessId)) {
      return json({ error: "You do not have access to this business.", requestId }, 403);
    }

    const allowedMimeTypes = new Set([
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json",
    ]);
    const mimeType = body.mimeType ?? "text/plain";
    if (!allowedMimeTypes.has(mimeType)) {
      return json({
        error: "This ingestion endpoint currently accepts text, Markdown, CSV and JSON documents. PDF/DOCX extraction will run through the background document worker.",
        requestId,
        code: "DOCUMENT_FORMAT_NOT_YET_SUPPORTED",
      }, 415);
    }

    const { data: document, error: documentError } = await authentication.supabase
      .from("knowledge_documents")
      .insert({
        business_id: body.businessId,
        title: body.title.trim().slice(0, 240),
        mime_type: mimeType,
        source: body.source?.trim().slice(0, 500) || "BUSIQ upload",
        status: "processing",
        metadata: { requestId },
      })
      .select("id")
      .single();

    if (documentError || !document) {
      return json({ error: "BUSIQ could not create the knowledge document.", requestId }, 500);
    }

    const chunks = chunkText(body.content);
    for (let index = 0; index < chunks.length; index += 1) {
      const { data: embeddingData, error: embeddingError } = await authentication.supabase.functions.invoke("busiq-embed", {
        body: { input: chunks[index] },
      });
      if (embeddingError || !embeddingData?.embedding) {
        await authentication.supabase.from("knowledge_documents").update({ status: "failed" }).eq("id", document.id);
        return json({ error: "BUSIQ could not generate a knowledge embedding.", requestId }, 503);
      }

      const { error: chunkError } = await authentication.supabase.from("knowledge_chunks").insert({
        business_id: body.businessId,
        document_id: document.id,
        chunk_index: index,
        content: chunks[index],
        embedding: embeddingData.embedding,
        metadata: { characterCount: chunks[index].length },
      });

      if (chunkError) {
        await authentication.supabase.from("knowledge_documents").update({ status: "failed" }).eq("id", document.id);
        return json({ error: "BUSIQ could not persist a knowledge chunk.", requestId }, 500);
      }
    }

    await authentication.supabase.from("knowledge_documents").update({ status: "ready" }).eq("id", document.id);

    return json({ requestId, documentId: document.id, chunks: chunks.length, status: "ready" });
  } catch (error) {
    console.error(JSON.stringify({
      event: "api.knowledge.failed",
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    }));
    return json({ error: "Knowledge ingestion failed.", requestId }, 500);
  }
}
