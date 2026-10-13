import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import {
  entityIdColumn,
  timestampColumns,
  userForeignKeyColumn,
} from "@/drizzle/schemas/schema-helpers";

export const transformAgent = pgTable(
  "transform_agent",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    name: text("name").notNull(),
    description: text("description"),
    globalContext: text("global_context"),
    modelId: text("model_id"),
    tools: text("tools").array().notNull().default(sql`'{}'::text[]`),
    skillMode: text("skill_mode", { enum: ["dynamic", "none", "specific"] })
      .notNull()
      .default("dynamic"),
    skillIds: text("skill_ids").array().notNull().default(sql`'{}'::text[]`),
    knowledgeBaseIds: text("knowledge_base_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    requiresFileUpload: boolean("requires_file_upload").notNull().default(true),
    steps: text("steps").notNull().default("[]"),
    ...timestampColumns(),
  },
  (table) => [index("transform_agent_user_id_idx").on(table.userId)],
);

export const transformRun = pgTable(
  "transform_run",
  {
    id: entityIdColumn(),
    agentId: text("agent_id")
      .notNull()
      .references(() => transformAgent.id, { onDelete: "cascade" }),
    userId: userForeignKeyColumn(),
    status: text("status", {
      enum: ["pending", "running", "awaiting_review", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    currentStepIndex: integer("current_step_index"),
    dryRun: boolean("dry_run").notNull().default(false),
    inputAttachmentIds: text("input_attachment_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    outputAttachmentIds: text("output_attachment_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    errorMessage: text("error_message"),
    ...timestampColumns(),
  },
  (table) => [
    index("transform_run_agent_id_idx").on(table.agentId),
    index("transform_run_user_id_idx").on(table.userId),
  ],
);
