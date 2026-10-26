import { index, pgTable, text } from "drizzle-orm/pg-core";
import {
  entityIdColumn,
  timestampColumns,
  userForeignKeyColumn,
} from "@/drizzle/schemas/schema-helpers";

/**
 * Workflow translation table for persisting translation runs.
 * Tracks source/target languages, input/output text, model, attachment metadata, and lifecycle status.
 *
 * @author Maruf Bepary
 */
export const workflowTranslation = pgTable(
  "workflow_translation",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    status: text("status", {
      enum: ["pending", "translating", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    sourceLanguage: text("source_language").notNull(),
    targetLanguage: text("target_language").notNull(),
    sourceText: text("source_text").notNull().default(""),
    translatedText: text("translated_text").notNull().default(""),
    modelId: text("model_id"),
    attachmentName: text("attachment_name"),
    attachmentType: text("attachment_type"),
    errorMessage: text("error_message"),
    ...timestampColumns(),
  },
  (table) => [index("workflow_translation_user_id_idx").on(table.userId)],
);

/**
 * Inferred select model for an automated workflow translation record.
 *
 * @author Maruf Bepary
 */
export type WorkflowTranslation = typeof workflowTranslation.$inferSelect;

/**
 * Inferred insert model for creating a new workflow translation record.
 *
 * @author Maruf Bepary
 */
export type NewWorkflowTranslation = typeof workflowTranslation.$inferInsert;
