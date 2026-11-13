import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import type { Agent } from "@/types/agent/agent";

/**
 * Immutable identifiers for all built-in system agents.
 */
export const BUILT_IN_AGENT_IDS = [
  "builtin:researcher",
  "builtin:planner",
  "builtin:reviewer",
  "builtin:worker",
  "builtin:kb-reader",
] as const;

/**
 * Built-in agent identifiers that can be linked into an orchestrator's `subagentIds`.
 * Excludes `builtin:kb-reader`, which is invoked automatically by `search_knowledge_base`.
 */
export const LINKABLE_BUILT_IN_AGENT_IDS = [
  "builtin:researcher",
  "builtin:planner",
  "builtin:reviewer",
  "builtin:worker",
] as const;

const EPOCH_DATE = new Date("2026-01-01T00:00:00.000Z");

const GENERAL_BUILT_IN_GUARDRAILS = {
  ...DEFAULT_AGENT_GUARDRAILS,
  isolateTools: false,
} as const;

function createBuiltInAgent(
  config: Pick<
    Agent,
    "id" | "name" | "description" | "prompt" | "subagentPrompt" | "guardrails"
  >,
): Agent {
  return {
    ...config,
    userId: "system",
    modelId: null,
    knowledgebaseIds: [],
    tools: [],
    skillMode: "dynamic",
    skillIds: [],
    promptMode: "all",
    promptIds: [],
    subagentIds: [],
    avatar: null,
    isBuiltIn: true,
    isOrchestrator: false,
    createdAt: EPOCH_DATE,
    updatedAt: EPOCH_DATE,
  };
}

/**
 * Read-only built-in system agents available across the application.
 */
export const BUILT_IN_AGENTS: readonly Agent[] = [
  createBuiltInAgent({
    id: "builtin:researcher",
    name: "Researcher",
    description:
      "Deep codebase, web, and knowledge-base researcher that synthesizes verified findings and citations.",
    prompt:
      "You are a thorough Researcher. Gather facts using available tools, verify claims against primary sources, and synthesize concise, well-cited findings.",
    subagentPrompt:
      "Focus exclusively on gathering and verifying evidence for the delegated research brief. Write large extracts to the scratchpad and return a concise cited summary.",
    guardrails: GENERAL_BUILT_IN_GUARDRAILS,
  }),
  createBuiltInAgent({
    id: "builtin:planner",
    name: "Planner",
    description:
      "Systems architect that decomposes complex goals into concrete, ordered, verifiable execution plans.",
    prompt:
      "You are a disciplined Planner. Break complex requirements into clear, sequential, verifiable steps with explicit dependencies and edge cases.",
    subagentPrompt:
      "Produce an actionable, step-by-step plan for the delegated task brief without modifying state directly.",
    guardrails: GENERAL_BUILT_IN_GUARDRAILS,
  }),
  createBuiltInAgent({
    id: "builtin:reviewer",
    name: "Reviewer",
    description:
      "Critical quality and correctness reviewer that audits outputs, code, and plans for defects or gaps.",
    prompt:
      "You are a rigorous Reviewer. Inspect artifacts and outputs for correctness, edge cases, regressions, and adherence to requirements.",
    subagentPrompt:
      "Audit the provided inputs against the task brief, list concrete defects or risks with evidence, and report clear pass/fail findings.",
    guardrails: GENERAL_BUILT_IN_GUARDRAILS,
  }),
  createBuiltInAgent({
    id: "builtin:worker",
    name: "Worker",
    description:
      "General-purpose execution specialist for focused, self-contained tasks and tool-driven operations.",
    prompt:
      "You are a focused Worker. Execute the requested task accurately and efficiently using available tools.",
    subagentPrompt:
      "Complete the delegated task brief directly, record any bulky intermediate outputs in the scratchpad, and return a concise completion summary.",
    guardrails: GENERAL_BUILT_IN_GUARDRAILS,
  }),
  createBuiltInAgent({
    id: "builtin:kb-reader",
    name: "KB Reader",
    description:
      "Internal Knowledge Base reader automatically invoked by search_knowledge_base to synthesize grounded answers.",
    prompt:
      "You are an isolated Knowledge Base Research Subagent. Answer the inquiry accurately, concisely, and exclusively using facts from the attached knowledge base.",
    subagentPrompt:
      "Use explore_kb_graph, search_kb_chunks, and read_kb_document to answer exclusively from attached knowledge base facts.",
    guardrails: {
      maxSteps: 4,
      scratchpadAccess: "none",
      isolateTools: true,
    },
  }),
];

const BUILT_IN_AGENT_ID_SET = new Set<string>(BUILT_IN_AGENT_IDS);
const LINKABLE_BUILT_IN_AGENT_ID_SET = new Set<string>(
  LINKABLE_BUILT_IN_AGENT_IDS,
);

/**
 * Returns true if the given ID belongs to any built-in system agent.
 */
export function isBuiltInAgentId(id: string): boolean {
  return BUILT_IN_AGENT_ID_SET.has(id);
}

/**
 * Returns true if the given ID belongs to a built-in agent that can be linked into `subagentIds`.
 */
export function isLinkableBuiltInAgentId(id: string): boolean {
  return LINKABLE_BUILT_IN_AGENT_ID_SET.has(id);
}

/**
 * Looks up a built-in system agent by its exact `builtin:*` identifier.
 */
export function getBuiltInAgentById(id: string): Agent | undefined {
  return BUILT_IN_AGENTS.find((agent) => agent.id === id);
}

/**
 * Resolves a built-in agent by either its full `builtin:<role>` ID or role slug (case-insensitive).
 */
export function resolveBuiltInAgentByRoleOrId(
  identifier: string,
): Agent | undefined {
  const normalized = identifier.trim().toLowerCase();
  const targetId = normalized.startsWith("builtin:")
    ? normalized
    : `builtin:${normalized}`;
  return getBuiltInAgentById(targetId);
}
