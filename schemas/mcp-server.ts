import { z } from "zod";
import { isBlockedUrl } from "@/lib/mcp/url-guard";
import { jsonArraySchema, jsonObjectSchema, idField } from "./shared-fields";

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
 * @see {@link lib/mcp/} for MCP server creation/update actions
 * @author Maruf Bepary
 */
const mcpServerBaseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stdio"),
    name: z.string().min(1, "Name is required").max(100),
    command: commandSchema,
    args: jsonArraySchema.optional(),
    env: jsonObjectSchema.optional(),
    isPublic: z.boolean(),
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
    isPublic: z.boolean(),
  }),
]);

/**
 * Validates new MCP server creation.
 * Validates complete server configuration before persistence.
 *
 * @see {@link lib/mcp/} for creation action
 * @author Maruf Bepary
 */
export const createMcpServerSchema = mcpServerBaseSchema;

/**
 * Validates MCP server updates.
 * Validates complete server configuration before persistence (does not support partial updates).
 *
 * @see {@link lib/mcp/} for update action
 * @author Maruf Bepary
 */
export const updateMcpServerSchema = mcpServerBaseSchema;

/**
 * Validates the full MCP server object as stored in the database.
 */
export const mcpServerSchema = z
  .object({
    id: idField,
    userId: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    isPublic: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .and(mcpServerBaseSchema);

export type CreateMcpServer = z.infer<typeof createMcpServerSchema>;
export type UpdateMcpServer = z.infer<typeof updateMcpServerSchema>;
