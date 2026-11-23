import {
  type UploadWorkflowRunInputError,
  uploadWorkflowRunInput,
} from "@/actions/workflow-runs/upload-workflow-run-input";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { SkillMode } from "@/schemas/skill/skill-config";
import type { Result } from "@/types/result";
import {
  DEFAULT_WORKFLOW_APPROVAL_CONFIG,
  DEFAULT_WORKFLOW_CANVAS_CONFIG,
  type WorkflowApprovalConfig,
  type WorkflowCanvasConfig,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowNodeType,
  type WorkflowWithGraph,
} from "@/types/workflows/workflow";

/** Form setters used when hydrating a loaded workflow record. */
export interface WorkflowFormSetters {
  setName: (name: string) => void;
  setDescription: (desc: string) => void;
  setGlobalContext: (ctx: string) => void;
  setModelId: (id: string) => void;
  setTools: (tools: Set<string>) => void;
  setSkillMode: (mode: SkillMode) => void;
  setSkillIds: (ids: Set<string>) => void;
  setKnowledgeBaseIds: (ids: Set<string>) => void;
  setSubagentIds: (ids: string[]) => void;
  setRequiresFileUpload: (requires: boolean) => void;
  setCanvasConfig: (config: WorkflowCanvasConfig) => void;
  setApprovalConfig: (config: WorkflowApprovalConfig) => void;
  setWebhookSecret: (secret: string | null) => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
}

/** State snapshot serialized for create/update workflow actions. */
export interface WorkflowPayloadInput {
  name: string;
  description: string;
  globalContext: string;
  modelId: string;
  tools: Set<string>;
  skillMode: SkillMode;
  skillIds: Set<string>;
  knowledgeBaseIds: Set<string>;
  subagentIds: string[];
  requiresFileUpload: boolean;
  canvasConfig: WorkflowCanvasConfig;
  approvalConfig: WorkflowApprovalConfig;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

function buildUniqueVarName(prefix: string, nodes: WorkflowNode[]): string {
  const existing = new Set(nodes.map((n) => n.data.variableName));
  let idx = 1;
  while (existing.has(`${prefix}${idx}`)) {
    idx += 1;
  }
  return `${prefix}${idx}`;
}

/**
 * Instantiates a new workflow DAG node with safe default payload values.
 */
export function createDefaultWorkflowNode(
  type: WorkflowNodeType,
  position: { x: number; y: number },
  existingNodes: WorkflowNode[],
): WorkflowNode {
  const id = crypto.randomUUID();
  switch (type) {
    case "manual_trigger":
      return {
        id,
        type,
        name: "Manual Trigger",
        position,
        data: {
          kind: "manual_trigger",
          variableName: buildUniqueVarName("trigger", existingNodes),
          requiresFileUpload: false,
        },
      };
    case "webhook_trigger":
      return {
        id,
        type,
        name: "Webhook Trigger",
        position,
        data: {
          kind: "webhook_trigger",
          variableName: buildUniqueVarName("webhook", existingNodes),
          secretHeaderName: "x-webhook-secret",
        },
      };
    case "ai_step":
      return {
        id,
        type,
        name: `AI Step ${existingNodes.length + 1}`,
        position,
        data: {
          kind: "ai_step",
          variableName: buildUniqueVarName("step", existingNodes),
          prompt: "",
          mcpServerIds: [],
          toolIds: [],
          requiresReview: false,
        },
      };
    case "if_condition":
      return {
        id,
        type,
        name: "If Condition",
        position,
        data: {
          kind: "if_condition",
          variableName: buildUniqueVarName("condition", existingNodes),
          evaluationMode: "deterministic",
          logic: "and",
          rules: [],
        },
      };
    case "http_request":
      return {
        id,
        type,
        name: "HTTP Request",
        position,
        data: {
          kind: "http_request",
          variableName: buildUniqueVarName("http", existingNodes),
          method: "GET",
          url: "https://",
          headers: [],
          requiresReview: false,
        },
      };
  }
}

/**
 * Assigns non-overlapping left-to-right topological grid coordinates to DAG nodes.
 */
export function autoLayoutWorkflowNodes(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const depthMap = new Map<string, number>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    outgoing.set(node.id, []);
    depthMap.set(node.id, 0);
  }

