/**
 * Normalizes API key: trims whitespace, returns null for empty/undefined values.
 *
 * @param apiKey - Raw API key
 * @returns Trimmed API key or null
 * @author Maruf Bepary
 */
export function normaliseProviderApiKey(
  apiKey: string | null | undefined,
): string | null {
  const value = apiKey?.trim();
  return value ? value : null;
}
