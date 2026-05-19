/**
 * Standard error message for missing OpenRouter API key.
 * Used across the application to identify and handle API configuration issues.
 */
export const MISSING_API_KEY_ERROR =
  "OpenRouter API key not found. Please add your key in Settings > App.";

/**
 * Checks if a given error message corresponds to a missing API key.
 *
 * @param message - The error message to check
 * @returns True if the message is the standardized API key error
 */
export function isApiKeyError(message: string): boolean {
  return message === MISSING_API_KEY_ERROR;
}
