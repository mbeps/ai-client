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

  it("renders matched/total count badge and reasoning when state.filterSummary is present", () => {
    const filterNode: WorkflowNode = {
      id: "filter-1",
      type: "filter",
      name: "High Priority Filter",
      position: { x: 0, y: 0 },
      data: {
        kind: "filter",
        variableName: "filter1",
        items: "{{step1.items}}",
        mode: "deterministic",
        rules: [],
      },
    };
    const state: WorkflowNodeRunState = {
      status: "completed",
      filterSummary: {
        kept: 3,
        total: 5,
        reasoning: "Kept high-priority items",
      },
    };

    render(
      <WorkflowRunNodeCard
        node={filterNode}
        state={state}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Matched: 3/5")).toBeInTheDocument();
    expect(screen.getByText("Kept high-priority items")).toBeInTheDocument();
  });

  it("renders completed/total iterations summary when state.loopSummary is present", () => {
    const loopNode: WorkflowNode = {
      id: "loop-1",
      type: "loop",
      name: "Process Items",
      position: { x: 0, y: 0 },
      data: {
        kind: "loop",
        variableName: "loop1",
        mode: "for_each",
        items: "{{filter1.items}}",
      },
    };
    const state: WorkflowNodeRunState = {
      status: "completed",
      loopSummary: {
        iterations: 4,
        totalItems: 5,
        truncated: true,
      },
    };

    render(
      <WorkflowRunNodeCard
        node={loopNode}
        state={state}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Iterations: 4/5")).toBeInTheDocument();
    expect(screen.getByText("Truncated")).toBeInTheDocument();
  });
});
