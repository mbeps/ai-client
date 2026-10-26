/**
 * Duck-types an error by message pattern. Providers express failures
 * inconsistently (no shared status codes), so matching relies on well-known
 * message fragments, matched case-insensitively.
 *
 * @author Maruf Bepary
 */
export function matchesErrorPatterns(
  error: unknown,
  patterns: string[],
): boolean {
  const message = String((error as Error | null)?.message ?? "").toLowerCase();
  if (!message) return false;
  return patterns.some((p) => message.includes(p));
}
