/**
 * Character-level approximation for token count.
 * Used for semantic chunking and token budget estimation.
 * 1 token ≈ 4 characters (common approximation for English text)
 * @author Maruf Bepary
 */
const DEFAULT_CHUNK_CHARS = 1_600; // ~400 tokens

/**
 * Overlap between adjacent chunks to preserve context across boundaries.
 * Ensures semantic continuity when chunks are searched independently.
 * @author Maruf Bepary
 */
const DEFAULT_OVERLAP_CHARS = 200; // ~50 tokens

/**
 * Separators attempted in order for intelligent text splitting.
 * Attempts to split at semantic boundaries (paragraphs, sentences)
 * before resorting to character-level splitting.
 * @author Maruf Bepary
 */
const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

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
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_CHARS;
  const overlap = options.overlap ?? DEFAULT_OVERLAP_CHARS;
  return splitRecursive(text.trim(), SEPARATORS, chunkSize, overlap);
}

/**
 * Recursively splits text using progressively simpler separators.
 * Core algorithm for semantic chunking: tries to preserve meaningful
 * units (paragraphs > sentences > words > characters).
 *
 * @param text - Text to split
 * @param separators - Separators to try in order
 * @param chunkSize - Target chunk size in characters
 * @param overlap - Overlap size to preserve context
 * @returns Array of text chunks
 * @author Maruf Bepary
 */
function splitRecursive(
  text: string,
  separators: string[],
  chunkSize: number,
  overlap: number,
): string[] {
  if (text.length <= chunkSize) return text ? [text] : [];

  const sep = separators.find((s) => text.includes(s)) ?? "";
  const splits = sep ? text.split(sep) : [text];

  const chunks: string[] = [];
  let current = "";

  for (const piece of splits) {
    const candidate = current ? current + sep + piece : piece;

    if (candidate.length <= chunkSize) {
      current = candidate;
    } else {
      if (current) {
        chunks.push(current);
        // Carry overlap from end of current into next chunk
        const overlapText = current.slice(-overlap);
        current = overlapText + sep + piece;
      } else {
        // piece alone exceeds chunkSize — recurse with next separator
        const sepIdx = separators.indexOf(sep);
        const nextSeps = separators.slice(sepIdx + 1);
        if (nextSeps.length > 0) {
          chunks.push(...splitRecursive(piece, nextSeps, chunkSize, overlap));
        } else {
          // Force-split at character level
          for (let i = 0; i < piece.length; i += chunkSize - overlap) {
            const slice = piece.slice(i, i + chunkSize);
            if (slice) chunks.push(slice);
          }
        }
        current = "";
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.filter((c) => c.trim().length > 0);
}
