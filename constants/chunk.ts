/**
 * Character-level approximation for token count.
 * Used for semantic chunking and token budget estimation.
 * 1 token ≈ 4 characters (common approximation for English text)
 * ponytail: falls back to literals because this module may be imported
 * client-side where the server-only env parse is partial.
 * @author Maruf Bepary
 */
import { env } from "@/lib/env";

const DEFAULT_CHARS = env.DEFAULT_CHUNK_SIZE ?? 1_600; // ~400 tokens

/**
 * Overlap between adjacent chunks to preserve context across boundaries.
 * Ensures semantic continuity when chunks are searched independently.
 * @author Maruf Bepary
 */
const DEFAULT_OVERLAP = env.DEFAULT_CHUNK_OVERLAP ?? 200; // ~50 tokens

/**
 * Separators attempted in order for intelligent text splitting.
 * Attempts to split at semantic boundaries (paragraphs, sentences)
 * before resorting to character-level splitting.
 * @author Maruf Bepary
 */
const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

/**
 * RRF (Reciprocal Rank Fusion) constant for hybrid search scoring.
 * Balances vector and full-text search rankings using: 1 / (k + rank)
 * @author Maruf Bepary
 */
const RRF_K = 60;

export const CHUNK_CONSTANTS = {
  DEFAULT_CHARS,
  DEFAULT_OVERLAP,
  SEPARATORS,
  RRF_K,
} as const;
