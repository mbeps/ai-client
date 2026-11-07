import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { assistant } from "@/drizzle/schemas/assistant-schema";
import { project } from "@/drizzle/schemas/project-schema";
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
 * Optional projectId or assistantId scopes the skill to a specific project or assistant workspace.
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
    projectId: text("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
    assistantId: text("assistant_id").references(() => assistant.id, {
      onDelete: "cascade",
    }),
    ...timestampColumns(),
  },
  (table) => [
    index("skill_user_id_idx").on(table.userId),
    uniqueIndex("skill_user_id_name_idx").on(table.userId, table.name),
    index("skill_project_id_idx").on(table.projectId),
    index("skill_assistant_id_idx").on(table.assistantId),
  ],
);
