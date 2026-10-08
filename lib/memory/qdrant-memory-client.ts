import { getLogger } from "@/lib/logger";
import { qdrantClient } from "@/lib/rag/qdrant-client";

const log = getLogger(["app", "memory", "qdrant"]);

/**
 * In-memory cache of verified collections to avoid redundant collectionExists calls.
 */
const verifiedMemoryCollections = new Set<string>();

/**
 * Payload stored alongside vectors for user memories.
 */
export interface QdrantMemoryPayload {
  id: string;
  userId: string;
  content: string;
}

export interface ScoredMemory {
  id: string;
  content: string;
  score?: number;
}

/**
 * Clears the in-memory verified collections cache (used in tests).
 */
export function clearMemoryCollectionCache(): void {
  verifiedMemoryCollections.clear();
}

/**
 * Derives the collection name for user memories given vector dimensionality.
 */
export function getMemoryCollectionName(dimensions: number): string {
  return `user_memories_${dimensions}`;
}

/**
 * Ensures the Qdrant collection exists for user memories at the specified dimensions.
 */
export async function ensureMemoryCollection(
  dimensions: number,
): Promise<string> {
  const collectionName = getMemoryCollectionName(dimensions);
  if (verifiedMemoryCollections.has(collectionName)) {
    return collectionName;
  }

  const existsRes = await qdrantClient.collectionExists(collectionName);
  const exists = typeof existsRes === "boolean" ? existsRes : existsRes?.exists;

  if (!exists) {
    log.info(
      "Creating Qdrant memory collection {collection} (dimensions: {dim})",
      {
        collection: collectionName,
        dim: dimensions,
      },
    );

    await qdrantClient.createCollection(collectionName, {
      vectors: {
        size: dimensions,
        distance: "Cosine",
      },
    });

    await qdrantClient.createPayloadIndex(collectionName, {
      field_name: "userId",
      field_schema: "keyword",
    });

    await qdrantClient.createPayloadIndex(collectionName, {
      field_name: "content",
      field_schema: "text",
    });
  }

  verifiedMemoryCollections.add(collectionName);
  return collectionName;
}

/**
 * Upserts a single user memory point into Qdrant.
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

/**
 * Deletes memory points by their UUIDs across all memory collections.
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

/**
 * Searches semantic vectors for memories belonging to a specific user.
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

/**
 * Searches keyword chunks on memory text for a specific user.
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
