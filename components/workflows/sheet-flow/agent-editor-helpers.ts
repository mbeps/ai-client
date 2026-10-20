import type { getTransformAgent } from "@/actions/transform-agents/get-transform-agent";
import { uploadRunInput } from "@/actions/transform-runs/upload-run-input";
import type { SkillMode } from "@/schemas/skill/skill-config";
import type { TransformStep } from "@/types/transform/transform-step";

export type TransformAgentData = NonNullable<
  Awaited<ReturnType<typeof getTransformAgent>>
>;

interface RawStepLike {
  id?: string;
  name?: string;
  prompt?: string;
  mcpServerIds?: string[];
  toolIds?: string[];
  order?: number;
  requiresReview?: boolean;
}

export interface AgentFormSetters {
  setName: (name: string) => void;
  setDescription: (desc: string) => void;
  setGlobalContext: (ctx: string) => void;
  setModelId: (id: string) => void;
  setTools: (tools: Set<string>) => void;
  setSkillMode: (mode: SkillMode) => void;
  setSkillIds: (ids: Set<string>) => void;
  setKnowledgeBaseIds: (ids: Set<string>) => void;
  setRequiresFileUpload: (requires: boolean) => void;
  setSteps: (steps: TransformStep[]) => void;
}

export interface AgentPayloadInput {
  name: string;
  description: string;
  globalContext: string;
  modelId: string;
  tools: Set<string>;
  skillMode: SkillMode;
  skillIds: Set<string>;
  knowledgeBaseIds: Set<string>;
  requiresFileUpload: boolean;
  steps: TransformStep[];
}

function parseRawSteps(rawSteps: unknown): unknown {
  if (typeof rawSteps === "string") {
    try {
      return JSON.parse(rawSteps);
    } catch {
      return [];
    }
  }
  return rawSteps;
}

/**
 * Normalizes raw step objects or JSON string into typed TransformStep array.
 */
export function normalizeAgentSteps(rawSteps: unknown): TransformStep[] {
  const parsed = parseRawSteps(rawSteps);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((step: RawStepLike, i: number) => ({
    id: step.id || crypto.randomUUID(),
    name: step.name || `Step ${i + 1}`,
    prompt: step.prompt || "",
    mcpServerIds: step.mcpServerIds ?? [],
    toolIds: step.toolIds ?? [],
    order: step.order ?? i,
    requiresReview: Boolean(step.requiresReview),
  }));
}

/**
 * Hydrates agent form states from loaded entity record.
 */
export function hydrateAgentFormState(
  agent: TransformAgentData,
  setters: AgentFormSetters,
): void {
  setters.setName(agent.name);
  setters.setDescription(agent.description ?? "");
  setters.setGlobalContext(agent.globalContext ?? "");
  setters.setModelId(agent.modelId ?? "");
  setters.setTools(new Set(agent.tools ?? []));
  setters.setSkillMode((agent.skillMode as SkillMode) ?? "dynamic");
  setters.setSkillIds(new Set(agent.skillIds ?? []));
  setters.setKnowledgeBaseIds(new Set(agent.knowledgeBaseIds ?? []));
  setters.setRequiresFileUpload(agent.requiresFileUpload);
  setters.setSteps(normalizeAgentSteps(agent.steps));
}

/**
 * Creates a new blank transform step.
 */
export function createNewStep(order: number): TransformStep {
  return {
    id: crypto.randomUUID(),
    name: `Step ${order + 1}`,
    prompt: "",
    mcpServerIds: [],
    toolIds: [],
    order,
    requiresReview: false,
  };
}

/**
 * Builds the payload for create/update transform agent server actions.
 */
export function buildAgentPayload(state: AgentPayloadInput) {
  return {
    name: state.name,
    description: state.description.trim() || undefined,
    globalContext: state.globalContext.trim() || undefined,
    modelId: state.modelId.trim() || undefined,
    tools: Array.from(state.tools),
    skillMode: state.skillMode,
    skillIds: Array.from(state.skillIds),
    knowledgeBaseIds: Array.from(state.knowledgeBaseIds),
    requiresFileUpload: state.requiresFileUpload,
    steps: state.steps.map((s, i) => ({
      id: s.id,
      name: s.name,
      prompt: s.prompt,
      mcpServerIds: s.mcpServerIds,
      toolIds: s.toolIds,
      order: i,
      requiresReview: s.requiresReview,
    })),
  };
}

/**
 * Uploads selected input files for a transform run and returns their attachment IDs.
 */
export async function uploadRunInputFiles(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const uploaded = await uploadRunInput(formData);
  return uploaded.map((u) => u.id);
}

