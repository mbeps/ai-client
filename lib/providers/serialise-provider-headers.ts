import type { ProviderHeaders } from "@/types/provider/provider-headers";

/**
 * Serializes headers to JSON string after filtering empty names/values. Returns null if empty.
 *
 * @param headers - Headers object to serialize
 * @returns JSON string or null if no valid headers
 * @author Maruf Bepary
 */
export function serialiseProviderHeaders(
  headers: ProviderHeaders | undefined,
): string | null {
  if (!headers) return null;

  const entries = Object.entries(headers).filter(
    ([name, value]) => name.trim().length > 0 && value.trim().length > 0,
  );

  if (entries.length === 0) return null;

  return JSON.stringify(Object.fromEntries(entries));
}
