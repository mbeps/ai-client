import { index, pgTable, text } from "drizzle-orm/pg-core";
import {
  entityIdColumn,
  timestampColumns,
  userForeignKeyColumn,
} from "@/drizzle/schemas/schema-helpers";

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
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    content: text("content").notNull(),
    ...timestampColumns(),
  },
  (table) => [index("user_memory_user_id_idx").on(table.userId)],
);
