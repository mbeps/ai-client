import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Stores user-created AI assistant personas with system prompts and avatar images.
 * Many-to-one with user (CASCADE DELETE); prompt is prepended to AI calls for chats bound to this assistant.
 * Enables creation of reusable chat personality presets; auto-generated UUID primary key.
 *
 * @author Maruf Bepary
 */
export const assistant = pgTable(
  "assistant",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    prompt: text("prompt"),
    avatar: text("avatar"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("assistant_user_id_idx").on(table.userId)],
);
