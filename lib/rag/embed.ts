import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { env } from "@/lib/env";

/** Output dimensions for nvidia/llama-nemotron-embed-vl-1b-v2 */
export const EMBEDDING_DIMENSIONS = 2048;

const MODEL_ID = "nvidia/llama-nemotron-embed-vl-1b-v2:free";

const embeddingModel = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: env.OPENROUTER_API_KEY,
}).embedding(MODEL_ID);

/**
 * Embeds a search query using the required "query:" prefix.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: `query: ${text}`,
  });
  return embedding;
}

/**
 * Embeds document passages in batch using the required "passage:" prefix.
 */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts.map((t) => `passage: ${t}`),
  });
  return embeddings;
}
