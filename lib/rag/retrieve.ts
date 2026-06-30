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

/**
 * RRF (Reciprocal Rank Fusion) constant for hybrid search scoring.
 * Balances vector and full-text search rankings using: 1 / (k + rank)
 * @author Maruf Bepary
 */
const RRF_K = 60;

/**
 * Result of a hybrid search query (vector + full-text).
 * Includes chunk content, source document metadata, and relevance score.
 * @author Maruf Bepary
 */
export type ChunkResult = {
  id: string;
  content: string;
  documentId: string;
  documentName: string;
  s3Key: string;
  chunkIndex: number;
  score: number;
};

/**
 * Raw chunk database row (before transformation to ChunkResult).
 * @author Maruf Bepary
 */
type RawChunkRow = {
  id: string;
  content: string;
  document_id: string;
  chunk_index: number;
  document_name: string;
  s3_key: string;
};

/**
 * Combines vector and full-text search results using Reciprocal Rank Fusion.
 * Gives equal weight to both search modalities, then ranks by combined score.
 * Handles duplicate results by summing their scores across modalities.
 *
 * @param vectorRows - Results from pgvector semantic search (ordered by similarity)
 * @param ftsRows - Results from PostgreSQL full-text search (ordered by relevance)
 * @param topK - Number of results to return (e.g., 5)
 * @returns Top K results ordered by combined RRF score
 * @author Maruf Bepary
 */
export function applyRRF(
  vectorRows: RawChunkRow[],
  ftsRows: RawChunkRow[],
  topK: number,
): ChunkResult[] {
  const scoreMap = new Map<string, { row: RawChunkRow; score: number }>();

  vectorRows.forEach((row, idx) => {
    scoreMap.set(row.id, { row, score: 1 / (RRF_K + idx + 1) });
  });

  ftsRows.forEach((row, idx) => {
    const rrfScore = 1 / (RRF_K + idx + 1);
    const existing = scoreMap.get(row.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scoreMap.set(row.id, { row, score: rrfScore });
    }
  });

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ row, score }) => ({
      id: row.id,
      content: row.content,
      documentId: row.document_id,
      documentName: row.document_name,
      s3Key: row.s3_key,
      chunkIndex: row.chunk_index,
      score,
    }));
}

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
