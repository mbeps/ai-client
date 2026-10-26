import type { ProviderHeaders } from "@/types/provider/provider-headers";

/**
 * Parses a JSON string of provider headers into a ProviderHeaders object. Safely deserialises JSON without throwing. Returns empty object if: - Input is null/falsy - JSON is invalid - Result is not a plain object - Result contains non-string values (only string values are included).
 *
 * @param raw - The raw JSON string to parse
 * @returns Parsed headers object, or empty object if parsing fails
 * @author Maruf Bepary
 */
export function parseProviderHeaders(raw: string | null): ProviderHeaders {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const output: ProviderHeaders = {};
    for (const [name, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        output[name] = value;
      }
    }

    return output;
  } catch {
    return {};
  }
}
