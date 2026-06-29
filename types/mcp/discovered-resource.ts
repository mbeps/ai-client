/**
 * Discovered resource from an MCP server.
 * Resources are contextual data exposed by MCP servers (files, APIs, databases, etc.).
 * Enables servers to provide structured data access via the Model Context Protocol.
 *
 * @author Maruf Bepary
 */
export type DiscoveredResource = {
  /** URI identifier for the resource (unique within the server). */
  uri: string;

  /** Display name of the resource. */
  name: string;

  /** Human-readable description of what the resource provides. */
  description: string;

  /** Optional MIME type indicating resource content type. */
  mimeType?: string;
};
