import { logger } from "@/lib/logger";
import { db } from "@/drizzle/db";
import { sql, eq } from "drizzle-orm";
import { embedQuery } from "./embed";
import { KnowledgebaseNotReadyError, RateLimitError } from "@/constants/errors";
import { knowledgebase } from "@/drizzle/schema";
import {
  isRateLimitError,
  normalizeRateLimitMessage,
} from "@/lib/utils/error-utils";
import { applyRRF } from "./apply-rrf";
import { type ChunkResult } from "@/types/rag/chunk-result";
import { type RawChunkRow } from "@/types/rag/raw-chunk-row";

/**
 * Performs hybrid retrieval over a knowledge base using vector + full-text search.
 * Validates knowledge base is ready, embeds the query, runs parallel vector and FTS queries,
 * combines results using Reciprocal Rank Fusion, and returns top K chunks.
 * Normalizes rate limit errors to user-friendly messages.
 *
 * @param kbId - Knowledge base ID to search
 * @param query - User search query
 * @param userId - Authenticated user ID (for embedding provider resolution)
 * @param topK - Number of results to return (default: 5)
 * @returns Top K ranked chunks by relevance
 * @throws {KnowledgebaseNotReadyError} When KB indexing is not complete
 * @throws {RateLimitError} When embedding provider rate limits the request
 * @see {@link lib/rag/chunk.ts} for chunking strategy
 * @see {@link lib/rag/embed.ts} for embedding models
 * @author Maruf Bepary
 */
export async function hybridSearch(
  kbId: string,
  query: string,
  userId: string,
  topK = 5,
): Promise<ChunkResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  // 1. Check if KB is ready
  const [kb] = await db
    .select({ indexStatus: knowledgebase.indexStatus })
    .from(knowledgebase)
    .where(eq(knowledgebase.id, kbId))
    .limit(1);

  if (!kb) throw new Error("Knowledge base not found");
  if (kb.indexStatus !== "ready") {
    throw new KnowledgebaseNotReadyError(kbId, kb.indexStatus);
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

  const vectorRows = (
    await db.execute(sql`
      SELECT 
        c.id, 
        c.content, 
        c.document_id, 
        c.chunk_index,
        d.name as document_name,
        d.s3_key
      FROM kb_chunk c
      JOIN kb_document d ON c.document_id = d.id
      WHERE c.kb_id = ${kbId}
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${embeddingLiteral}::vector
      LIMIT 20
    `)
  ).rows as RawChunkRow[];

  let ftsRows: RawChunkRow[] = [];
  try {
    ftsRows = (
      await db.execute(sql`
        SELECT 
          c.id, 
          c.content, 
          c.document_id, 
          c.chunk_index,
          d.name as document_name,
          d.s3_key
        FROM kb_chunk c
        JOIN kb_document d ON c.document_id = d.id
        WHERE c.kb_id = ${kbId}
          AND c.search_vector @@ plainto_tsquery('english', ${normalizedQuery})
        ORDER BY ts_rank_cd(c.search_vector, plainto_tsquery('english', ${normalizedQuery})) DESC
        LIMIT 20
      `)
    ).rows as RawChunkRow[];
  } catch (err) {
    logger.error("[RAG] FTS query failed:", err);
    ftsRows = [];
  }

  return applyRRF(vectorRows, ftsRows, topK);
}
