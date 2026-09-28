import { inArray, sql } from "drizzle-orm";
import { env } from "@/config/env";
import { RAG_CONFIG } from "@/config/rag";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schema";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { normalizeRateLimitMessage } from "@/lib/error/normalize-rate-limit-message";
import { KnowledgebaseNotReadyError, RateLimitError } from "@/lib/errors";
import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "rag", "search"]);

import type { ChunkResult } from "@/types/rag/chunk-result";
import type { RawChunkRow } from "@/types/rag/raw-chunk-row";
import { applyRRF } from "./apply-rrf";
import { embedQuery } from "./embed-query";

/**
 * Performs hybrid retrieval over one or more knowledge bases using vector + full-text search.
 * Validates all knowledge bases are ready, embeds the query once, runs parallel vector and FTS queries,
 * combines results using Reciprocal Rank Fusion, and returns top K chunks.
 * Normalizes rate limit errors to user-friendly messages.
 *
 * @param kbIdOrIds - Knowledge base ID or array of IDs to search
 * @param query - User search query
 * @param userId - Authenticated user ID (for embedding provider resolution)
 * @param topK - Number of results to return (default: 5)
 * @returns Top K ranked chunks by relevance
 * @throws {KnowledgebaseNotReadyError} When any requested KB indexing is not complete
 * @throws {RateLimitError} When embedding provider rate limits the request
 * @see {@link lib/rag/chunk.ts} for chunking strategy
 * @see {@link lib/rag/embed.ts} for embedding models
 * @author Maruf Bepary
 */
export async function hybridSearch(
  kbIdOrIds: string | string[],
  query: string,
  userId: string,
  topK = env.RAG_TOP_K,
): Promise<ChunkResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const rawKbIds = Array.isArray(kbIdOrIds) ? kbIdOrIds : [kbIdOrIds];
  const kbIds = [...new Set(rawKbIds.filter(Boolean))];

  if (kbIds.length === 0) {
    return [];
  }

  // 1. Check if all requested KBs exist and are ready
  const kbs = await db
    .select({ id: knowledgebase.id, indexStatus: knowledgebase.indexStatus })
    .from(knowledgebase)
    .where(inArray(knowledgebase.id, kbIds));

  if (kbs.length !== kbIds.length) {
    throw new Error("Knowledge base not found");
  }

  for (const kb of kbs) {
    if (kb.indexStatus !== "ready") {
      throw new KnowledgebaseNotReadyError(kb.id, kb.indexStatus);
    }
  }

  // 2. Search
  let embedding: number[];
  try {
    embedding = await embedQuery(normalizedQuery, userId);
  } catch (err) {
    if (isRateLimitError(err)) {
      throw new RateLimitError(normalizeRateLimitMessage(err));
    }
    throw err;
  }
  const embeddingLiteral = `[${embedding.join(",")}]`;

  const kbInCondition =
    kbIds.length === 1
      ? sql`c.kb_id = ${kbIds[0]}`
      : sql`c.kb_id IN (${sql.join(
          kbIds.map((id) => sql`${id}`),
          sql`, `,
        )})`;

  const vectorRows = (
    await db.execute(sql`
      SELECT 
        c.id, 
        c.content, 
        c.document_id, 
        c.chunk_index,
        c.kb_id,
        k.name as kb_name,
        d.name as document_name,
        d.s3_key
      FROM kb_chunk c
      JOIN kb_document d ON c.document_id = d.id
      JOIN knowledgebase k ON c.kb_id = k.id
      WHERE ${kbInCondition}
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${embeddingLiteral}::vector
      LIMIT ${RAG_CONFIG.SEARCH_CANDIDATE_LIMIT}
    `)
  ).rows as unknown as RawChunkRow[];

  let ftsRows: RawChunkRow[] = [];
  try {
    ftsRows = (
      await db.execute(sql`
        SELECT 
          c.id, 
          c.content, 
          c.document_id, 
          c.chunk_index,
          c.kb_id,
          k.name as kb_name,
          d.name as document_name,
          d.s3_key
        FROM kb_chunk c
        JOIN kb_document d ON c.document_id = d.id
        JOIN knowledgebase k ON c.kb_id = k.id
        WHERE ${kbInCondition}
          AND c.search_vector @@ plainto_tsquery('english', ${normalizedQuery})
        ORDER BY ts_rank_cd(c.search_vector, plainto_tsquery('english', ${normalizedQuery})) DESC
        LIMIT ${RAG_CONFIG.SEARCH_CANDIDATE_LIMIT}
      `)
    ).rows as unknown as RawChunkRow[];
  } catch (err) {
    log.error("FTS query failed: {error}", {
      error: err instanceof Error ? err.message : String(err),
      kbIds,
    });
    ftsRows = [];
  }

  return applyRRF(vectorRows, ftsRows, topK);
}
