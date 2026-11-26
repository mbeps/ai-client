import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowBuilderChat } from "@/components/workflows/editor/workflow-builder-chat";

const mockGetOrCreateWorkflowChat = vi.fn();
const mockResetWorkflowChat = vi.fn();
const mockGetChat = vi.fn();
const mockStreamResponse = vi.fn();
const mockStopGeneration = vi.fn();
const mockHandleApprove = vi.fn();
const mockHandleDeny = vi.fn();
const mockHandleDisableApprovals = vi.fn();
const mockUpsertChat = vi.fn();

let capturedOnDone: ((content: string) => void) | undefined;
let mockPendingApprovals: unknown[] = [];

vi.mock("@/actions/workflows/get-or-create-workflow-chat", () => ({
  getOrCreateWorkflowChat: (...args: unknown[]) =>
    mockGetOrCreateWorkflowChat(...args),
  resetWorkflowChat: (...args: unknown[]) => mockResetWorkflowChat(...args),
}));

vi.mock("@/actions/chats/get-chat", () => ({
  getChat: (...args: unknown[]) => mockGetChat(...args),
}));

vi.mock("@/hooks/chat/use-stream-response", () => ({
  useStreamResponse: (
    _chatId: string,
    options?: { onDone?: (content: string) => void },
  ) => {
    capturedOnDone = options?.onDone;
    return {
      isLoading: false,
      streamingContent: "",
      streamingReasoning: "",
      isStreamingReasoning: false,
      activeToolCalls: [
        { toolCallId: "tc-1", toolName: "manage_workflow", status: "done" },
      ],
      assistantMessageId: null,
      pendingApprovals: mockPendingApprovals,
      approvalsDisabled: false,
      submitToolApprovals: mockHandleApprove,
      streamResponse: mockStreamResponse,
      stopStream: mockStopGeneration,
    };
  },
}));

const mockHandleApiError = vi.fn();
vi.mock("@/hooks/use-api-error", () => ({
  useApiError: () => ({
    handleApiError: mockHandleApiError,
  }),
}));

vi.mock("@/components/chat/use-chat-ui-store", () => ({
  useChatStore: (chatId: string) => ({
    storeChat: chatId
      ? { id: chatId, title: "Builder: Test", messages: {}, currentLeafId: null }
      : undefined,
  }),
}));

vi.mock("@/components/chat/message-thread", () => ({
  MessageThread: ({ chat }: { chat: { id: string } }) => (
    <div data-testid="message-thread" data-chat-id={chat.id} />
  ),
}));

vi.mock("@/components/chat/streaming-section", () => ({
  StreamingSection: () => <div data-testid="streaming-section" />,
}));

vi.mock("@/components/chat/tool-approval-dialog", () => ({
  ToolApprovalDialog: ({
    pendingApprovals,
  }: {
    pendingApprovals: unknown[];
  }) =>
    pendingApprovals.length > 0 ? (
      <div data-testid="tool-approval-dialog" />
    ) : null,
}));

vi.mock("@/components/chat/chat-input", () => ({
  ChatInput: ({
    minimalMode,
    onSend,
  }: {
    minimalMode?: boolean;
    onSend: (
      content: string,
      attachments: unknown[],
      model: string,
      selectedServerIds: string[],
      selectedTools: string[],
    ) => Promise<void> | void;
  }) => (
    <div data-testid="chat-input" data-minimal={String(Boolean(minimalMode))}>
      <button
        type="button"
        onClick={() => onSend("Add a filter node", [], "gpt-4o", [], [])}
      >
        Send Mock
      </button>
    </div>
  ),
}));

describe("WorkflowBuilderChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnDone = undefined;
    mockPendingApprovals = [];
    mockGetOrCreateWorkflowChat.mockResolvedValue({
      ok: true,
      value: { id: "chat-wf-1", title: "Builder: Test", workflowId: "wf-1" },
    });
    mockResetWorkflowChat.mockResolvedValue({
      ok: true,
      value: { id: "chat-wf-2", title: "Builder: Test", workflowId: "wf-1" },
    });
    mockGetChat.mockResolvedValue({
      ok: true,
      value: {
        id: "chat-wf-1",
        title: "Builder: Test",
        messages: {},
        currentLeafId: null,
      },
    });
  });

  it("renders Create Draft CTA when isNew is true", () => {
    const onCreateDraft = vi.fn();
    render(
      <WorkflowBuilderChat
        workflowId="new"
        isNew={true}
        onCreateDraft={onCreateDraft}
      />,
    );

    const cta = screen.getByRole("button", {
      name: /create draft & start ai builder/i,
    });
    fireEvent.click(cta);
    expect(onCreateDraft).toHaveBeenCalledTimes(1);
  });

  it("loads workflow chat and renders ChatInput in minimalMode", async () => {
    render(<WorkflowBuilderChat workflowId="wf-1" isNew={false} />);

    await waitFor(() => {
      expect(mockGetOrCreateWorkflowChat).toHaveBeenCalledWith("wf-1");
    });

    const input = await screen.findByTestId("chat-input");
    expect(input.getAttribute("data-minimal")).toBe("true");
    expect(screen.getByTestId("message-thread")).toHaveAttribute(
      "data-chat-id",
      "chat-wf-1",
    );
  });

  it("runs onBeforeSend before dispatching streamResponse and aborts if false", async () => {
    const onBeforeSend = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    render(
      <WorkflowBuilderChat
        workflowId="wf-1"
        isNew={false}
        onBeforeSend={onBeforeSend}
      />,
    );

    const sendBtn = await screen.findByRole("button", { name: "Send Mock" });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(onBeforeSend).toHaveBeenCalledTimes(1);
    });
    expect(mockStreamResponse).not.toHaveBeenCalled();

    fireEvent.click(sendBtn);
    await waitFor(() => {
      expect(mockStreamResponse).toHaveBeenCalledTimes(1);
    });
  });

  it("calls onWorkflowMutated when onDone fires after manage_workflow", async () => {
    const onWorkflowMutated = vi.fn();
    render(
      <WorkflowBuilderChat
        workflowId="wf-1"
        isNew={false}
        onWorkflowMutated={onWorkflowMutated}
      />,
    );

    await screen.findByTestId("chat-input");
    capturedOnDone?.("Done");

    expect(onWorkflowMutated).toHaveBeenCalledTimes(1);
  });

  it("resets workflow chat when New chat is clicked", async () => {
    render(<WorkflowBuilderChat workflowId="wf-1" isNew={false} />);

    await screen.findByTestId("chat-input");
    fireEvent.click(screen.getByRole("button", { name: /new chat/i }));

    await waitFor(() => {
      expect(mockResetWorkflowChat).toHaveBeenCalledWith("wf-1");
    });
    await waitFor(() => {
      expect(screen.getByTestId("message-thread")).toHaveAttribute(
        "data-chat-id",
        "chat-wf-2",
      );
    });
  });

  it("renders ToolApprovalDialog when pendingApprovals is non-empty", async () => {
    mockPendingApprovals = [{ approvalId: "app-1", toolName: "manage_workflow" }];
    render(<WorkflowBuilderChat workflowId="wf-1" isNew={false} />);

    await screen.findByTestId("chat-input");
    expect(screen.getByTestId("tool-approval-dialog")).toBeInTheDocument();
  });
});
