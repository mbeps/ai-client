import { embed, embedMany } from "ai";
import { resolveEmbeddingProvider } from "@/lib/chat/resolve-provider";

const PREFIXED_EMBEDDING_MODELS = new Set([
  "nvidia/llama-nemotron-embed-vl-1b-v2:free",
]);

/**
 * Embeds a search query using the required "query:" prefix.
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
 * Embeds document passages in batch using the required "passage:" prefix.
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
