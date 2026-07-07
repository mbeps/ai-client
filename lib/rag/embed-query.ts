import { embed } from "ai";
import { resolveEmbeddingProvider } from "@/lib/chat/resolve-embedding-provider";
import { PREFIXED_EMBEDDING_MODELS } from "./prefixed-embedding-models";

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
