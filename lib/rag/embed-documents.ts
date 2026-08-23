import { embedMany } from "ai";
import { env } from "@/lib/env";
import { resolveEmbeddingProvider } from "@/lib/chat/resolve-embedding-provider";
import { PREFIXED_EMBEDDING_MODELS } from "./prefixed-embedding-models";

/**
 * Batch embeds document chunks using per-user provider. Returns empty array for empty input.
 *
 * @async
 * @param texts - Document chunk texts to embed
 * @param userId - User ID for provider resolution
 * @returns Array of embedding vectors
 * @throws If provider not configured or embedding API fails
 * @author Maruf Bepary
 */
export async function embedDocuments(
  texts: string[],
  userId: string,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const resolved = await resolveEmbeddingProvider(userId);
  const embeddingModel = resolved.sdkProvider.textEmbeddingModel(
    resolved.modelId,
  );

  const values = PREFIXED_EMBEDDING_MODELS.has(resolved.modelId)
    ? texts.map((t) => `passage: ${t}`)
    : texts;

  // Embedding providers cap the number of values per request; split into
  // batches and concatenate in order.
  const embeddings: number[][] = [];
  for (let i = 0; i < values.length; i += env.EMBEDDING_BATCH_SIZE) {
    const batch = values.slice(i, i + env.EMBEDDING_BATCH_SIZE);
    const result = await embedMany({ model: embeddingModel, values: batch });
    embeddings.push(...result.embeddings);
  }
  return embeddings;
}
