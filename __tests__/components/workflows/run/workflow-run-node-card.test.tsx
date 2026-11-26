import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowRunNodeCard } from "@/components/workflows/run/workflow-run-node-card";
import type {
  WorkflowNode,
  WorkflowNodeRunState,
} from "@/types/workflows/workflow";

vi.mock("@/components/chat/message/assistant-message-body", () => ({
  AssistantMessageBody: ({ content }: { content: string }) => (
    <div data-testid="assistant-message-body">{content}</div>
  ),
}));

vi.mock("@/components/chat/message/response-timeline", () => ({
  ResponseTimeline: () => <div data-testid="response-timeline" />,
}));

const baseNode: WorkflowNode = {
  id: "node-1",
  type: "ai_step",
  name: "Extract Invoices",
  position: { x: 0, y: 0 },
  data: {
    kind: "ai_step",
    variableName: "step1",
    prompt: "Extract invoices",
    tools: [],
  },
};

describe("WorkflowRunNodeCard", () => {
  it("renders structured JSON output card when state.structuredOutput is present", () => {
    const state: WorkflowNodeRunState = {
      status: "completed",
      summary: '{"count":2,"items":["a","b"]}',
      structuredOutput: {
        count: 2,
        items: ["a", "b"],
      },
    };

    render(
      <WorkflowRunNodeCard
        node={baseNode}
        state={state}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Structured Output")).toBeInTheDocument();
    expect(screen.getByText(/"count": 2/)).toBeInTheDocument();
    expect(screen.getByText(/"items": \[/)).toBeInTheDocument();
    expect(
      screen.queryByTestId("assistant-message-body"),
    ).not.toBeInTheDocument();
  });

  it("renders markdown body when structuredOutput is absent", () => {
    const state: WorkflowNodeRunState = {
      status: "completed",
      summary: "Hello **world**",
    };

    render(
      <WorkflowRunNodeCard
        node={baseNode}
        state={state}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.queryByText("Structured Output")).not.toBeInTheDocument();
    expect(screen.getByTestId("assistant-message-body")).toHaveTextContent(
      "Hello **world**",
    );
  });
});
