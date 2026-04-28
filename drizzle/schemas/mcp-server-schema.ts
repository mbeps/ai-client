import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Stores Model Context Protocol (MCP) server configurations for stdio and HTTP transports.
 * Many-to-one with user (CASCADE DELETE); type enum: 'stdio' or 'http'.
 * stdio servers: command + args (JSON array) + env (JSON object); HTTP servers: url + headers (JSON object).
 * enabled flag controls whether the server is available for tool selection in chat UI; used by MCP library for discovery.
 *
 * @author Maruf Bepary
 */
export const mcpServer = pgTable(
  "mcp_server",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").$type<"stdio" | "http">().notNull(),
    command: text("command"), // for stdio
    args: text("args"), // JSON array string for stdio
    url: text("url"), // for http
    headers: text("headers"), // JSON object string for http headers
    env: text("env"), // JSON object string for env vars (stdio)
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("mcp_server_user_id_idx").on(table.userId)],
);
