import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import {
  entityIdColumn,
  timestampColumns,
  userForeignKeyColumn,
} from "@/drizzle/schemas/schema-helpers";
import { REASONING_EFFORTS } from "@/schemas/providers/provider-registry";
import type {
  WorkflowApprovalConfig,
  WorkflowCanvasConfig,
  WorkflowNodeData,
  WorkflowNodePosition,
  WorkflowNodeRunState,
  WorkflowNodeType,
} from "@/types/workflows/workflow";
import {
  DEFAULT_WORKFLOW_APPROVAL_CONFIG,
  DEFAULT_WORKFLOW_CANVAS_CONFIG,
} from "@/types/workflows/workflow";

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
 * Visual DAG workflow definitions owned by users.
 */
export const workflow = pgTable(
  "workflow",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    name: text("name").notNull(),
    description: text("description"),
    globalContext: text("global_context"),
    modelId: text("model_id"),
    reasoningEffort: text("reasoning_effort", { enum: REASONING_EFFORTS }),
    tools: text("tools").array().notNull().default(sql`'{}'::text[]`),
    skillMode: text("skill_mode", { enum: ["dynamic", "none", "specific"] })
      .notNull()
      .default("dynamic"),
    skillIds: text("skill_ids").array().notNull().default(sql`'{}'::text[]`),
    knowledgeBaseIds: text("knowledge_base_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    subagentIds: text("subagent_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    requiresFileUpload: boolean("requires_file_upload")
      .notNull()
      .default(false),
    canvasConfig: jsonb("canvas_config")
      .$type<WorkflowCanvasConfig>()
      .notNull()
      .default(DEFAULT_WORKFLOW_CANVAS_CONFIG),
    approvalConfig: jsonb("approval_config")
      .$type<WorkflowApprovalConfig>()
      .notNull()
      .default(DEFAULT_WORKFLOW_APPROVAL_CONFIG),
    webhookSecret: text("webhook_secret"),
    ...timestampColumns(),
  },
  (table) => [index("workflow_user_id_idx").on(table.userId)],
);

/**
 * Individual DAG nodes belonging to a workflow.
 */
export const workflowNode = pgTable(
  "workflow_node",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflow.id, { onDelete: "cascade" }),
    type: text("type").$type<WorkflowNodeType>().notNull(),
    name: text("name").notNull(),
    position: jsonb("position").$type<WorkflowNodePosition>().notNull(),
    data: jsonb("data").$type<WorkflowNodeData>().notNull(),
    ...timestampColumns(),
  },
  (table) => [index("workflow_node_workflow_id_idx").on(table.workflowId)],
);

/**
 * Directed edges connecting workflow nodes with explicit handle identifiers.
 */
export const workflowEdge = pgTable(
  "workflow_edge",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflow.id, { onDelete: "cascade" }),
    sourceNodeId: text("source_node_id")
      .notNull()
      .references(() => workflowNode.id, { onDelete: "cascade" }),
    targetNodeId: text("target_node_id")
      .notNull()
      .references(() => workflowNode.id, { onDelete: "cascade" }),
    sourceHandle: text("source_handle").notNull().default("main"),
    targetHandle: text("target_handle").notNull().default("main"),
  },
  (table) => [index("workflow_edge_workflow_id_idx").on(table.workflowId)],
);

/**
 * Durable execution runs for a workflow, tracking per-node states and interpolated context.
 */
export const workflowRun = pgTable(
  "workflow_run",
  {
    id: entityIdColumn(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflow.id, { onDelete: "cascade" }),
    userId: userForeignKeyColumn(),
    triggerType: text("trigger_type", { enum: ["manual", "webhook"] })
      .notNull()
      .default("manual"),
    status: text("status", {
      enum: [
        "pending",
        "running",
        "awaiting_review",
        "awaiting_tool_approval",
        "completed",
        "failed",
      ],
    })
      .notNull()
      .default("pending"),
    currentNodeId: text("current_node_id"),
    dryRun: boolean("dry_run").notNull().default(false),
    initialData: jsonb("initial_data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    nodeStates: jsonb("node_states")
      .$type<Record<string, WorkflowNodeRunState>>()
      .notNull()
      .default({}),
    contextData: jsonb("context_data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
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
    index("workflow_run_workflow_id_idx").on(table.workflowId),
    index("workflow_run_user_id_idx").on(table.userId),
  ],
);

export type WorkflowTranslation = typeof workflowTranslation.$inferSelect;
export type NewWorkflowTranslation = typeof workflowTranslation.$inferInsert;

export type WorkflowRow = typeof workflow.$inferSelect;
export type NewWorkflowRow = typeof workflow.$inferInsert;

export type WorkflowNodeRow = typeof workflowNode.$inferSelect;
export type NewWorkflowNodeRow = typeof workflowNode.$inferInsert;

export type WorkflowEdgeRow = typeof workflowEdge.$inferSelect;
export type NewWorkflowEdgeRow = typeof workflowEdge.$inferInsert;

export type WorkflowRunRow = typeof workflowRun.$inferSelect;
export type NewWorkflowRunRow = typeof workflowRun.$inferInsert;
