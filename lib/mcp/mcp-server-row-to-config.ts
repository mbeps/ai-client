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

/**
 * Converts McpServerRow to McpServerConfig for SDK use. Maps id, name, url, headers only.
 * Decrypts encrypted headers at rest while safely falling back to plaintext JSON.
 *
 * @param row - Database row from mcpServer table
 * @returns Configuration object for MCP SDK initialization
 * @author Maruf Bepary
 */
export function mcpServerRowToConfig(row: McpServerRow): McpServerConfig {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    headers: decryptHeaders(row.headers),
  };
}

