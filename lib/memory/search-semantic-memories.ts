import { ensureMemoryCollection } from "@/lib/memory/ensure-memory-collection";
import type { QdrantMemoryPayload } from "@/lib/memory/qdrant-memory-payload";
import type { ScoredMemory } from "@/lib/memory/scored-memory";
import { qdrantClient } from "@/lib/rag/qdrant-client";

/**
 * Searches semantic vectors for memories belonging to a specific user.
 *
 * @param dimensions - Vector dimensionality of the embedding model
 * @param vector - Query embedding vector
 * @param userId - ID of the owning user
 * @param limit - Maximum number of results
 * @returns Scored memory items
 * @author Maruf Bepary
 */
export async function searchSemanticMemories(
  dimensions: number,
  vector: number[],
  userId: string,
  limit: number,
): Promise<ScoredMemory[]> {
  const collectionName = await ensureMemoryCollection(dimensions);
  const res = await qdrantClient.query(collectionName, {
    query: vector,
    filter: {
      must: [{ key: "userId", match: { value: userId } }],
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
