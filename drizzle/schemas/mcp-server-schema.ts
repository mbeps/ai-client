import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const mcpServer = pgTable("mcp_server", {
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
});
