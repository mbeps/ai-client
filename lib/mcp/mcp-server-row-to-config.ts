import { decrypt } from "@/lib/encryption/decrypt";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";

/**
 * Safely decrypts headers if stored as AES-256-GCM ciphertext.
 * Falls back to original value if null, undefined, not a string, or already plaintext JSON.
 *
 * @param headers - Raw database headers string
 * @returns Plaintext headers JSON string or null
 */
function decryptHeaders(headers?: string | null): string | null {
  if (!headers || typeof headers !== "string") {
    return (headers as unknown as string) ?? null;
  }
  try {
    return decrypt(headers);
  } catch {
    return headers;
  }
}

function decryptSecret(secret?: string | null): string | null {
  if (!secret || typeof secret !== "string") {
    return (secret as unknown as string) ?? null;
  }
  try {
    return decrypt(secret);
  } catch {
    return secret;
  }
}

/**
 * Converts McpServerRow to McpServerConfig for SDK use.
 * Decrypts encrypted headers and oauthClientSecret at rest while safely falling back to plaintext.
 *
 * @param row - Database row from mcpServer table
 * @param userId - Optional overriding userId for installed/subscribed servers (defaults to row.userId)
 * @returns Configuration object for MCP SDK initialization
 * @author Maruf Bepary
 */
export function mcpServerRowToConfig(
  row: McpServerRow,
  userId?: string,
): McpServerConfig {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    headers: decryptHeaders(row.headers),
    authType: (row.authType as any) ?? (row.headers ? "headers" : "none"),
    oauthClientId: row.oauthClientId ?? null,
    oauthClientSecret: decryptSecret(row.oauthClientSecret),
    oauthScope: row.oauthScope ?? null,
    userId: userId ?? row.userId,
  };
}
