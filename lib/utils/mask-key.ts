/**
 * Masks a sensitive API key for display in the UI.
 * Returns a string like 'sk-or-v1-abcd...****'.
 *
 * @param key - The decrypted API key to mask
 * @returns The masked key string
 * @author Maruf Bepary
 */
export function maskKey(key: string): string {
  if (!key) return "";

  // For OpenRouter keys, they typically start with 'sk-or-v1-'
  // We want to keep the prefix and a few characters of the actual key
  const prefix = key.slice(0, 12);
  return `${prefix}...****`;
}

/**
 * Checks if a string appears to be a masked API key.
 *
 * @param key - The string to check
 * @returns True if the string follows the mask pattern
 * @author Maruf Bepary
 */
export function isMaskedKey(key: string): boolean {
  if (!key) return false;
  return key.endsWith("****") || key.includes("...");
}
