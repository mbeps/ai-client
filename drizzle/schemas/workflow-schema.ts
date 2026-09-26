import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/drizzle/schemas/auth-schema";

/**
 * Workflow translation table for persisting translation runs.
 * Tracks source/target languages, input/output text, model, attachment metadata, and lifecycle status.
 *
 * @author Maruf Bepary
 */
export const workflowTranslation = pgTable(
  "workflow_translation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("workflow_translation_user_id_idx").on(table.userId)],
);

export type WorkflowTranslation = typeof workflowTranslation.$inferSelect;
export type NewWorkflowTranslation = typeof workflowTranslation.$inferInsert;
