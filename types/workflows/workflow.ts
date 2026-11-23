import type { SkillMode } from "@/schemas/skill/skill-config";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { PendingApproval } from "@/types/tool/approval";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Supported visual DAG node types.
 */
export type WorkflowNodeType =
  | "manual_trigger"
  | "webhook_trigger"
  | "ai_step"
  | "if_condition"
  | "http_request";

/**
 * Supported Canvas artifact output formats for workflows.
 */
export type ArtifactCanvasType =
  | "markdown"
  | "spreadsheet"
  | "html"
  | "mermaid";

/**
 * Workflow-level Artifact Canvas configuration.
 */
export interface WorkflowCanvasConfig {
  enabled: boolean;
  allowedTypes: ArtifactCanvasType[];
  defaultType?: ArtifactCanvasType | "any";
  sharedCanvas?: boolean;
}

/**
 * Workflow-level review & tool approval configuration.
 */
export interface WorkflowApprovalConfig {
  defaultReviewGate: "none" | "before" | "after";
  toolApprovalMode: "auto" | "ask";
  autoApprovedTools: string[];
}

/**
 * Default Canvas configuration for new workflows.
 */
export const DEFAULT_WORKFLOW_CANVAS_CONFIG: WorkflowCanvasConfig = {
  enabled: true,
  allowedTypes: ["markdown", "spreadsheet", "html", "mermaid"],
  defaultType: "any",
  sharedCanvas: true,
};

/**
 * Default Approval configuration for new workflows.
 */
export const DEFAULT_WORKFLOW_APPROVAL_CONFIG: WorkflowApprovalConfig = {
  defaultReviewGate: "none",
  toolApprovalMode: "auto",
  autoApprovedTools: [],
};

/**
 * Node data for a Manual Trigger entry point.
 */
export interface ManualTriggerNodeData {
  kind: "manual_trigger";
  variableName: string;
  requiresFileUpload?: boolean;
}

/**
 * Node data for an HTTP Webhook Trigger entry point.
 */
export interface WebhookTriggerNodeData {
  kind: "webhook_trigger";
  variableName: string;
  secretHeaderName?: string;
  samplePayload?: string;
}

/**
 * Node data for an AI Step execution node.
 */
export interface AiStepNodeData {
  kind: "ai_step";
  variableName: string;
  prompt: string;
  modelId?: string;
  mcpServerIds: string[];
  toolIds: string[];
  knowledgeBaseIds?: string[];
  skillMode?: "inherit" | SkillMode;
  skillIds?: string[];
  subagentIds?: string[];
  requiresReview: boolean;
  reviewTiming?: "before" | "after";
  toolApprovalMode?: "inherit" | "auto" | "ask";
  canvasMode?: "inherit" | "disabled" | "any" | ArtifactCanvasType;
}

/**
 * Supported operators for deterministic `If` condition rules.
 */
export type IfConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "regex"
  | "gt"
  | "lt"
  | "is_empty"
  | "is_not_empty";

/**
 * Deterministic rule evaluated by an `if_condition` node.
 */
export interface IfConditionRule {
  id: string;
  leftTemplate: string;
  operator: IfConditionOperator;
  rightValue?: string;
}

/**
 * Node data for a conditional branching (`If`) node.
 */
export interface IfConditionNodeData {
  kind: "if_condition";
  variableName: string;
  evaluationMode: "deterministic" | "llm" | "hybrid";
  logic: "and" | "or";
  rules: IfConditionRule[];
  llmConditionPrompt?: string;
  modelId?: string;
}

/**
 * Node data for an outbound HTTP Request node.
 */
export interface HttpRequestNodeData {
  kind: "http_request";
  variableName: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers: Array<{ key: string; value: string }>;
  body?: string;
  timeoutMs?: number;
  requiresReview?: boolean;
}

/**
 * Discriminated union of all workflow node payloads.
 */
export type WorkflowNodeData =
  | ManualTriggerNodeData
  | WebhookTriggerNodeData
  | AiStepNodeData
  | IfConditionNodeData
  | HttpRequestNodeData;

/**
 * Canvas node position in React Flow coordinates.
 */
export interface WorkflowNodePosition {
  x: number;
  y: number;
}

/**
 * Persisted or client-side workflow node definition.
 */
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  position: WorkflowNodePosition;
  data: WorkflowNodeData;
}

/**
 * Persisted or client-side directed edge connecting two workflow nodes.
 */
export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: string;
  targetHandle: string;
}

/**
 * Execution lifecycle statuses for a workflow run.
 */
export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "awaiting_review"
  | "awaiting_tool_approval"
  | "completed"
  | "failed";

/**
 * Per-node runtime status and trace state persisted in `workflow_run.node_states`.
 */
export interface WorkflowNodeRunState {
  status:
    | "pending"
    | "running"
    | "completed"
    | "skipped"
    | "awaiting_review"
    | "awaiting_tool_approval"
    | "failed";
  reviewPhase?: "before" | "after";
  summary?: string;
  branchTaken?: "true" | "false";
  conditionReasoning?: string;
  httpResponse?: { status: number; statusText: string; data: unknown };
  artifact?: ArtifactData | null;
  toolCalls?: ToolCallState[];
  toolResults?: Array<{
    toolCallId: string;
    toolName: string;
    result: unknown;
    serverName?: string;
  }>;
  pendingToolApprovals?: PendingApproval[];
  outputAttachmentId?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Client-normalized workflow definition with graph node/trigger metadata.
 */
export interface WorkflowItem {
  id: string;
  userId: string;
  name: string;
  description: string;
  globalContext?: string;
  modelId?: string;
  tools: string[];
  skillMode: SkillMode;
  skillIds: string[];
  knowledgeBaseIds: string[];
  subagentIds: string[];
  requiresFileUpload: boolean;
  canvasConfig: WorkflowCanvasConfig;
  approvalConfig: WorkflowApprovalConfig;
  webhookSecret?: string | null;
  nodeCount?: number;
  hasManualTrigger?: boolean;
  hasWebhookTrigger?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Complete workflow record hydrated with its persisted DAG nodes and edges.
 */
export interface WorkflowWithGraph extends WorkflowItem {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

/**
 * Client-normalized workflow run record.
 */
export interface WorkflowRunItem {
  id: string;
  workflowId: string;
  userId: string;
  triggerType: "manual" | "webhook";
  status: WorkflowRunStatus;
  currentNodeId: string | null;
  dryRun: boolean;
  initialData: Record<string, unknown>;
  nodeStates: Record<string, WorkflowNodeRunState>;
  contextData: Record<string, unknown>;
  inputAttachmentIds: string[];
  outputAttachmentIds: string[];
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
