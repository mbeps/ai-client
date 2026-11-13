import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  resolveTraceLineStatus,
  SubagentTraceStep,
} from "@/components/chat/message/subagent-trace-step";

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

// Mock ScratchpadViewerModal
vi.mock("@/components/chat/message/scratchpad-viewer-modal", () => ({
  ScratchpadViewerModal: ({ open, onOpenChange }: any) =>
    open ? (
      <div data-testid="scratchpad-modal">
        <button onClick={() => onOpenChange(false)}>Close Modal</button>
      </div>
    ) : null,
}));

describe("resolveTraceLineStatus", () => {
  it("returns running when isRunning is true", () => {
    expect(resolveTraceLineStatus(true, false)).toBe("running");
    expect(resolveTraceLineStatus(true, true)).toBe("running");
  });

  it("returns error when isRunning is false and isError is true", () => {
    expect(resolveTraceLineStatus(false, true)).toBe("error");
  });

  it("returns undefined when neither running nor error", () => {
    expect(resolveTraceLineStatus(false, false)).toBeUndefined();
  });
});

describe("SubagentTraceStep", () => {
  it("renders running state with task brief and role", () => {
    render(
      <SubagentTraceStep
        toolCallId="call-sub-1"
        role="researcher"
        taskBrief="Find competitive pricing"
        state="running"
      />,
    );

    expect(screen.getByText("Researcher")).toBeDefined();
    expect(screen.getByText("Find competitive pricing")).toBeDefined();
    expect(screen.getByText("Delegating...")).toBeDefined();
  });

  it("renders custom/unknown role safely", () => {
    render(
      <SubagentTraceStep
        toolCallId="call-sub-2"
        role="custom-agent"
        taskBrief="Perform custom task"
        state="done"
        result="Task completed successfully"
      />,
    );

    expect(screen.getByText("custom-agent")).toBeDefined();
    expect(screen.getByText("Perform custom task")).toBeDefined();
    expect(screen.getByText("Completed")).toBeDefined();
  });

  it("renders error state when state is error", () => {
    render(
      <SubagentTraceStep
        toolCallId="call-sub-3"
        role="worker"
        taskBrief="Execute query"
        state="error"
        result={{ error: "Database timeout" }}
      />,
    );

    expect(screen.getByText("Worker")).toBeDefined();
    expect(screen.getByText("Blocked")).toBeDefined();
  });

  it("opens scratchpad viewer modal when Scratchpad button is clicked", async () => {
    render(
      <SubagentTraceStep
        toolCallId="call-sub-4"
        role="planner"
        taskBrief="Draft sprint plan"
        state="done"
        messageId="msg-123"
        chatId="chat-456"
      />,
    );

    const scratchpadBtn = screen.getByText("Scratchpad");
    expect(scratchpadBtn).toBeDefined();

    await userEvent.click(scratchpadBtn);
    expect(screen.getByTestId("scratchpad-modal")).toBeDefined();

    await userEvent.click(screen.getByText("Close Modal"));
    expect(screen.queryByTestId("scratchpad-modal")).toBeNull();
  });

  it("renders collapsible details with input data and findings when expanded", () => {
    render(
      <SubagentTraceStep
        toolCallId="call-sub-5"
        role="reviewer"
        taskBrief="Check PR review"
        inputData="const x = 1;"
        result="Code looks great!"
        state="done"
      />,
    );

    // Expand accordion
    fireEvent.click(screen.getByText("Check PR review"));

    expect(screen.getByText("Delegated Prompt")).toBeDefined();
    expect(screen.getByText("Context Pointers & Input Data")).toBeDefined();
    expect(screen.getByText("const x = 1;")).toBeDefined();
    expect(screen.getByText("Worker Findings")).toBeDefined();
    expect(screen.getByText("Code looks great!")).toBeDefined();
  });

  it("displays custom agentName and agentId title when provided", () => {
    render(
      <SubagentTraceStep
        toolCallId="call-sub-6"
        role="worker"
        agentId="custom-agent-1"
        agentName="SQL Analyst"
        taskBrief="Query user retention"
        state="done"
        result="Done"
      />,
    );

    const badge = screen.getByText("SQL Analyst");
    expect(badge).toBeDefined();
    expect(badge.getAttribute("title")).toBe("custom-agent-1");
  });
});
