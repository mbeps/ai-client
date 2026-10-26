import { qdrantClient } from "@/lib/rag/qdrant-client";

/**
 * Deletes memory points by their UUIDs across all memory collections.
 *
 * @param memoryIds - Array of memory UUIDs to delete
 * @author Maruf Bepary
 */
export async function deleteMemoryPoints(memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) return;
  const collectionsRes = await qdrantClient.getCollections();
  for (const col of collectionsRes.collections) {
    if (col.name.startsWith("user_memories_")) {
      await qdrantClient.delete(col.name, {
        wait: true,
        points: memoryIds,
      });
    }
  }
}
