import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export interface SkillBundledFile {
  path: string;
  content: string;
}

/**
 * Stores user-defined Agent Skills adhering to the Open Agent Skills specification.
 * Each skill contains a unique slug (name), display title, trigger description,
 * markdown instruction body (SKILL.md), and optional supporting bundled text files.
 *
 * @author Maruf Bepary
 */
export const skill = pgTable(
  "skill",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description").notNull(),
    content: text("content").notNull(),
    files: jsonb("files").$type<SkillBundledFile[]>().default([]).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("skill_user_id_idx").on(table.userId),
    uniqueIndex("skill_user_id_name_idx").on(table.userId, table.name),
  ],
);
