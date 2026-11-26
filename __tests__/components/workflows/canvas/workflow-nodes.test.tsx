import { render, screen } from "@testing-library/react";
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

  it("renders AiStepNode linked agent badge, Missing agent badge, and Needs info indicator", () => {
    render(
      <>
        <AiStepNode
          id="a1"
          selected={false}
          data={{
            label: "Linked",
            linkedAgent: { id: "agent-1", name: "Researcher" },
            nodeData: {
              kind: "ai_step",
              variableName: "step1",
              agentId: "agent-1",
              prompt: "",
              mcpServerIds: [],
              toolIds: [],
            },
          }}
        />
        <AiStepNode
          id="a2"
          selected={false}
          data={{
            label: "Broken",
            missingAgent: true,
            nodeData: {
              kind: "ai_step",
              variableName: "step2",
              agentId: "agent-deleted",
              prompt: "",
              mcpServerIds: [],
              toolIds: [],
            },
          }}
        />
        <AiStepNode
          id="a3"
          selected={false}
          data={{
            label: "Empty",
            nodeData: {
              kind: "ai_step",
              variableName: "step3",
              prompt: "",
              mcpServerIds: [],
              toolIds: [],
            },
          }}
        />
      </>,
    );

    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.getByText("Missing agent")).toBeInTheDocument();
    expect(screen.getByText("Needs info")).toBeInTheDocument();
  });
});
