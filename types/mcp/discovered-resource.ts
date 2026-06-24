/**
 * Discovered resource from an MCP server.
 */
export type DiscoveredResource = {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
};
