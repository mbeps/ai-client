import type { AgentGuardrails } from "@/drizzle/schemas/agent-schema";
import type { SkillMode } from "@/schemas/skill/skill-config";

/**
 * Prompt shortcut visibility strategy configured for an Agent.
 */
export type PromptMode = "all" | "none" | "specific";

/**
 * Unified AI Agent domain entity.
 * Represents both custom user-created Agents and read-only Built-in System Agents.
 */
export interface Agent {
  id: string;
  userId: string;
  name: string;
  description: string;
  prompt: string;
  subagentPrompt: string;
  modelId: string | null;
  knowledgebaseIds: string[];
  tools: string[];
  skillMode: SkillMode;
  skillIds: string[];
  promptMode: PromptMode;
  promptIds: string[];
  subagentIds: string[];
  guardrails: AgentGuardrails;
  avatar: string | null;
  isBuiltIn?: boolean;
  isOrchestrator?: boolean;
  usedByCount?: number;
  createdAt: Date;
  updatedAt: Date;
}
