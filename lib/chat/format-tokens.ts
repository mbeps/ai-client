import { millify } from "millify";

/**
 * Formats a token count into a human-friendly string (e.g. 850, 12.4K, 371.5K, 1M, 2B).
 * Uses `millify` for consistent unit abbreviations and precision.
 *
 * @param tokens - The raw token number
 * @returns Formatted token string
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toLocaleString();
  }
  return millify(tokens, { precision: 1 });
}
