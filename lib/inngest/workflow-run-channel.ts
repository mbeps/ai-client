import { channel, staticSchema } from "inngest/realtime";
import type { PendingApproval } from "@/types/tool/approval";
import type { WorkflowNodeRunState } from "@/types/workflows/workflow";

/**
 * Union of all realtime progress events published on `workflowRunChannel`.
 */
export type WorkflowStreamEvent =
  | { type: "workflow-start"; runId: string }
  | {
      type: "workflow-node-start";
      runId: string;
      nodeId: string;
      nodeName: string;
      nodeType: string;
    }
  | {
      type: "workflow-node-skipped";
      runId: string;
      nodeId: string;
    }
  | {
      type: "tool-call";
      nodeId?: string;
      toolCallId: string;
      toolName: string;
      args: unknown;
      serverName?: string;
    }
  | {
      type: "tool-result";
      nodeId?: string;
      toolCallId: string;
      toolName: string;
      result: unknown;
      serverName?: string;
    }
  | {
      type: "workflow-review-required";
      runId: string;
      nodeId: string;
      reviewPhase: "before" | "after";
    }
  | {
      type: "workflow-tool-approval-required";
      runId: string;
      nodeId: string;
      approvals: PendingApproval[];
    }
  | {
      type: "workflow-node-complete";
      runId: string;
      nodeId: string;
      state: WorkflowNodeRunState;
      outputAttachmentIds?: string[];
    }
  | {
      type: "workflow-complete";
      runId: string;
      outputAttachmentIds: string[];
    }
  | {
      type: "error";
      nodeId?: string;
      message: string;
      code?: string;
    };

/**
 * Realtime channel for streaming visual DAG workflow execution progress per `runId`.
 */
export const workflowRunChannel = channel({
  name: ({ runId }: { runId: string }) => `workflow:${runId}`,
  topics: {
    progress: { schema: staticSchema<WorkflowStreamEvent>() },
  },
});
