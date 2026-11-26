import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveTraceLineStatus,
  SubagentTraceStep,
} from "@/components/chat/message/subagent-trace-step";
import type { Agent } from "@/types/agent/agent";

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

let mockStoreAgents: Agent[] = [];

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (s: { agents: Agent[] }) => unknown) =>
    selector({ agents: mockStoreAgents }),
}));

const mockGetScratchpadFilesAction = vi.fn();
vi.mock("@/actions/subagents/get-scratchpad", () => ({
  getScratchpadFilesAction: (...args: unknown[]) =>
    mockGetScratchpadFilesAction(...args),
}));

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
  beforeEach(() => {
    mockStoreAgents = [];
    mockGetScratchpadFilesAction.mockReset();
    mockGetScratchpadFilesAction.mockResolvedValue({ ok: true, value: [] });
  });

  it("renders running state without showing the full prompt in the collapsed header", () => {
    render(
      <SubagentTraceStep
        toolCallId="call-sub-1"
        role="researcher"
        taskBrief="Find competitive pricing"
        state="running"
      />,
    );

    expect(screen.getByText("Researcher")).toBeDefined();
    expect(screen.getByText("Delegating...")).toBeDefined();
    expect(screen.queryByText("Find competitive pricing")).toBeNull();
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

  it("shows Scratchpad button inside the expanded accordion only when scratchpad has content", async () => {
    mockGetScratchpadFilesAction.mockResolvedValue({
      ok: true,
      value: [
        {
          id: "sp-1",
          filePath: "notes.md",
          content: "findings",
          writtenByRole: "planner",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

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

    // Not visible while collapsed
    expect(screen.queryByText(/Scratchpad/)).toBeNull();

    // Expand accordion
    fireEvent.click(screen.getByRole("button", { name: /Planner/i }));

    const scratchpadBtn = await screen.findByRole("button", {
      name: /Scratchpad/i,
    });
    expect(scratchpadBtn).toBeDefined();

    await userEvent.click(scratchpadBtn);
    expect(screen.getByTestId("scratchpad-modal")).toBeDefined();

    await userEvent.click(screen.getByText("Close Modal"));
    expect(screen.queryByTestId("scratchpad-modal")).toBeNull();
  });

  it("hides Scratchpad button inside accordion when scratchpad is empty", async () => {
    mockGetScratchpadFilesAction.mockResolvedValue({ ok: true, value: [] });

    render(
      <SubagentTraceStep
        toolCallId="call-sub-empty-sp"
        role="planner"
        taskBrief="Draft sprint plan"
        state="done"
        messageId="msg-123"
        chatId="chat-456"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Planner/i }));

    await waitFor(() => {
      expect(mockGetScratchpadFilesAction).toHaveBeenCalledWith(
        "chat-456",
        "msg-123",
      );
    });
    expect(screen.queryByRole("button", { name: /Scratchpad/i })).toBeNull();
  });

  it("hides Scratchpad button when agent scratchpadAccess is none", async () => {
    mockStoreAgents = [
      {
        id: "agent-no-scratchpad",
        name: "No Scratchpad Agent",
        guardrails: {
          maxSteps: 10,
          scratchpadAccess: "none",
          isolateTools: true,
        },
      } as Agent,
    ];

    render(
      <SubagentTraceStep
        toolCallId="call-sub-no-sp"
        role="worker"
        agentId="agent-no-scratchpad"
        taskBrief="Run isolated task"
        state="done"
        messageId="msg-123"
        chatId="chat-456"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /No Scratchpad Agent/i }),
    );
    expect(mockGetScratchpadFilesAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Scratchpad/i })).toBeNull();
  });

  it("renders collapsible details with prompt, input data, findings, and returned output when expanded", () => {
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

    fireEvent.click(screen.getByRole("button", { name: /Reviewer/i }));

    expect(screen.getByText("Delegated Prompt")).toBeDefined();
    expect(screen.getByText("Check PR review")).toBeDefined();
    expect(screen.getByText("Context Pointers & Input Data")).toBeDefined();
    expect(screen.getByText("const x = 1;")).toBeDefined();
    expect(screen.getByText("Worker Findings")).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Worker findings info/i }),
    ).toBeDefined();
    expect(screen.queryByText("Returned to Main Agent")).toBeNull();
    expect(screen.getByText("Code looks great!")).toBeDefined();
  });

  it("renders nested reasoning, tool calls, streaming text, and execution metadata from UIMessage result", async () => {
    render(
      <SubagentTraceStep
        toolCallId="call-sub-stream"
        role="researcher"
        taskBrief="Research MCP"
        state="done"
        result={{
          id: "run-1",
          role: "assistant",
          parts: [
            { type: "reasoning", text: "Searching KB first.", state: "done" },
            {
              type: "tool-search_knowledge_base",
              toolCallId: "inner-1",
              state: "output-available",
              input: { query: "MCP" },
              output: { hits: 2 },
            },
            {
              type: "text",
              text: "STATUS: DONE\n\nFound 2 MCP docs.",
              state: "done",
            },
          ],
          metadata: {
            modelId: "gpt-4o-mini",
            durationMs: 1800,
            stepCount: 2,
            maxSteps: 10,
            finishReason: "stop",
            usage: { totalTokens: 320 },
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Researcher/i }));

    expect(screen.getByText("Thought process")).toBeDefined();
    expect(screen.getByText("Search Knowledge Base")).toBeDefined();
    expect(screen.getAllByText("Found 2 MCP docs.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("gpt-4o-mini")).toBeDefined();
    expect(screen.getByText("1.8s")).toBeDefined();
    expect(screen.getByText("2 / 10 steps")).toBeDefined();
    expect(screen.getByText("320 tokens")).toBeDefined();
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
    expect(badge.className).toContain("text-purple-700");
  });

  it("resolves custom agent from store by agentId or name and uses purple styling", () => {
    mockStoreAgents = [
      {
        id: "uuid-mcp-res",
        name: "Maruf MCP Researcher",
        isBuiltIn: false,
      } as unknown as Agent,
      {
        id: "builtin:researcher",
        name: "Researcher",
        isBuiltIn: true,
      } as unknown as Agent,
    ];

    const { unmount } = render(
      <SubagentTraceStep
        toolCallId="call-sub-7"
        role="researcher"
        agentId="uuid-mcp-res"
        taskBrief="Fetch MCP data"
        state="done"
        result="Done"
      />,
    );

    const badgeById = screen.getByText("Maruf MCP Researcher");
    expect(badgeById).toBeDefined();
    expect(badgeById.getAttribute("title")).toBe("uuid-mcp-res");
    expect(badgeById.className).toContain("text-purple-700");
    unmount();

    const { unmount: unmount2 } = render(
      <SubagentTraceStep
        toolCallId="call-sub-8"
        role="maruf mcp researcher"
        taskBrief="Fetch MCP data by name"
        state="done"
        result="Done"
      />,
    );

    const badgeByName = screen.getByText("Maruf MCP Researcher");
    expect(badgeByName).toBeDefined();
    expect(badgeByName.getAttribute("title")).toBe("uuid-mcp-res");
    expect(badgeByName.className).toContain("text-purple-700");
    unmount2();

    render(
      <SubagentTraceStep
        toolCallId="call-sub-9"
        role="researcher"
        agentId="builtin:researcher"
        taskBrief="Standard research"
        state="done"
        result="Done"
      />,
    );

    const builtInBadge = screen.getByText("Researcher");
    expect(builtInBadge.className).toContain("text-blue-700");
  });

  it("hides empty '{}' inputData and strips leading STATUS prefix from worker findings", async () => {
    const user = userEvent.setup();
    render(
      <SubagentTraceStep
        toolCallId="call-sub-10"
        role="researcher"
        taskBrief="Research Maruf"
        inputData="{ }"
        state="done"
        result={"<think>Internal monologue</think>STATUS: DONE\n\nClean summary."}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Researcher/i });
    await user.click(trigger);

    expect(screen.queryByText("Context Pointers & Input Data")).toBeNull();
    expect(screen.queryByText(/Internal monologue/)).toBeNull();
    expect(screen.getAllByText("Clean summary.").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText("Completed")).toBeDefined();
  });

  it("handles subagent duration formatting (<1s and >=1m), empty metadata, scratchpad rejection without chatId, and status-only result", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <SubagentTraceStep
        toolCallId="call-meta-1"
        role="researcher"
        taskBrief="Short task"
        state="done"
        messageId="msg-1"
        result={{
          id: "r1",
          role: "assistant",
          parts: [],
          metadata: {
            durationMs: 500,
            stepCount: 1,
            usage: { totalTokens: 10 },
          },
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Researcher/i }));
    expect(screen.getAllByText("500ms").length).toBeGreaterThanOrEqual(1);

    rerender(
      <SubagentTraceStep
        toolCallId="call-meta-2"
        role="researcher"
        taskBrief="Long task"
        state="done"
        result={{
          id: "r2",
          role: "assistant",
          parts: [],
          metadata: { durationMs: 65000 },
        }}
      />,
    );
    expect(screen.getAllByText("1m 5.0s").length).toBeGreaterThanOrEqual(1);

    rerender(
      <SubagentTraceStep
        toolCallId="call-meta-3"
        role="researcher"
        taskBrief="Empty meta"
        state="done"
        result={{
          id: "r3",
          role: "assistant",
          parts: [],
          metadata: {},
        }}
      />,
    );

    rerender(
      <SubagentTraceStep
        toolCallId="call-status-only"
        role="researcher"
        taskBrief="Status only"
        state="done"
        result="STATUS: DONE"
      />,
    );
    expect(screen.getAllByText("STATUS: DONE").length).toBeGreaterThanOrEqual(1);
  });

  it("covers finishReason badge, streaming reasoning/text, calling tool step, and plural tools", async () => {
    const user = userEvent.setup();
    render(
      <SubagentTraceStep
        toolCallId="call-stream-1"
        role="researcher"
        taskBrief="Streaming task"
        state="running"
        result={{
          id: "r-stream",
          role: "assistant",
          parts: [
            { type: "reasoning", text: "", state: "streaming" },
            {
              type: "tool-search",
              toolCallId: "tc-1",
              toolName: "search",
              state: "input-streaming",
              input: { q: "a" },
            },
            {
              type: "tool-read",
              toolCallId: "tc-2",
              toolName: "read",
              state: "output-available",
              input: { path: "b" },
              output: "ok",
            },
            { type: "text", text: "Partial findings", state: "streaming" },
          ],
          metadata: {
            finishReason: "length",
            stepCount: 2,
          },
        }}
      />,
    );

    expect(screen.getByText("2 tools")).toBeDefined();
    await user.click(screen.getByRole("button", { name: /Researcher/i }));
    expect(screen.getByText("length")).toBeDefined();
    expect(screen.getByText("Partial findings")).toBeDefined();
  });

  it("handles scratchpad lookup rejection, running state, singular tool, and Concerns/Needs Context badges", async () => {
    const scratchpadMod = await import("@/actions/subagents/get-scratchpad");
    vi.spyOn(scratchpadMod, "getScratchpadFilesAction").mockRejectedValueOnce(new Error("transient"));

    const { rerender } = render(
      <SubagentTraceStep
        toolCallId="call-concerns"
        role="reviewer"
        taskBrief="Review"
        state="done"
        chatId="c1"
        messageId="m1"
        result={{
          id: "r1",
          role: "assistant",
          parts: [
            { type: "tool-read_file", toolCallId: "t1", state: "output-available", input: {}, output: {} },
            { type: "text", text: "STATUS: DONE_WITH_CONCERNS\n\nFound issues.", state: "done" },
          ],
        }}
      />,
    );
    expect(screen.getByText("1 tool")).toBeDefined();
    expect(screen.getByText("Concerns")).toBeDefined();

    rerender(
      <SubagentTraceStep
        toolCallId="call-needs-context"
        role="researcher"
        taskBrief="Research"
        state="done"
        result="STATUS: NEEDS_CONTEXT\n\nNeed more info."
      />,
    );
    expect(screen.getByText("Needs Context")).toBeDefined();

    rerender(
      <SubagentTraceStep
        toolCallId="call-running-empty"
        role="coder"
        taskBrief="Code"
        state="running"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Coder/i }));
    expect(screen.getByText("Subagent is working...")).toBeDefined();
  });
});
