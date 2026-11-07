import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  entityIdColumn,
  timestampColumns,
  userForeignKeyColumn,
} from "@/drizzle/schemas/schema-helpers";

/**
 * Stores Model Context Protocol (MCP) server configurations for HTTP transports.
 * Many-to-one with user (CASCADE DELETE).
 * enabled flag controls whether the server is available for tool selection in chat UI; used by MCP library for discovery.
 *
 */
export const mcpServer = pgTable(
  "mcp_server",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    authType: text("auth_type").notNull().default("none"),
    headers: text("headers"), // JSON object string for http headers
    oauthClientId: text("oauth_client_id"),
    oauthClientSecret: text("oauth_client_secret"),
    oauthScope: text("oauth_scope"),
    enabled: boolean("enabled").notNull().default(true),
    isPublic: boolean("is_public").notNull().default(false),
    ...timestampColumns(),
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
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    serverId: text("server_id")
      .notNull()
      .references(() => mcpServer.id, { onDelete: "cascade" }),
    headers: text("headers"), // Optional user-specific custom headers (JSON string)
    oauthClientId: text("oauth_client_id"),
    oauthClientSecret: text("oauth_client_secret"),
    enabled: boolean("enabled").notNull().default(true),
    ...timestampColumns(),
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

/**
 * Stores per-user OAuth credentials and token lifecycle state for MCP servers.
 * Many-to-one with user and mcpServer (CASCADE DELETE).
 * Encrypted tokens (AES-256-GCM) at rest.
 */
export const mcpOAuthCredential = pgTable(
  "mcp_oauth_credential",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    serverId: text("server_id")
      .notNull()
      .references(() => mcpServer.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenType: text("token_type"),
    scope: text("scope"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
    }),
    clientInformation: text("client_information"),
    authorizationServerInfo: text("authorization_server_info"),
    codeVerifier: text("code_verifier"),
    oauthState: text("oauth_state"),
    stateExpiresAt: timestamp("state_expires_at", { mode: "date" }),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("mcp_oauth_credential_user_server_idx").on(
      table.userId,
      table.serverId,
    ),
    index("mcp_oauth_credential_state_idx").on(table.oauthState),
  ],
);
