import { sql } from "drizzle-orm";
import { index, pgTable, text } from "drizzle-orm/pg-core";
import {
  entityIdColumn,
  timestampColumns,
  userForeignKeyColumn,
} from "@/drizzle/schemas/schema-helpers";

/**
 * Stores user-created AI assistant personas with system prompts and avatar images.
 * Many-to-one with user (CASCADE DELETE); prompt is prepended to AI calls for chats bound to this assistant.
 * Enables creation of reusable chat personality presets; auto-generated UUID primary key.
 *
 */
export const assistant = pgTable(
  "assistant",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    name: text("name").notNull(),
    description: text("description"),
    prompt: text("prompt"),
    tools: text("tools").array(),
    skillMode: text("skill_mode", { enum: ["dynamic", "none", "specific"] })
      .notNull()
      .default("dynamic"),
    skillIds: text("skill_ids").array().notNull().default(sql`'{}'::text[]`),
    avatar: text("avatar"),
    ...timestampColumns(),
  },
  (table) => [index("assistant_user_id_idx").on(table.userId)],
);
