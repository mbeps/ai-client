import { ensureMemoryCollection } from "@/lib/memory/ensure-memory-collection";
import { qdrantClient } from "@/lib/rag/qdrant-client";

/**
 * Upserts a single user memory point into Qdrant.
 *
 * @param dimensions - Vector dimensionality of the embedding model
 * @param point - Memory point to upsert
 * @author Maruf Bepary
 */
export async function upsertMemoryPoint(
  dimensions: number,
  point: {
    id: string;
    vector: number[];
    userId: string;
    content: string;
  },
): Promise<void> {
  const collectionName = await ensureMemoryCollection(dimensions);
  await qdrantClient.upsert(collectionName, {
    wait: true,
    points: [
      {
        id: point.id,
        vector: point.vector,
        payload: {
          id: point.id,
          userId: point.userId,
          content: point.content,
        },
      },
    ],
  });
}
