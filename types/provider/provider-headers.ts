/**
 * Custom HTTP headers for provider (e.g., Authorization, X-Custom-Header).
 * Stored encrypted (AES-256-GCM) in database, decrypted on retrieval.
 *
 * @typedef {Record<string, string>} ProviderHeaders
 * @security Headers encrypted at rest
 * @author Maruf Bepary
 */
export type ProviderHeaders = Record<string, string>;
