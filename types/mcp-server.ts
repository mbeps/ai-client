import { z } from "zod";
import { mcpServerSchema } from "@/schemas/mcp-server";

/**
 * Represents a Model Context Protocol (MCP) server providing tools to the AI pipeline.
 * MCP servers enable the AI to call external functions: local executables (stdio)
 * or remote HTTP APIs. Tools from enabled servers are discoverable and selectable
 * per-message via the tool picker dialog.
 *
 * @author Maruf Bepary
 */
export type McpServer = z.infer<typeof mcpServerSchema>;
