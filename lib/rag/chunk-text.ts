import { CHUNK_CONSTANTS } from "../../constants/chunk";
import { splitRecursive } from "./split-recursive";

/**
 * Splits a document into semantic chunks with overlap.
 * Uses recursive separator-based splitting to maintain readability:
 * 1. Attempts to split on double newlines (paragraphs)
 * 2. Falls back to single newlines (lines)
 * 3. Falls back to sentence boundaries ('. ')
 * 4. Falls back to word boundaries (' ')
 * 5. Falls back to character-level splitting if necessary
 *
 * Overlap preserves context across chunk boundaries for better retrieval.
 * @param text - Document text to chunk
 * @param options - Chunk size and overlap in characters (default: 1600 chars, 200 overlap)
 * @returns Array of non-empty text chunks
 * @see {@link lib/rag/ingest.ts} for embedding chunks in knowledge base
 * @author Maruf Bepary
 */
export function chunkText(
  text: string,
  options: { chunkSize?: number; overlap?: number } = {},
): string[] {
  const chunkSize = options.chunkSize ?? CHUNK_CONSTANTS.DEFAULT_CHARS;
  const overlap = options.overlap ?? CHUNK_CONSTANTS.DEFAULT_OVERLAP;
  return splitRecursive(
    text.trim(),
    CHUNK_CONSTANTS.SEPARATORS,
    chunkSize,
    overlap,
  );
}
