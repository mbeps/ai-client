// Approximation: 1 token ≈ 4 characters
const DEFAULT_CHUNK_CHARS = 1_600; // ~400 tokens
const DEFAULT_OVERLAP_CHARS = 200; // ~50 tokens
const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

export function chunkText(
  text: string,
  options: { chunkSize?: number; overlap?: number } = {},
): string[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_CHARS;
  const overlap = options.overlap ?? DEFAULT_OVERLAP_CHARS;
  return splitRecursive(text.trim(), SEPARATORS, chunkSize, overlap);
}

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
