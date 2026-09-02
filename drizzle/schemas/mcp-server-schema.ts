import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Stores Model Context Protocol (MCP) server configurations for HTTP transports.
 * Many-to-one with user (CASCADE DELETE).
 * enabled flag controls whether the server is available for tool selection in chat UI; used by MCP library for discovery.
 *
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
    url: text("url").notNull(),
    headers: text("headers"), // JSON object string for http headers
    enabled: boolean("enabled").notNull().default(true),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("mcp_server_user_id_idx").on(table.userId)],
);

/**
 * Stores user installations/subscriptions to public MCP servers.
 * Many-to-one with user and mcp_server (CASCADE DELETE).
 * headers allows subscribers to configure their own private authentication headers/tokens for a public tool.
 * enabled controls whether this installed public tool appears in the subscriber's chat tool picker.
 */
export const userMcpServerInstall = pgTable(
  "user_mcp_server_install",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    serverId: text("server_id")
      .notNull()
      .references(() => mcpServer.id, { onDelete: "cascade" }),
    headers: text("headers"), // Optional user-specific custom headers (JSON string)
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_mcp_server_install_user_id_idx").on(table.userId),
    index("user_mcp_server_install_server_id_idx").on(table.serverId),
    uniqueIndex("user_mcp_server_install_user_server_idx").on(
      table.userId,
      table.serverId,
    ),
  ],
);
