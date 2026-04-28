import { z } from "zod";
import { isBlockedUrl } from "@/lib/mcp/url-guard";

/**
 * Validates JSON string as a valid JSON array (e.g., for MCP command arguments).
 * Rejects non-arrays, non-JSON, and strings — strict JSON array format required.
 *
 * @author Maruf Bepary
 */
const jsonArraySchema = z.string().refine(
  (val) => {
    try {
      return Array.isArray(JSON.parse(val));
    } catch {
      return false;
    }
  },
  { message: "Must be a valid JSON array" },
);

/**
 * Validates JSON string as a valid JSON object (e.g., for environment variables or headers).
 * Rejects arrays, non-JSON, and non-objects — strict JSON object format required.
 *
 * @author Maruf Bepary
 */
const jsonObjectSchema = z.string().refine(
  (val) => {
    try {
      const p = JSON.parse(val);
      return p !== null && typeof p === "object" && !Array.isArray(p);
    } catch {
      return false;
    }
  },
  { message: "Must be a valid JSON object" },
);

/**
 * Validates MCP stdio command paths blocking absolute paths and traversal attacks.
 * Enforces relative paths only: rejects leading /, \\ separators, and .. segments.
 * Protects against SSRF and command injection when executing child processes.
 *
 * @author Maruf Bepary
 */
const commandSchema = z
  .string()
  .min(1, "Command is required")
  .max(255)
  .refine(
    (val) => {
      if (val.startsWith("/")) return false; // no absolute paths
      const segments = val.split(/[/\\]/);
      return !segments.some((s) => s === ".."); // no path traversal
    },
    {
      message:
        "Command must be a relative path with no path traversal (no absolute paths or ..)",
    },
  );

/**
 * Validates MCP server configuration discriminated by transport type (stdio or http).
 * Stdio servers require command (validated against path traversal); http servers require URL (validated against internal/blocked hosts).
 * Use with createMcpServer and updateMcpServer server actions to persist tool provider configurations.
 *
 * @see {@link lib/actions/mcp-servers/} for MCP server creation/update actions
 * @author Maruf Bepary
 */
export const mcpServerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stdio"),
    name: z.string().min(1, "Name is required").max(100),
    command: commandSchema,
    args: jsonArraySchema.optional(),
    env: jsonObjectSchema.optional(),
  }),
  z.object({
    type: z.literal("http"),
    name: z.string().min(1, "Name is required").max(100),
    url: z
      .string()
      .url("Invalid URL")
      .max(1024)
      .refine((val) => !isBlockedUrl(val), {
        message: "URL points to a blocked or internal address",
      }),
    headers: jsonObjectSchema.optional(),
  }),
]);

/**
 * Alias for mcpServerSchema used during new MCP server creation.
 * Validates complete server configuration before persistence.
 *
 * @see {@link lib/actions/mcp-servers/} for creation action
 * @author Maruf Bepary
 */
export const createMcpServerSchema = mcpServerSchema;

/**
 * Alias for mcpServerSchema used during MCP server updates.
 * Validates complete server configuration before persistence (does not support partial updates).
 *
 * @see {@link lib/actions/mcp-servers/} for update action
 * @author Maruf Bepary
 */
export const updateMcpServerSchema = mcpServerSchema;

export type CreateMcpServer = z.infer<typeof mcpServerSchema>;
export type UpdateMcpServer = z.infer<typeof mcpServerSchema>;
