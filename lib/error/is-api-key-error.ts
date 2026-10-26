import { MISSING_API_KEY_ERROR } from "@/lib/error/missing-api-key-error";

/**
 * Checks if a given error message corresponds to a missing API key.
 *
 * @param message - The error message to check
 * @returns True if the message is the standardized API key error
 */
export function isApiKeyError(message: string): boolean {
  return (
    message === MISSING_API_KEY_ERROR ||
    message.includes("No AI provider") ||
    message.includes("provider/model configured")
  );
}
