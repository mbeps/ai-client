/**
 * Models that require a task-specific prefix (e.g., "query: " or "passage: ")
 * before embedding.
 */
export const PREFIXED_EMBEDDING_MODELS = new Set([
  "nvidia/llama-nemotron-embed-vl-1b-v2:free",
]);
