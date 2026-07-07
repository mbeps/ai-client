import { embedMany } from "ai";
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

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values,
  });
  return embeddings;
}
