import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "@/config/env";
import { getLogger } from "@/lib/logger";
import type { ScoredChunk } from "@/types/rag/chunk-result";

const log = getLogger(["app", "rag", "qdrant"]);

/** In-memory cache of verified collections to avoid redundant HTTP collectionExists calls. */
const verifiedCollections = new Set<string>();

/** Clears the in-memory verified collections cache (used in tests). */
export function clearCollectionCache(): void {
  verifiedCollections.clear();
}

/**
 * Payload schema stored alongside vectors in Qdrant points.
 */
export type QdrantChunkPayload = {
  content: string;
  kbId: string;
  documentId: string;
  chunkIndex: number;
  tokenCount: number;
  documentName: string;
  kbName: string;
  s3Key: string;
};

/** Singleton Qdrant client instance connecting via configured environment variables. */
const qdrantClient = new QdrantClient({
  url: env.QDRANT_URL,
  apiKey: env.QDRANT_API_KEY || undefined,
});

/**
 * Derives the collection name for a given embedding vector dimensionality.
 *
 * @param dimensions Vector dimensionality (e.g. 1024, 1536, 2048)
 * @returns Partitioned collection name
 */
export function getCollectionName(dimensions: number): string {
  return `kb_chunks_${dimensions}`;
}

/**
 * Maps a Qdrant query result point with payload into a ScoredChunk.
 *
 * @param point - Target point
 * @returns The resolved result
 * @author Maruf Bepary
 */
function pointToScoredChunk(point: {
  id: string | number;
  payload?: Record<string, unknown> | null;
}): ScoredChunk {
  const p = (point.payload || {}) as Partial<QdrantChunkPayload>;
  return {
    id: String(point.id),
    content: p.content ?? "",
    documentId: p.documentId ?? "",
    documentName: p.documentName ?? "",
    s3Key: p.s3Key ?? "",
    chunkIndex: p.chunkIndex ?? 0,
    kbId: p.kbId,
    kbName: p.kbName,
  };
}

/**
 * Ensures the Qdrant collection exists for the specified vector dimensionality,
 * creating it and payload indexes (keyword on kbId/documentId, full-text on content) if absent.
 * Uses an in-memory cache to avoid duplicate network collectionExists checks.
 *
 * @param dimensions Embedding vector size
 * @returns Collection name
 */
export async function ensureQdrantCollection(
  dimensions: number,
): Promise<string> {
  const collectionName = getCollectionName(dimensions);
  if (verifiedCollections.has(collectionName)) {
    return collectionName;
  }

  const existsRes = await qdrantClient.collectionExists(collectionName);
  const exists = typeof existsRes === "boolean" ? existsRes : existsRes?.exists;

  if (!exists) {
    log.info("Creating Qdrant collection {collection} (dimensions: {dim})", {
      collection: collectionName,
      dim: dimensions,
    });

    await qdrantClient.createCollection(collectionName, {
      vectors: {
        size: dimensions,
        distance: "Cosine",
      },
    });

    const indexes: Array<{
      field_name: string;
      field_schema: "keyword" | "text" | "integer";
    }> = [
      { field_name: "kbId", field_schema: "keyword" },
      { field_name: "documentId", field_schema: "keyword" },
      { field_name: "content", field_schema: "text" },
      { field_name: "chunkIndex", field_schema: "integer" },
    ];
    for (const idx of indexes) {
      await qdrantClient.createPayloadIndex(collectionName, idx);
    }
  }

  verifiedCollections.add(collectionName);
  return collectionName;
}

/**
 * Upserts chunk points (vector + metadata payload) into Qdrant.
 *
 * @param dimensions Vector dimensionality
 * @param points Array of points to upsert
 */
export async function upsertChunkPoints(
  dimensions: number,
  points: Array<{
    id: string;
    vector: number[];
    payload: QdrantChunkPayload;
  }>,
): Promise<void> {
  if (points.length === 0) return;

  const collectionName = await ensureQdrantCollection(dimensions);
  await qdrantClient.upsert(collectionName, { wait: true, points });
  log.debug("Upserted {count} points into Qdrant {collection}", {
    count: points.length,
    collection: collectionName,
  });
}

/**
 * Performs semantic vector search on Qdrant, filtered by knowledge base IDs and optional document IDs.
 *
 * @param dimensions Embedding vector dimensionality
 * @param vector Query embedding vector
 * @param kbIds Knowledge base UUIDs to scope retrieval
 * @param limit Maximum candidate results to return
 * @param documentIds Optional document UUIDs to scope retrieval
 * @returns Array of ScoredChunk objects sorted by similarity
 */
