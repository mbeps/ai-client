import { matchesErrorPatterns } from "@/lib/error/matches-error-patterns";

/**
 * True when the error indicates an invalid/rejected API key.
 *
 * @param error - Target error
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function isInvalidApiKey(error: unknown): boolean {
  const err = error as any;
  if (
    err?.statusCode === 401 ||
    err?.status === 401 ||
    err?.lastError?.statusCode === 401 ||
    err?.response?.status === 401
  ) {
    return true;
  }
  return matchesErrorPatterns(error, [
    "invalid api key",
    "incorrect api key",
    "invalidapikey",
    "invalid_api_key",
    "unauthorized credentials",
    "unauthorized",
  ]);
}
