import { ensureMemoryCollection } from "@/lib/memory/ensure-memory-collection";
import type { QdrantMemoryPayload } from "@/lib/memory/qdrant-memory-payload";
import type { ScoredMemory } from "@/lib/memory/scored-memory";
import { qdrantClient } from "@/lib/rag/qdrant-client";

/**
 * Searches keyword chunks on memory text for a specific user.
 *
 * @param dimensions - Vector dimensionality of the embedding model
 * @param queryText - Keyword query text
 * @param userId - ID of the owning user
 * @param limit - Maximum number of results
 * @returns Scored memory items
 * @author Maruf Bepary
 */
export async function searchKeywordMemories(
  dimensions: number,
  queryText: string,
  userId: string,
  limit: number,
): Promise<ScoredMemory[]> {
  if (!queryText.trim()) return [];

  const collectionName = await ensureMemoryCollection(dimensions);
  const res = await qdrantClient.query(collectionName, {
    filter: {
      must: [
        { key: "userId", match: { value: userId } },
        { key: "content", match: { text: queryText } },
      ],
    },
    limit,
    with_payload: true,
  });

  return (res.points || []).map((point) => {
    const payload = (point.payload || {}) as Partial<QdrantMemoryPayload>;
    return {
      id: String(point.id),
      content: payload.content ?? "",
      score: point.score,
    };
  });
}
