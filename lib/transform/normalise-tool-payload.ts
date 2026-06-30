import { tryParseJson } from "./try-parse-json";

/**
 * Ensures a tool payload is in normalised (object) form: if it is a string,
 * tries JSON.parse; otherwise returns it as-is.
 */
export function normaliseToolPayload(payload: unknown): unknown {
  if (typeof payload === "string") {
    return tryParseJson(payload);
  }

  return payload;
}
