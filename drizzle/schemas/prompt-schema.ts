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
 * Enables rapid message templating and workflow shortcuts; auto-generated UUID primary key.
 *
 */
export const prompt = pgTable(
  "prompt",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    title: text("title").notNull(),
    shortcut: text("shortcut").notNull(),
    content: text("content").notNull(),
    ...timestampColumns(),
  },
  (table) => [index("prompt_user_id_idx").on(table.userId)],
);
