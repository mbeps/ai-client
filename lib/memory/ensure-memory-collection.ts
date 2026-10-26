import { getLogger } from "@/lib/logger";
import { getMemoryCollectionName } from "@/lib/memory/get-memory-collection-name";
import { verifiedMemoryCollections } from "@/lib/memory/verified-memory-collections";
import { qdrantClient } from "@/lib/rag/qdrant-client";

const log = getLogger(["app", "memory", "qdrant"]);

/**
 * Ensures the Qdrant collection exists for user memories at the specified dimensions.
 *
 * @param dimensions - Vector dimensionality of the embedding model
 * @returns The Qdrant collection name
 * @author Maruf Bepary
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
