import { z } from "zod";
import { isBlockedUrlSync } from "@/lib/mcp/url-guard";
import { jsonObjectSchema, idField } from "../shared-fields";

/**
 * Validates MCP server configuration.
 * HTTP servers require URL (validated against internal/blocked hosts).
 * Use with createMcpServer and updateMcpServer server actions to persist tool provider configurations.
 *
 * @see {@link lib/mcp/} for MCP server creation/update actions
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
