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
 * Stores user-configured OpenAI-compatible providers (OpenRouter, Ollama, Groq, etc.).
 * Many-to-one with user (CASCADE DELETE); credentials/headers are stored encrypted by the application layer.
 * A provider can be disabled without deletion via isEnabled.
 */
export const aiProvider = pgTable(
  "ai_provider",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    baseUrl: text("base_url").notNull(),
    apiKey: text("api_key"),
    headers: text("headers"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    requiresKey: boolean("requires_key").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ai_provider_user_id_idx").on(table.userId),
    uniqueIndex("ai_provider_user_id_name_idx").on(table.userId, table.name),
  ],
);
