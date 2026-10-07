import { CHUNK_CONSTANTS } from "@/config/chunk";
import type { ChunkResult, ScoredChunk } from "@/types/rag/chunk-result";

/**
 * Combines semantic vector and keyword search results using Reciprocal Rank Fusion.
 * Gives equal weight to both search modalities, then ranks by combined score.
 * Handles duplicate results by summing their scores across modalities.
 *
 * @param vectorRows - Results from Qdrant semantic vector search (ordered by similarity)
 * @param ftsRows - Results from Qdrant keyword full-text search (ordered by relevance)
 * @param topK - Number of results to return (e.g., 5)
 * @returns Top K results ordered by combined RRF score
 * @author Maruf Bepary
 */
export function applyRRF(
  vectorRows: ScoredChunk[],
  ftsRows: ScoredChunk[],
  topK: number,
): ChunkResult[] {
  const scoreMap = new Map<string, { chunk: ScoredChunk; score: number }>();

  vectorRows.forEach((chunk, idx) => {
    scoreMap.set(chunk.id, {
      chunk,
      score: 1 / (CHUNK_CONSTANTS.RRF_K + idx + 1),
    });
  });

  ftsRows.forEach((chunk, idx) => {
    const rrfScore = 1 / (CHUNK_CONSTANTS.RRF_K + idx + 1);
    const existing = scoreMap.get(chunk.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scoreMap.set(chunk.id, { chunk, score: rrfScore });
    }
  });

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score }) => ({
      ...chunk,
      score,
    }));
}
