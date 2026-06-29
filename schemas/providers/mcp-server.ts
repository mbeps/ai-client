import { z } from "zod";
import { isBlockedUrlSync } from "@/lib/mcp/url-guard-core";
import { jsonObjectSchema, idField } from "../shared-fields";

/**
 * Validates MCP (Model Context Protocol) server configuration.
 * HTTP servers require URL (validated against internal/blocked hosts for security).
 * Headers optional for custom authentication (Bearer tokens, API keys, etc.).
 * isPublic flag controls whether server is shared with other users.
 * URL validated to reject localhost, 127.0.0.1, and internal addresses (10.0.0.0/8, etc.).
 * Use with createMcpServer and updateMcpServer server actions to persist tool provider configurations.
 *
 * @see {@link lib/mcp/}} for MCP server creation/update actions
 * @author Maruf Bepary
 */
const mcpServerBaseSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  url: z
    .string()
    .url("Invalid URL")
    .max(1024)
    .refine((val) => !isBlockedUrlSync(val), {
      message: "URL points to a blocked or internal address",
    }),
  headers: jsonObjectSchema.optional(),
  isPublic: z.boolean(),
});

/**
 * Validates new MCP server creation.
 * Validates complete server configuration before persistence.
 * URL must be publicly accessible and not an internal address.
 *
 * @see {@link lib/mcp/}} for creation action
 * @author Maruf Bepary
 */
export const createMcpServerSchema = mcpServerBaseSchema;

/**
 * Validates MCP server updates.
 * Validates complete server configuration before persistence (does not support partial updates).
 * All fields are treated as required; full configuration must be provided.
 *
 * @see {@link lib/mcp/}} for update action
 * @author Maruf Bepary
 */
export const updateMcpServerSchema = mcpServerBaseSchema;

/**
 * Validates the full MCP server object as stored in the database and loaded in the store.
 * Includes all fields from creation plus system metadata (id, userId, enabled, timestamps).
 * enabled flag controls availability in tool selection UI (can disable without deleting).
 * Use for type-safe store hydration and API serialization.
 *
 * @author Maruf Bepary
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
