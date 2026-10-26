import { tryParseJson } from "@/lib/transform/try-parse-json";

/**
 * Ensures a tool payload is in normalised (object) form: if it is a string, tries JSON.parse; otherwise returns it as-is.
 *
 * @param payload - Target payload
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function normaliseToolPayload(payload: unknown): unknown {
  if (typeof payload === "string") {
    return tryParseJson(payload);
  }

  return payload;
}
