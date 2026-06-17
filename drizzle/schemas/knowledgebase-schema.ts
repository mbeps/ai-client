import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const knowledgebase = pgTable(
  "knowledgebase",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    indexStatus: text("index_status")
      .$type<"ready" | "stale" | "indexing">()
      .notNull()
      .default("ready"),
    lastIndexedAt: timestamp("last_indexed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("knowledgebase_user_id_idx").on(table.userId)],
);
