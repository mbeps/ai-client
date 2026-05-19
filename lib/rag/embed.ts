import { embed, embedMany } from "ai";
import { getAiProvider } from "@/lib/chat/get-ai-provider";

/** Output dimensions for nvidia/llama-nemotron-embed-vl-1b-v2 */
export const EMBEDDING_DIMENSIONS = 2048;

const MODEL_ID = "nvidia/llama-nemotron-embed-vl-1b-v2:free";

/**
 * Embeds a search query using the required "query:" prefix.
 */
export async function embedQuery(
  text: string,
  userId: string,
): Promise<number[]> {
  const provider = await getAiProvider(userId);
  const embeddingModel = provider.embedding(MODEL_ID);

  const { embedding } = await embed({
    model: embeddingModel,
    value: `query: ${text}`,
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

  const provider = await getAiProvider(userId);
  const embeddingModel = provider.embedding(MODEL_ID);

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts.map((t) => `passage: ${t}`),
  });
  return embeddings;
}
