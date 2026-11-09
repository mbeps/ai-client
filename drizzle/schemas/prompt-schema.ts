import { sql } from "drizzle-orm";
import { index, pgTable, text } from "drizzle-orm/pg-core";
import {
  entityIdColumn,
  timestampColumns,
  userForeignKeyColumn,
} from "@/drizzle/schemas/schema-helpers";

/**
 * Stores user-created reusable prompts triggered via slash commands (/shortcut) in chat UI.
 * Many-to-one with user (CASCADE DELETE); title, shortcut, and content all required.
 * shortcut becomes the command trigger; content is prepended to AI calls when command invoked (hidden from user message display).
 * projectIds and assistantIds arrays scope the prompt to specific projects and/or assistants (empty arrays denote global).
 * Enables rapid message templating and workflow shortcuts; auto-generated UUID primary key.
 *
 * @author Maruf Bepary
 */
export const prompt = pgTable(
  "prompt",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    title: text("title").notNull(),
    shortcut: text("shortcut").notNull(),
    content: text("content").notNull(),
    projectIds: text("project_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    assistantIds: text("assistant_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    ...timestampColumns(),
  },
  (table) => [index("prompt_user_id_idx").on(table.userId)],
);
