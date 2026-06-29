/**
 * Discovered tool from an MCP server.
 * Tools are executable functions exposed by MCP servers that AI models can call.
 * Input schema defines the JSON schema for tool parameters and constraints.
 *
 * @author Maruf Bepary
 */
export type DiscoveredTool = {
  /** Name of the tool for identification and calling. */
  name: string;

  /** Description of what the tool does and when to use it. */
  description: string;

  /** JSON Schema object defining tool parameters and constraints. */
  inputSchema: Record<string, unknown>;
};
