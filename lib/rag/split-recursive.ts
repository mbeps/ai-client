/**
 * Represents chunk accumulator.
 *
 * @author Maruf Bepary
 */
interface ChunkAccumulator {
  chunks: string[];
  current: string;
}

/**
 * Force-splits an indivisible piece into chunk-sized slices at character level.
 *
 * @param piece - Target piece
 * @param chunkSize - Target chunk size
 * @param overlap - Target overlap
 * @returns The resolved result
 * @author Maruf Bepary
 */
function forceSplitByLength(
  piece: string,
  chunkSize: number,
  overlap: number,
): string[] {
  const chunks: string[] = [];
  const step = Math.max(1, chunkSize - overlap);
  for (let i = 0; i < piece.length; i += step) {
    const slice = piece.slice(i, i + chunkSize);
    if (slice) chunks.push(slice);
  }
  return chunks;
}

/**
 * Splits a piece that exceeds chunkSize either via remaining separators or forced length splitting.
 *
 * @param piece - Target piece
 * @param remainingSeps - Target remaining seps
 * @param chunkSize - Target chunk size
 * @param overlap - Target overlap
 * @returns The resolved result
 * @author Maruf Bepary
 */
function splitOversizedPiece(
  piece: string,
  remainingSeps: readonly string[],
  chunkSize: number,
  overlap: number,
): string[] {
  if (remainingSeps.length > 0) {
    return splitRecursive(piece, remainingSeps, chunkSize, overlap);
  }
  return forceSplitByLength(piece, chunkSize, overlap);
}

/**
 * Appends a split piece into accumulator, handling overflow and overlap preservation.
 *
 * @param piece - Target piece
 * @param acc - Target acc
 * @param sep - Target sep
 * @param nextSeps - Target next seps
 * @param chunkSize - Target chunk size
 * @param overlap - Target overlap
 * @returns The resolved result
 * @author Maruf Bepary
 */
function appendPieceToChunks(
  piece: string,
  acc: ChunkAccumulator,
  sep: string,
  nextSeps: readonly string[],
  chunkSize: number,
  overlap: number,
): void {
  const candidate = acc.current ? acc.current + sep + piece : piece;
  if (candidate.length <= chunkSize) {
    acc.current = candidate;
    return;
  }

  if (acc.current) {
    acc.chunks.push(acc.current);
    acc.current = acc.current.slice(-overlap) + sep + piece;
    if (piece.length > chunkSize || acc.current.length >= chunkSize) {
      acc.chunks.push(
        ...splitOversizedPiece(piece, nextSeps, chunkSize, overlap),
      );
      acc.current = "";
    }
    return;
  }

  acc.chunks.push(...splitOversizedPiece(piece, nextSeps, chunkSize, overlap));
  acc.current = "";
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
export function splitRecursive(
  text: string,
  separators: readonly string[] | string[],
  chunkSize: number,
  overlap: number,
): string[] {
  if (text.length <= chunkSize) return text ? [text] : [];

  const sep = separators.find((s) => text.includes(s)) ?? "";
  const splits = sep ? text.split(sep) : [text];
  const sepIdx = sep ? separators.indexOf(sep) : -1;
  const nextSeps = sepIdx >= 0 ? separators.slice(sepIdx + 1) : [];

  const acc: ChunkAccumulator = { chunks: [], current: "" };

  for (const piece of splits) {
    appendPieceToChunks(piece, acc, sep, nextSeps, chunkSize, overlap);
  }

  if (acc.current) acc.chunks.push(acc.current);
  return acc.chunks.filter((c) => c.trim().length > 0);
}
