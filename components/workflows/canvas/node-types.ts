import type { NodeTypes } from "@xyflow/react";
import { AiStepNode } from "@/components/workflows/canvas/nodes/ai-step-node";
import { HttpRequestNode } from "@/components/workflows/canvas/nodes/http-request-node";
import { IfConditionNode } from "@/components/workflows/canvas/nodes/if-condition-node";
import { ManualTriggerNode } from "@/components/workflows/canvas/nodes/manual-trigger-node";
import { WebhookTriggerNode } from "@/components/workflows/canvas/nodes/webhook-trigger-node";

/**
 * Module-scope React Flow `nodeTypes` registry.
 * Must live outside components to avoid unmounting/remounting canvas nodes on re-render.
 */
export const WORKFLOW_NODE_TYPES: NodeTypes = {
  manual_trigger: ManualTriggerNode as NodeTypes[string],
  webhook_trigger: WebhookTriggerNode as NodeTypes[string],
  ai_step: AiStepNode as NodeTypes[string],
  if_condition: IfConditionNode as NodeTypes[string],
  http_request: HttpRequestNode as NodeTypes[string],
};
