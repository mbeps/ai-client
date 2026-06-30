import { CHUNK_CONSTANTS } from "@/constants/chunk";
import { type ChunkResult } from "@/types/rag/chunk-result";
import { type RawChunkRow } from "@/types/rag/raw-chunk-row";

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
    scoreMap.set(row.id, {
      row,
      score: 1 / (CHUNK_CONSTANTS.RRF_K + idx + 1),
    });
  });

  ftsRows.forEach((row, idx) => {
    const rrfScore = 1 / (CHUNK_CONSTANTS.RRF_K + idx + 1);
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
