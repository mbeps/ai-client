/**
 * Attempts to parse a string as JSON, returning the parsed value on success
 * or the original string on failure.
 */
export function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
