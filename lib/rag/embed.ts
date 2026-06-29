import { embed, embedMany } from "ai";
import { resolveEmbeddingProvider } from "@/lib/chat/resolve-embedding-provider";

const PREFIXED_EMBEDDING_MODELS = new Set([
  "nvidia/llama-nemotron-embed-vl-1b-v2:free",
]);

/**
 * Embeds a search query using per-user provider with optional model-specific prefixes.
 *
 * @async
 * @param text - Search query text to embed
 * @param userId - User ID for provider resolution
 * @returns Embedding vector
 * @throws If provider not configured or embedding API fails
 * @author Maruf Bepary
 */
export async function embedQuery(
  text: string,
  userId: string,
): Promise<number[]> {
  const resolved = await resolveEmbeddingProvider(userId);
  const embeddingModel = resolved.sdkProvider.textEmbeddingModel(
    resolved.modelId,
  );

  const value = PREFIXED_EMBEDDING_MODELS.has(resolved.modelId)
    ? `query: ${text}`
    : text;

  const { embedding } = await embed({
    model: embeddingModel,
    value,
  });
  return embedding;
}

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
