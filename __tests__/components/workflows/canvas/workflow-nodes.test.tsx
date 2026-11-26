import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", () => ({
  Handle: ({
    id,
    type,
    position,
  }: {
    id?: string;
    type: string;
    position: string;
  }) => (
    <div
      data-testid={`handle-${type}-${id ?? "default"}`}
      data-position={position}
    />
  ),
  NodeToolbar: ({
    children,
    isVisible,
  }: {
    children: React.ReactNode;
    isVisible?: boolean;
  }) => (isVisible ? <div data-testid="node-toolbar">{children}</div> : null),
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

import { BaseWorkflowNode } from "@/components/workflows/canvas/base-workflow-node";
import { WORKFLOW_NODE_TYPES } from "@/components/workflows/canvas/node-types";
import { AiStepNode } from "@/components/workflows/canvas/nodes/ai-step-node";
import { HttpRequestNode } from "@/components/workflows/canvas/nodes/http-request-node";
import { IfConditionNode } from "@/components/workflows/canvas/nodes/if-condition-node";
import { ManualTriggerNode } from "@/components/workflows/canvas/nodes/manual-trigger-node";
import { WebhookTriggerNode } from "@/components/workflows/canvas/nodes/webhook-trigger-node";

describe("Workflow Custom Nodes & Registry", () => {
  it("exports module-scope WORKFLOW_NODE_TYPES with all 5 node types", () => {
    expect(Object.keys(WORKFLOW_NODE_TYPES).sort()).toEqual([
      "ai_step",
      "http_request",
      "if_condition",
      "manual_trigger",
      "webhook_trigger",
    ]);
  });

  it("renders ManualTriggerNode and WebhookTriggerNode with right source handles", () => {
    render(
      <>
        <ManualTriggerNode
          id="n1"
          selected={false}
          data={{
            label: "Start Flow",
            nodeData: {
              kind: "manual_trigger",
              variableName: "trigger",
              requiresFileUpload: true,
            },
          }}
        />
        <WebhookTriggerNode
          id="n2"
          selected={false}
          data={{
            label: "Stripe Hook",
            nodeData: {
              kind: "webhook_trigger",
              variableName: "webhook",
            },
          }}
        />
      </>,
    );

    expect(screen.getByText("Start Flow")).toBeInTheDocument();
    expect(screen.getByText("{{trigger}}")).toBeInTheDocument();
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("Stripe Hook")).toBeInTheDocument();
    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(screen.getAllByTestId("handle-source-main")).toHaveLength(2);
  });

  it("renders AiStepNode and HttpRequestNode with badges and status indicators", () => {
    render(
      <>
        <AiStepNode
          id="n3"
          selected={true}
          data={{
            label: "Summarize",
            status: "running",
            nodeData: {
              kind: "ai_step",
              variableName: "step1",
              prompt: "Summarize {{trigger.text}}",
              mcpServerIds: [],
              toolIds: ["Internal:tool:manage_artifact"],
              requiresReview: true,
              canvasMode: "markdown",
            },
          }}
        />
        <HttpRequestNode
          id="n4"
          selected={false}
          data={{
            label: "Send Webhook",
            status: "failed",
            nodeData: {
              kind: "http_request",
              variableName: "notify",
              method: "POST",
              url: "https://api.example.com/notify",
              headers: [],
            },
          }}
        />
      </>,
    );

    expect(screen.getByText("Summarize")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("markdown")).toBeInTheDocument();
    expect(screen.getByText("Send Webhook")).toBeInTheDocument();
    expect(screen.getByText("POST")).toBeInTheDocument();
  });

  it("renders IfConditionNode with explicit true and false right source handles", () => {
    render(
      <IfConditionNode
        id="n5"
        selected={false}
        data={{
          label: "Check Priority",
          status: "completed",
          nodeData: {
            kind: "if_condition",
            variableName: "branch1",
            evaluationMode: "hybrid",
            logic: "and",
            rules: [],
          },
        }}
      />,
    );

    expect(screen.getByText("Check Priority")).toBeInTheDocument();
    expect(screen.getByText("Hybrid")).toBeInTheDocument();
    expect(screen.getByTestId("handle-target-main")).toBeInTheDocument();
    expect(screen.getByTestId("handle-source-true")).toBeInTheDocument();
    expect(screen.getByTestId("handle-source-false")).toBeInTheDocument();
  });

  it("handles toolbar Configure/Delete clicks, double-click, readOnly, and default accentClassName", () => {
    const onConfigure = vi.fn();
    const onDelete = vi.fn();

    const { rerender } = render(
      <BaseWorkflowNode
        id="n-base"
        selected={true}
        icon={<span>icon</span>}
        data={{
          label: "Base Node",
          nodeData: { kind: "manual_trigger", variableName: "baseVar" },
          onConfigure,
          onDelete,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Configure/i }));
    expect(onConfigure).toHaveBeenCalledWith("n-base");

    fireEvent.click(screen.getByRole("button", { name: /Delete/i }));
    expect(onDelete).toHaveBeenCalledWith("n-base");

    fireEvent.doubleClick(screen.getByText("Base Node"));
    expect(onConfigure).toHaveBeenCalledTimes(2);

    rerender(
      <BaseWorkflowNode
        id="n-base"
        selected={true}
        icon={<span>icon</span>}
        data={{
          label: "Base Node",
          readOnly: true,
          nodeData: { kind: "manual_trigger", variableName: "baseVar" },
          onConfigure,
          onDelete,
        }}
      />,
    );

    fireEvent.doubleClick(screen.getByText("Base Node"));
    expect(onConfigure).toHaveBeenCalledTimes(2);
  });

  it("renders plural tool/rule badges and empty URL fallback", () => {
    render(
      <>
        <AiStepNode
          id="n-ai-2"
          selected={false}
          data={{
            label: "Multi Tool",
            nodeData: {
              kind: "ai_step",
              variableName: "ai2",
              prompt: "",
              mcpServerIds: [],
              toolIds: ["t1", "t2"],
            },
          }}
        />
        <HttpRequestNode
          id="n-http-empty"
          selected={false}
          data={{
            label: "Empty URL",
            nodeData: {
              kind: "http_request",
              variableName: "httpEmpty",
              method: "GET",
              url: "",
              headers: [],
            },
          }}
        />
        <IfConditionNode
          id="n-if-1"
          selected={false}
          data={{
            label: "One Rule",
            nodeData: {
              kind: "if_condition",
              variableName: "if1",
              evaluationMode: "rules",
              logic: "and",
              rules: [{ id: "r1", leftOperand: "a", operator: "equals", rightOperand: "b" }],
            },
          }}
        />
        <IfConditionNode
          id="n-if-2"
          selected={false}
          data={{
            label: "Two Rules",
            nodeData: {
              kind: "if_condition",
              variableName: "if2",
              evaluationMode: "rules",
              logic: "and",
              rules: [
                { id: "r1", leftOperand: "a", operator: "equals", rightOperand: "b" },
                { id: "r2", leftOperand: "c", operator: "equals", rightOperand: "d" },
              ],
            },
          }}
        />
      </>,
    );

    expect(screen.getByText("2 tools")).toBeInTheDocument();
    expect(screen.getByText("Configure URL...")).toBeInTheDocument();
    expect(screen.getByText("1 rule")).toBeInTheDocument();
    expect(screen.getByText("2 rules")).toBeInTheDocument();
  });
});
