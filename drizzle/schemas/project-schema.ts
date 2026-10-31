import { sql } from "drizzle-orm";
import { index, pgTable, text } from "drizzle-orm/pg-core";
import {
  entityIdColumn,
  timestampColumns,
  userForeignKeyColumn,
} from "@/drizzle/schemas/schema-helpers";

/**
 * Stores user-created projects that act as scopes for grouping chats and sharing system prompts across conversations.
 * Many-to-one with user (CASCADE DELETE); globalPrompt is prepended to AI calls for chats in this project.
 * Auto-generated UUID primary key.
 *
 */
export const project = pgTable(
  "project",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    name: text("name").notNull(),
    description: text("description"),
    globalPrompt: text("global_prompt"),
    tools: text("tools").array(),
    skillMode: text("skill_mode", { enum: ["dynamic", "none", "specific"] })
      .notNull()
      .default("dynamic"),
    skillIds: text("skill_ids").array().notNull().default(sql`'{}'::text[]`),
    knowledgebaseId: text("knowledgebase_id"),
    ...timestampColumns(),
  },
  (table) => [index("project_user_id_idx").on(table.userId)],
);
