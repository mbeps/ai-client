import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import {
  entityIdColumn,
  timestampColumns,
  userForeignKeyColumn,
} from "@/drizzle/schemas/schema-helpers";

/**
 * Controls how a delegated Layer-2 subagent can interact with the shared scratchpad.
 */
export type ScratchpadAccessMode = "read_write" | "read_only" | "none";

/**
 * Execution guardrails governing a Layer-2 delegated subagent run.
 */
export interface AgentGuardrails {
  maxSteps: number;
  scratchpadAccess: ScratchpadAccessMode;
  isolateTools: boolean;
}

/**
 * Default execution guardrails applied to newly created user agents.
 */
export const DEFAULT_AGENT_GUARDRAILS: AgentGuardrails = {
  maxSteps: 10,
  scratchpadAccess: "read_write",
  isolateTools: true,
};

/**
 * Stores unified AI Agent personas (replacing legacy assistants and standalone subagents).
 * Any Agent can operate in Direct Chat Mode (Layer 1) or—when `subagentIds` is empty—
 * be linked as a Delegated Leaf Subagent (Layer 2) under an Orchestrator Agent, Project, or Workflow.
 */
export const agent = pgTable(
  "agent",
  {
    id: entityIdColumn(),
    userId: userForeignKeyColumn(),
    name: text("name").notNull(),
    description: text("description"),
    prompt: text("prompt"),
    subagentPrompt: text("subagent_prompt"),
    modelId: text("model_id"),
    knowledgebaseIds: text("knowledgebase_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    tools: text("tools").array(),
    skillMode: text("skill_mode", { enum: ["dynamic", "none", "specific"] })
      .notNull()
      .default("dynamic"),
    skillIds: text("skill_ids").array().notNull().default(sql`'{}'::text[]`),
    promptMode: text("prompt_mode", { enum: ["all", "none", "specific"] })
      .notNull()
      .default("all"),
    promptIds: text("prompt_ids").array().notNull().default(sql`'{}'::text[]`),
    subagentIds: text("subagent_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    guardrails: jsonb("guardrails")
      .$type<AgentGuardrails>()
      .notNull()
      .default(DEFAULT_AGENT_GUARDRAILS),
    avatar: text("avatar"),
    ...timestampColumns(),
  },
  (table) => [index("agent_user_id_idx").on(table.userId)],
);
