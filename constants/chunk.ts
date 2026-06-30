/**
 * Character-level approximation for token count.
 * Used for semantic chunking and token budget estimation.
 * 1 token ≈ 4 characters (common approximation for English text)
 * @author Maruf Bepary
 */
const DEFAULT_CHARS = 1_600; // ~400 tokens

/**
 * Overlap between adjacent chunks to preserve context across boundaries.
 * Ensures semantic continuity when chunks are searched independently.
 * @author Maruf Bepary
 */
const DEFAULT_OVERLAP = 200; // ~50 tokens

/**
 * Separators attempted in order for intelligent text splitting.
 * Attempts to split at semantic boundaries (paragraphs, sentences)
 * before resorting to character-level splitting.
 * @author Maruf Bepary
 */
const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

export const CHUNK_CONSTANTS = {
  DEFAULT_CHARS,
  DEFAULT_OVERLAP,
  SEPARATORS,
} as const;