export async function searchSemanticVectors(
  dimensions: number,
  vector: number[],
  kbIds: string[],
  limit: number,
  documentIds?: string[],
): Promise<ScoredChunk[]> {
  if (kbIds.length === 0) return [];

  const collectionName = await ensureQdrantCollection(dimensions);
  const must: Record<string, unknown>[] = [
    { key: "kbId", match: { any: kbIds } },
  ];
  if (documentIds?.length) {
    must.push({ key: "documentId", match: { any: documentIds } });
  }

  const res = await qdrantClient.query(collectionName, {
    query: vector,
    filter: { must },
    limit,
    with_payload: true,
  });

  return (res.points || []).map(pointToScoredChunk);
}

/**
 * Performs full-text keyword search on Qdrant chunk text, filtered by KB IDs and optional doc IDs.
 *
 * @param dimensions Embedding vector dimensionality
 * @param queryText Search query text
 * @param kbIds Knowledge base UUIDs to scope retrieval
 * @param limit Maximum candidate results to return
 * @param documentIds Optional document UUIDs to scope retrieval
 * @returns Array of ScoredChunk objects matching text query
 */
export async function searchKeywordChunks(
  dimensions: number,
  queryText: string,
  kbIds: string[],
  limit: number,
  documentIds?: string[],
): Promise<ScoredChunk[]> {
  if (kbIds.length === 0 || !queryText.trim()) return [];

  const collectionName = await ensureQdrantCollection(dimensions);
  const must: Record<string, unknown>[] = [
    { key: "kbId", match: { any: kbIds } },
    { key: "content", match: { text: queryText } },
  ];
  if (documentIds?.length) {
    must.push({ key: "documentId", match: { any: documentIds } });
  }

  const res = await qdrantClient.query(collectionName, {
    filter: { must },
    limit,
    with_payload: true,
  });

  return (res.points || []).map(pointToScoredChunk);
}

/**
 * Fetches chunk points for a document across collections, filtered by chunkIndex range and sorted ascending.
 *
 * @param documentId - Target document UUID
 * @param kbIds - Scoped knowledge base UUIDs
 * @param startIndex - Optional inclusive lower bound chunk index
 * @param endIndex - Optional inclusive upper bound chunk index
 * @returns Array of ScoredChunk objects sorted ascending by chunkIndex
 * @author Maruf Bepary
 */
export async function getDocumentChunksByRange(
  documentId: string,
  kbIds: string[],
  startIndex?: number,
  endIndex?: number,
): Promise<ScoredChunk[]> {
  if (kbIds.length === 0) return [];

  const collectionsRes = await qdrantClient.getCollections();
  const chunks: ScoredChunk[] = [];

  for (const col of collectionsRes.collections) {
    if (!col.name.startsWith("kb_chunks_")) continue;

    const res = await qdrantClient.scroll(col.name, {
      filter: {
        must: [
          { key: "documentId", match: { value: documentId } },
          { key: "kbId", match: { any: kbIds } },
        ],
      },
      limit: 1000,
      with_payload: true,
    });

    for (const point of res.points || []) {
      const chunk = pointToScoredChunk(point);
      if (startIndex !== undefined && chunk.chunkIndex < startIndex) continue;
      if (endIndex !== undefined && chunk.chunkIndex > endIndex) continue;
      chunks.push(chunk);
    }
  }

  return chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
}

/**
 * Deletes all points belonging to a specific document across all chunk collections.
 *
 * @param documentId Document UUID
 */
export async function deletePointsByDocumentId(
  documentId: string,
): Promise<void> {
  const collectionsRes = await qdrantClient.getCollections();
  for (const col of collectionsRes.collections) {
    if (col.name.startsWith("kb_chunks_")) {
      await qdrantClient.delete(col.name, {
        wait: true,
        filter: { must: [{ key: "documentId", match: { value: documentId } }] },
      });
    }
  }
}

/**
 * Deletes all points belonging to the specified knowledge base IDs across all chunk collections.
 *
 * @param kbIds Knowledge base UUIDs
 */
export async function deletePointsByKbIds(kbIds: string[]): Promise<void> {
  if (kbIds.length === 0) return;

  const collectionsRes = await qdrantClient.getCollections();
  for (const col of collectionsRes.collections) {
    if (col.name.startsWith("kb_chunks_")) {
      await qdrantClient.delete(col.name, {
        wait: true,
        filter: { must: [{ key: "kbId", match: { any: kbIds } }] },
      });
    }
  }
}
