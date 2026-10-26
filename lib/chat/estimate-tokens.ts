/**
 * Estimates token count for a text string using standard ~3.8 chars/token rule of thumb.
 *
 * @param text - The string to estimate tokens for
 * @returns Estimated token count (minimum 0)
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / 3.8);
}
