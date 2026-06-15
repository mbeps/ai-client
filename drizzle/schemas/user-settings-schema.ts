import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { aiModel } from "./ai-model-schema";

/**
 * Stores application-wide user preferences and settings.
 * One-to-one with user (CASCADE DELETE); globalSystemPrompt prepends all AI interactions.
 * Enables users to define a baseline system instruction that applies across all projects and assistants.
 *
 * @author Maruf Bepary
 */
export const userSettings = pgTable(
  "user_settings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    globalSystemPrompt: text("global_system_prompt"),
    defaultChatModelId: text("default_chat_model_id").references(
      () => aiModel.id,
      { onDelete: "set null" },
    ),
    defaultEmbeddingModelId: text("default_embedding_model_id").references(
      () => aiModel.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("user_settings_user_id_idx").on(table.userId)],
);
