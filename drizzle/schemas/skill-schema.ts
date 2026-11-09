import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  entityIdColumn,
  timestampColumns,
  userForeignKeyColumn,
} from "@/drizzle/schemas/schema-helpers";

/**
 * Represents a reference file stored within a skill's bundled file tree.
 *
 * @author Maruf Bepary
 */
export interface SkillBundledFile {
  path: string;
  content: string;
}

/**
 * Stores user-defined Agent Skills adhering to the Open Agent Skills specification.
 * Each skill contains a unique slug (name), display title, trigger description,
 * markdown instruction body (SKILL.md), and optional supporting bundled text files.
 * projectIds and assistantIds arrays scope the skill to specific projects and/or assistants (empty arrays denote global).
 *
 * @author Maruf Bepary
 */
export const skill = pgTable(
  "skill",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    name: text("name").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description").notNull(),
    content: text("content").notNull(),
    files: jsonb("files").$type<SkillBundledFile[]>().default([]).notNull(),
    enabled: boolean("enabled").notNull().default(true),
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
  (table) => [
    index("skill_user_id_idx").on(table.userId),
    uniqueIndex("skill_user_id_name_idx").on(table.userId, table.name),
  ],
);
