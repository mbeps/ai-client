import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResponseTimeline } from "@/components/chat/message/response-timeline";

vi.mock("@/components/chat/message/scratchpad-viewer-modal", () => ({
  ScratchpadViewerModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="scratchpad-modal">Scratchpad Modal Content</div> : null,
}));

describe("ResponseTimeline", () => {
  it("renders null when no reasoning or tool steps exist", () => {
    const { container } = render(<ResponseTimeline />);
    expect(container.firstChild).toBeNull();
  });

  it("renders reasoning step with thought process", () => {
    render(<ResponseTimeline reasoning="Thinking step by step" />);
    expect(screen.getByText("Thought process")).toBeInTheDocument();
  });

  it("renders streaming reasoning step with Thinking... label", () => {
    render(<ResponseTimeline isStreamingReasoning={true} />);
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
  });

  it("renders standard and MCP tool execution steps", async () => {
    const user = userEvent.setup();

    render(
      <ResponseTimeline
        toolCalls={[
          {
            toolCallId: "tc-1",
            toolName: "web_search",
            args: { query: "vitest" },
          },
          {
            toolCallId: "tc-2",
            toolName: "read_file",
            serverName: "fs-server",
            args: { path: "/test.txt" },
          },
        ]}
        toolResults={[
          {
            toolCallId: "tc-1",
            toolName: "web_search",
            result: { hits: 5 },
          },
          {
            toolCallId: "tc-2",
            toolName: "read_file",
            serverName: "fs-server",
            result: "file contents",
          },
        ]}
      />,
    );

    expect(screen.getByText("web_search")).toBeInTheDocument();
    expect(screen.getByText("fs-server")).toBeInTheDocument();
    expect(screen.getByText("read_file")).toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: /web_search/i });
    await user.click(trigger);

    expect(await screen.findByText("Context Usage")).toBeInTheDocument();
    expect(screen.getByText("Arguments")).toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
  });

  it("renders delegated subagent activity and opens scratchpad modal", async () => {
    const user = userEvent.setup();

    render(
      <ResponseTimeline
        messageId="msg-123"
        chatId="chat-456"
        toolCalls={[
          {
            toolCallId: "sub-1",
            toolName: "delegate_task",
            args: {
              role: "researcher",
              taskBrief: "Survey codebase architecture",
              inputData: "Relevant paths: lib/",
            },
          },
        ]}
        toolResults={[
          {
            toolCallId: "sub-1",
            toolName: "delegate_task",
            result: "Architecture surveyed successfully.",
          },
        ]}
      />,
    );

    expect(screen.getByText(/Researcher/i)).toBeInTheDocument();
    expect(screen.getByText("Survey codebase architecture")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();

    const scratchpadButton = screen.getByRole("button", { name: /Scratchpad/i });
    expect(scratchpadButton).toBeInTheDocument();

    await user.click(scratchpadButton);
    expect(await screen.findByTestId("scratchpad-modal")).toBeInTheDocument();
  });
});
