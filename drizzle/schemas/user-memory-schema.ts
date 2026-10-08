import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/drizzle/schemas/auth-schema";

/**
 * Stores atomic text memories, facts, and preferences associated with a user.
 * Many-to-one with user (CASCADE DELETE).
 * Used for ambient background retrieval into system prompts and explicit tool persistence.
 *
 * @author Maruf Bepary
 */
export const userMemory = pgTable(
  "user_memory",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("user_memory_user_id_idx").on(table.userId)],
);