  for (const edge of edges) {
    if (!inDegree.has(edge.sourceNodeId) || !inDegree.has(edge.targetNodeId)) {
      continue;
    }
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);
    outgoing.get(edge.sourceNodeId)?.push(edge.targetNodeId);
  }

  const queue = nodes
    .filter((n) => (inDegree.get(n.id) ?? 0) === 0)
    .map((n) => n.id);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currDepth = depthMap.get(curr) ?? 0;
    for (const next of outgoing.get(curr) ?? []) {
      depthMap.set(next, Math.max(depthMap.get(next) ?? 0, currDepth + 1));
      const remaining = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  const layerCounters = new Map<number, number>();
  return nodes.map((node) => {
    const layer = depthMap.get(node.id) ?? 0;
    const row = layerCounters.get(layer) ?? 0;
    layerCounters.set(layer, row + 1);
    return {
      ...node,
      position: { x: 80 + layer * 340, y: 100 + row * 180 },
    };
  });
}

/**
 * Populates workflow editor form states from a loaded graph record.
 */
export function hydrateWorkflowFormState(
  workflow: WorkflowWithGraph,
  setters: WorkflowFormSetters,
): void {
  const rawNodes = workflow.nodes ?? [];
  const hasTriggerFileUpload = rawNodes.some(
    (node) =>
      node.data.kind === "manual_trigger" &&
      Boolean(node.data.requiresFileUpload),
  );
  // Keep workflow-level flag and manual_trigger node flag in sync for legacy saved workflows
  const requiresFileUpload =
    Boolean(workflow.requiresFileUpload) || hasTriggerFileUpload;
  const nodes = requiresFileUpload
    ? rawNodes.map((node) =>
        node.data.kind === "manual_trigger" && !node.data.requiresFileUpload
          ? { ...node, data: { ...node.data, requiresFileUpload: true } }
          : node,
      )
    : rawNodes;

  setters.setName(workflow.name);
  setters.setDescription(workflow.description ?? "");
  setters.setGlobalContext(workflow.globalContext ?? "");
  setters.setModelId(workflow.modelId ?? "");
  setters.setTools(new Set(workflow.tools ?? []));
  setters.setSkillMode(workflow.skillMode ?? "dynamic");
  setters.setSkillIds(new Set(workflow.skillIds ?? []));
  setters.setKnowledgeBaseIds(new Set(workflow.knowledgeBaseIds ?? []));
  setters.setSubagentIds(workflow.subagentIds ?? []);
  setters.setRequiresFileUpload(requiresFileUpload);
  setters.setCanvasConfig(
    workflow.canvasConfig ?? DEFAULT_WORKFLOW_CANVAS_CONFIG,
  );
  setters.setApprovalConfig(
    workflow.approvalConfig ?? DEFAULT_WORKFLOW_APPROVAL_CONFIG,
  );
  setters.setWebhookSecret(workflow.webhookSecret ?? null);
  setters.setNodes(nodes);
  setters.setEdges(workflow.edges ?? []);
}

/**
 * Serializes current workflow editor state for `createWorkflow` / `updateWorkflow`.
 */
export function buildWorkflowPayload(state: WorkflowPayloadInput) {
  return {
    name: state.name,
    description: state.description.trim() || undefined,
    globalContext: state.globalContext.trim() || undefined,
    modelId: state.modelId.trim() || undefined,
    tools: Array.from(state.tools),
    skillMode: state.skillMode,
    skillIds: Array.from(state.skillIds),
    knowledgeBaseIds: Array.from(state.knowledgeBaseIds),
    subagentIds: state.subagentIds,
    requiresFileUpload: state.requiresFileUpload,
    canvasConfig: state.canvasConfig,
    approvalConfig: state.approvalConfig,
    nodes: state.nodes,
    edges: state.edges,
  };
}

/**
 * Uploads selected input files for a manual workflow run and returns attachment IDs.
 */
export async function uploadWorkflowRunFiles(
  files: File[],
): Promise<Result<string[], UploadWorkflowRunInputError>> {
  if (files.length === 0) return ok([]);
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const res = await uploadWorkflowRunInput(formData);
  if (!res.ok) {
    return fail(res.error);
  }
  return ok(res.value.map((item) => item.id));
}
