import { embedMany } from "ai";
import { env } from "@/config/env";
import { getLogger } from "@/lib/logger";
import { resolveEmbeddingProvider } from "@/lib/providers/resolve-embedding-provider";
import { PREFIXED_EMBEDDING_MODELS } from "@/lib/rag/prefixed-embedding-models";

const log = getLogger(["app", "rag", "embeddings"]);

/**
 * Polymorphic chunk item for embedding, supporting text and multimodal images.
 */
export type IngestChunkItem =
  | { type: "text"; text: string }
  | { type: "image"; dataUrl: string; caption?: string };

/**
 * Batch embeds document chunks using per-user provider. Returns empty array for empty input.
 * Supports plain string chunks or polymorphic IngestChunkItem (text or image data URL).
 *
 * @async
 * @param chunks - Document chunk texts or polymorphic items to embed
 * @param userId - User ID for provider resolution
 * @returns Array of embedding vectors
 * @throws If provider not configured or embedding API fails
 * @author Maruf Bepary
 */
export async function embedDocuments(
  chunks: Array<string | IngestChunkItem>,
  userId: string,
): Promise<number[][]> {
  if (chunks.length === 0) return [];

  const resolved = await resolveEmbeddingProvider(userId);
  const embeddingModel = resolved.sdkProvider.embeddingModel(resolved.modelId);

  const isPrefixed = PREFIXED_EMBEDDING_MODELS.has(resolved.modelId);

  const values = chunks.map((chunk) => {
    if (typeof chunk === "string") {
      return isPrefixed ? `passage: ${chunk}` : chunk;
    }
    if (chunk.type === "text") {
      return isPrefixed ? `passage: ${chunk.text}` : chunk.text;
    }
    return chunk.dataUrl;
  });

  log.debug("Batch embedding {count} values with model {modelId}", {
    count: chunks.length,
    modelId: resolved.modelId,
  });

  // Embedding providers cap the number of values per request; split into
  // batches and concatenate in order.
  const embeddings: number[][] = [];
  for (let i = 0; i < values.length; i += env.EMBEDDING_BATCH_SIZE) {
    const batch = values.slice(i, i + env.EMBEDDING_BATCH_SIZE);
    const result = await embedMany({ model: embeddingModel, values: batch });
    embeddings.push(...result.embeddings);
  }

  log.debug("Generated {count} embeddings across batches", {
    count: embeddings.length,
  });

  return embeddings;
}
