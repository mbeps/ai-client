import { tryParseJson } from "@/lib/workflows/try-parse-json";

/**
 * Ensures a tool payload is in normalised form: parses JSON strings, passes objects through.
 */
export function normaliseToolPayload(payload: unknown): unknown {
  if (typeof payload === "string") {
    return tryParseJson(payload);
  }
  return payload;
}
