import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Stores user-created reusable prompts triggered via slash commands (/shortcut) in chat UI.
 * Many-to-one with user (CASCADE DELETE); title, shortcut, and content all required.
 * shortcut becomes the command trigger; content is prepended to AI calls when command invoked (hidden from user message display).
 * Enables rapid message templating and workflow shortcuts; auto-generated UUID primary key.
 *
 * @author Maruf Bepary
 */
export const prompt = pgTable(
  "prompt",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    shortcut: text("shortcut").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("prompt_user_id_idx").on(table.userId)],
);
