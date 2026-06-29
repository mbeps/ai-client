/**
 * Discovered prompt from an MCP server.
 * Prompts are reusable templates exposed by MCP servers for specialized task contexts.
 * Arguments array describes parameters that can be passed when using the prompt.
 * serverId and serverName track which server provides this prompt.
 *
 * @author Maruf Bepary
 */
export interface DiscoveredPrompt {
  /** Display name of the prompt. */
  name: string;

  /** Description of what the prompt does. */
  description?: string;

  /** Optional arguments/parameters for the prompt. */
  arguments?: {
    name: string;
    description?: string;
    required?: boolean;
  }[];

  /** ID of the MCP server that provides this prompt. */
  serverId: string;

  /** Display name of the MCP server. */
  serverName: string;
}
