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
export function splitRecursive(
  text: string,
  separators: readonly string[] | string[],
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
