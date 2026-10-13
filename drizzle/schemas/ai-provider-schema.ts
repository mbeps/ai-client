import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  entityIdColumn,
  timestampColumns,
  userForeignKeyColumn,
} from "@/drizzle/schemas/schema-helpers";

/**
 * Stores user-configured OpenAI-compatible providers (OpenRouter, Ollama, Groq, etc.).
 * Many-to-one with user (CASCADE DELETE); credentials/headers are stored encrypted by the application layer.
 * A provider can be disabled without deletion via isEnabled.
 */
export const aiProvider = pgTable(
  "ai_provider",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    name: text("name").notNull(),
    baseUrl: text("base_url").notNull(),
    apiKey: text("api_key"),
    headers: text("headers"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    requiresKey: boolean("requires_key").notNull().default(true),
    ...timestampColumns(),
  },
  (table) => [
    index("ai_provider_user_id_idx").on(table.userId),
    uniqueIndex("ai_provider_user_id_name_idx").on(table.userId, table.name),
  ],
);
