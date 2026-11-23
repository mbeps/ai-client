import { describe, expect, it } from "vitest";
import {
  applyNodeCompleteToNode,
  applyNodeSkippedEvent,
  applyNodeStartEvent,
  applyReviewRequiredToNode,
  applyToolApprovalRequiredToNode,
  applyToolCallToNode,
  applyToolResultToNode,
  calculateWorkflowProgress,
  mapRunRowToWorkflowRun,
  resolveNodePreviewArtifact,
} from "@/components/workflows/run/state-helpers";
import type { WorkflowNode, WorkflowNodeRunState } from "@/types/workflows/workflow";

describe("Workflow Run State Helpers", () => {
  const sampleNodes: WorkflowNode[] = [
    {
      id: "n1",
      type: "manual_trigger",
      name: "Start",
      position: { x: 0, y: 0 },
      data: { kind: "manual_trigger", variableName: "trigger" },
    },
    {
      id: "n2",
      type: "ai_step",
      name: "Summarize",
      position: { x: 300, y: 0 },
      data: {
        kind: "ai_step",
        variableName: "step1",
        prompt: "Go",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: false,
      },
    },
  ];

  it("maps WorkflowRunRow to WorkflowRunItem", () => {
    const mapped = mapRunRowToWorkflowRun({
      id: "run-1",
      workflowId: "wf-1",
      userId: "user-1",
      triggerType: "manual",
      status: "running",
      currentNodeId: "n2",
      dryRun: true,
      initialData: { customer: "Acme" },
      nodeStates: {},
      contextData: {},
      inputAttachmentIds: ["att-1"],
      outputAttachmentIds: [],
      errorMessage: null,
      createdAt: "2026-11-23T10:00:00.000Z" as unknown as Date,
      updatedAt: "2026-11-23T10:01:00.000Z" as unknown as Date,
    });

    expect(mapped.id).toBe("run-1");
    expect(mapped.dryRun).toBe(true);
    expect(mapped.createdAt).toBeInstanceOf(Date);
  });

  it("applies node lifecycle stream events deterministically", () => {
    let states: Record<string, WorkflowNodeRunState> = {};

    states = applyNodeStartEvent(states, "n2");
    expect(states.n2.status).toBe("running");

    states = applyToolCallToNode(states, "n2", {
      toolCallId: "tc-1",
      toolName: "search_web",
      args: { q: "acme" },
      serverName: "internal",
    });
    expect(states.n2.toolCalls).toHaveLength(1);

    states = applyToolResultToNode(states, "n2", {
      toolCallId: "tc-1",
      toolName: "search_web",
      result: { ok: true },
      serverName: "internal",
    });
    expect(states.n2.toolResults).toHaveLength(1);

    states = applyReviewRequiredToNode(states, "n2", "after");
    expect(states.n2.status).toBe("awaiting_review");
    expect(states.n2.reviewPhase).toBe("after");

    states = applyToolApprovalRequiredToNode(states, "n2", [
      {
        approvalId: "ap-1",
        toolCallId: "tc-2",
        toolName: "delete_row",
        serverId: "srv-1",
        serverName: "sheets",
        args: { row: 5 },
        signature: "delete_row:{}",
      },
    ]);
    expect(states.n2.status).toBe("awaiting_tool_approval");
    expect(states.n2.pendingToolApprovals).toHaveLength(1);

    states = applyNodeCompleteToNode(states, "n2", {
      status: "completed",
      summary: "Done",
      artifact: {
        id: "art-1",
        type: "markdown",
        title: "Report",
        content: "# Done",
      },
    });
    expect(states.n2.status).toBe("completed");
    expect(states.n2.summary).toBe("Done");

    states = applyNodeSkippedEvent(states, "n3");
    expect(states.n3.status).toBe("skipped");
  });

  it("calculates progress percentage and resolves preview artifact", () => {
    expect(calculateWorkflowProgress("completed", {}, 2)).toBe(100);
    expect(
      calculateWorkflowProgress(
        "running",
        {
          n1: { status: "completed" },
          n2: { status: "skipped" },
        },
        4,
      ),
    ).toBe(50);

    const artifact = resolveNodePreviewArtifact("n2", sampleNodes, {
      n2: {
        status: "completed",
        artifact: {
          id: "art-1",
          type: "markdown",
          title: "Out",
          content: "Body",
        },
      },
    });
    expect(artifact?.title).toBe("Summarize - Out");
    expect(artifact?.messageId).toBe("node-n2");

    const fallbackArtifact = resolveNodePreviewArtifact(
      "n1",
      sampleNodes,
      {
        n1: { status: "completed" },
        n2: {
          status: "completed",
          artifact: {
            id: "art-1",
            type: "markdown",
            title: "Out",
            content: "Body",
          },
        },
      },
      true,
    );
    expect(fallbackArtifact?.title).toBe("Summarize - Out");

    const noFallback = resolveNodePreviewArtifact(
      "n1",
      sampleNodes,
      {
        n1: { status: "completed" },
        n2: {
          status: "completed",
          artifact: {
            id: "art-1",
            type: "markdown",
            title: "Out",
            content: "Body",
          },
        },
      },
      false,
    );
    expect(noFallback).toBeNull();
  });
});
