import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mock inngest/react useRealtime ──────────────────────────────────────────
const realtimeState = vi.hoisted(() => ({
  config: null as any,
  messages: {
    delta: [] as any[],
    all: [] as any[],
    byTopic: {},
    last: null,
  },
  connectionStatus: "open" as string,
  error: null as any,
}));

vi.mock("inngest/react", () => ({
  useRealtime: (config: any) => {
    realtimeState.config = config;
    const messages = {
      ...realtimeState.messages,
      all:
        realtimeState.messages.all === undefined
          ? undefined
          : realtimeState.messages.all.length > 0
            ? realtimeState.messages.all
            : [...realtimeState.messages.delta],
    };
    return {
      messages,
      connectionStatus: realtimeState.connectionStatus,
      runStatus: "running",
      isPaused: false,
      pauseReason: null,
      result: null,
      error: realtimeState.error,
      reset: vi.fn(),
    };
  },
  getClientSubscriptionToken: vi.fn().mockResolvedValue("mock-token"),
}));

const mockPersist = vi.hoisted(() => vi.fn());
vi.mock("@/actions/chats/persist-message", () => ({
  persistMessage: mockPersist,
}));

const mockGetChat = vi.hoisted(() => vi.fn());
vi.mock("@/actions/chats/get-chat", () => ({
  getChat: mockGetChat,
}));

const mockBuildChatFromRows = vi.hoisted(() => vi.fn());
vi.mock("@/actions/chats/build-chat", () => ({
  buildChatFromRows: mockBuildChatFromRows,
}));

vi.mock("@/actions/chats/chat-realtime-token", () => ({
  getChatRealtimeToken: vi.fn().mockResolvedValue("mock-token"),
  triggerChatResponseAction: vi.fn().mockResolvedValue({ success: true }),
}));

const mockProcessAttachments = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/attachments/process-attachments", () => ({
  processAttachments: mockProcessAttachments,
}));

const mockGetMcpPrompt = vi.hoisted(() => vi.fn());
vi.mock("@/actions/mcp/get-mcp-prompt", () => ({
  getMcpPrompt: mockGetMcpPrompt,
}));

const mockStoreState = vi.hoisted(() => ({
  addMessage: vi.fn(),
  updateMessageAttachments: vi.fn(),
  upsertChat: vi.fn(),
  prompts: [],
}));

vi.mock("@/lib/store", () => ({
  useAppStore: Object.assign(
    (selector: (s: any) => any) => selector(mockStoreState),
    { getState: () => mockStoreState },
  ),
}));

const mockHandleApiError = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-api-error", () => ({
  useApiError: () => ({ handleApiError: vi.fn().mockReturnValue(false) }),
  useApiError: () => ({ handleApiError: mockHandleApiError }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { useStreamResponse } from "@/hooks/chat/use-stream-response";

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  realtimeState.config = null;
  realtimeState.connectionStatus = "open";
  realtimeState.error = null;
  realtimeState.messages = {
    delta: [],
    all: [],
    byTopic: {},
    last: null,
  };
  mockPersist.mockResolvedValue({});
  mockProcessAttachments.mockResolvedValue([]);
  mockGetChat.mockReset();
  mockBuildChatFromRows.mockReset();
  mockStoreState.upsertChat.mockClear();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  });
});

describe("useStreamResponse (Inngest Realtime-backed)", () => {
  it("awaits persistMessage BEFORE triggering the API dispatch", async () => {
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    let resolvePersist!: () => void;
    mockPersist.mockReturnValue(new Promise<void>((r) => (resolvePersist = r)));

    let p!: Promise<string>;
    await act(async () => {
      p = result.current.streamResponse("user-msg-1", "hello", null);
    });
    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      resolvePersist();
      await p;
    });

    expect(mockPersist).toHaveBeenCalledWith("chat-1", expect.anything());
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("sends chatId + userMessageId + selections in the request body to /api/chat", async () => {
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse(
        "user-msg-1",
        "hello",
        null,
        [],
        "gpt-x",
        ["srv1"],
        ["srv1:tool:t"],
        undefined,
        "asst-1",
        ["kb-1"],
        ["skill-1"],
      );
    });

    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe("/api/chat");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      chatId: "chat-1",
      userMessageId: "user-msg-1",
      model: "gpt-x",
      selectedServerIds: ["srv1"],
      selectedTools: ["srv1:tool:t"],
      selectedAssistantId: "asst-1",
      selectedKbIds: ["kb-1"],
    });
  });

  it("optimistically inserts the user message into the store", async () => {
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", "parent-1");
    });

    expect(mockStoreState.addMessage).toHaveBeenCalledWith("chat-1", {
      role: "user",
      content: "hello",
      parentId: "parent-1",
      id: "user-msg-1",
      metadata: expect.any(String),
      attachments: [],
    });
  });

  it("resolves MCP prompt successfully and attaches it to message content", async () => {
    mockGetMcpPrompt.mockResolvedValueOnce({
      messages: [{ content: "Custom MCP instructions" }],
    });
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse(
        "user-msg-1",
        "hello",
        null,
        [],
        "gpt-4",
        [],
        [],
        "mcp:server-1:prompt-1",
      );
    });

    expect(mockStoreState.addMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.objectContaining({
        content: `Custom MCP instructions\n\nhello`,
        metadata: expect.stringContaining('"promptId":"mcp:server-1:prompt-1"'),
      }),
    );
    expect(global.fetch).toHaveBeenCalled();
  });

  it("handles error in resolveMcpPrompt gracefully", async () => {
    mockGetMcpPrompt.mockRejectedValueOnce(new Error("MCP offline"));
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse(
        "user-msg-1",
        "hello",
        null,
        [],
        "gpt-4",
        [],
        [],
        "mcp:server-1:prompt-1",
      );
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Failed to load MCP prompt. Sending message without it.",
    );
    expect(mockStoreState.addMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.objectContaining({
        content: "hello",
      }),
    );
    expect(global.fetch).toHaveBeenCalled();
  });

  it("handles error event from stream", async () => {
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "error", message: "Rate limit exceeded" } },
        ],
      };
      rerender();
    });

    expect(mockToastError).toHaveBeenCalledWith("Rate limit exceeded");
  });

  it("handles syncFromDb error when syncing on connection error", async () => {
    mockGetChat.mockRejectedValueOnce(new Error("DB error"));
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    await act(async () => {
      realtimeState.connectionStatus = "error";
      rerender();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGetChat).toHaveBeenCalledWith("chat-1");
  });

  it("supports stopStream and fetchChatToken rejection when chatId is missing", async () => {
    const { result } = renderHook(() => useStreamResponse(""));

    await act(() => {
      result.current.stopStream();
    });

    const tokenFn = realtimeState.config?.token;
    if (tokenFn) {
      await expect(tokenFn()).rejects.toThrow("No chatId");
    }
  });

  it("syncs the assistant message into the store with the server-assigned id on finish event", async () => {
    const { result, rerender } = renderHook(() =>
      useStreamResponse("chat-1"),
    );

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", "parent-1");
    });

    // Simulate deltas arriving over realtime
    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "start", messageId: "server-assistant-id" } },
          { data: { type: "reasoning-delta", reasoning: "thinking" } },
          { data: { type: "text-delta", text: "answer" } },
          { data: { type: "finish", finishReason: "stop" } },
        ],
      };
      rerender();
    });

    expect(mockStoreState.addMessage).toHaveBeenCalledWith("chat-1", {
      role: "assistant",
      content: "answer",
      parentId: "user-msg-1",
      id: "server-assistant-id",
      metadata: expect.stringContaining("thinking"),
      reasoning: "thinking",
    });
  });

  it("syncs completed tool calls and results as raw objects in metadata on finish event", async () => {
    const { result, rerender } = renderHook(() =>
      useStreamResponse("chat-1"),
    );

    await act(async () => {
      await result.current.streamResponse(
        "user-msg-1",
        "generate artifact",
        null,
      );
    });

    mockStoreState.addMessage.mockClear();

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "start", messageId: "server-assistant-id" } },
          {
            data: {
              type: "tool-call",
              toolCallId: "tc-1",
              toolName: "manage_artifact",
              args: { type: "spreadsheet", title: "Test" },
            },
          },
          {
            data: {
              type: "tool-result",
              toolCallId: "tc-1",
              toolName: "manage_artifact",
              result: {
                success: true,
                artifact: { id: "art-1", type: "spreadsheet" },
              },
            },
          },
          {
            data: {
              type: "text-delta",
              text: "I made the spreadsheet.",
            },
          },
          { data: { type: "finish", finishReason: "stop" } },
        ],
      };
      rerender();
    });

    expect(mockStoreState.addMessage).toHaveBeenCalledTimes(1);
    const addedCall = mockStoreState.addMessage.mock.calls[0][1];
    expect(addedCall.content).toBe("I made the spreadsheet.");
    expect(addedCall.parentId).toBe("user-msg-1");
    const meta = JSON.parse(addedCall.metadata);
    expect(meta.toolCalls).toEqual([
      {
        toolCallId: "tc-1",
        toolName: "manage_artifact",
        args: { type: "spreadsheet", title: "Test" },
      },
    ]);
    expect(meta.toolResults).toEqual([
      {
        toolCallId: "tc-1",
        toolName: "manage_artifact",
        result: {
          success: true,
          artifact: { id: "art-1", type: "spreadsheet" },
        },
      },
    ]);
  });

  it("skips syncing when the assistant produced no content", async () => {
    const { result, rerender } = renderHook(() =>
      useStreamResponse("chat-1"),
    );

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    mockStoreState.addMessage.mockClear();

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "start", messageId: "a1" } },
          { data: { type: "finish", finishReason: "stop" } },
        ],
      };
      rerender();
    });

    expect(mockStoreState.addMessage).not.toHaveBeenCalled();
  });

  it("derives streaming state as deltas arrive over realtime", async () => {
    const { result, rerender } = renderHook(() =>
      useStreamResponse("chat-1"),
    );

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "start", messageId: "a1" } },
          { data: { type: "reasoning-delta", reasoning: "hmm" } },
          { data: { type: "text-delta", text: "partial ans" } },
          {
            data: {
              type: "tool-call",
              toolCallId: "t1",
              toolName: "search",
              args: { q: "x" },
            },
          },
          {
            data: {
              type: "tool-call",
              toolCallId: "t2",
              toolName: "search",
              args: { q: "y" },
            },
          },
          {
            data: {
              type: "tool-result",
              toolCallId: "t2",
              toolName: "search",
              result: { hits: 1 },
            },
          },
        ],
      };
      rerender();
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.streamingContent).toBe("partial ans");
    expect(result.current.streamingReasoning).toBe("hmm");
    expect(result.current.isStreamingReasoning).toBe(false);
    expect(result.current.activeToolCalls).toEqual([
      {
        toolCallId: "t1",
        toolName: "search",
        args: { q: "x" },
        status: "calling",
      },
      {
        toolCallId: "t2",
        toolName: "search",
        args: { q: "y" },
        status: "complete",
        result: { hits: 1 },
      },
    ]);
  });

  it("clears streaming state when finish event is processed", async () => {
    const { result, rerender } = renderHook(() =>
      useStreamResponse("chat-1"),
    );

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "start", messageId: "a1" } },
          { data: { type: "text-delta", text: "done" } },
        ],
      };
      rerender();
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [{ data: { type: "finish", finishReason: "stop" } }],
      };
      rerender();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.streamingContent).toBeNull();
    expect(result.current.streamingReasoning).toBeNull();
    expect(result.current.activeToolCalls).toEqual([]);
  });

  it("stopStream clears the active stream state", async () => {
    const { result, rerender } = renderHook(() =>
      useStreamResponse("chat-1"),
    );

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "start", messageId: "a1" } },
          { data: { type: "text-delta", text: "streaming..." } },
        ],
      };
      rerender();
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.stopStream();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.streamingContent).toBeNull();
  });

  it("uploads attachments and updates the store message", async () => {
    const { result } = renderHook(() => useStreamResponse("chat-1"));
    const att = { id: "att-1", name: "f.png", type: "image" } as any;
    mockProcessAttachments.mockResolvedValue([{ ...att, key: "k" }]);

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "look", null, [att]);
    });

    expect(mockProcessAttachments).toHaveBeenCalledWith([att], "user-msg-1");
    expect(mockStoreState.updateMessageAttachments).toHaveBeenCalledWith(
      "chat-1",
      "user-msg-1",
      [{ ...att, key: "k" }],
    );
  });

  it("recovers from database and completes streaming when realtime connection errors", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { result, rerender } = renderHook(() =>
      useStreamResponse("chat-1", { onDone }),
    );

    mockGetChat.mockResolvedValue({
      id: "chat-1",
      messages: [
        {
          id: "asst-db-id",
          role: "assistant",
          content: "recovered reply",
          parentId: "user-msg-1",
          createdAt: new Date().toISOString(),
        },
      ],
      attachments: [],
    });
    mockBuildChatFromRows.mockReturnValue({
      id: "chat-1",
      messages: {
        "asst-db-id": {
          id: "asst-db-id",
          role: "assistant",
          content: "recovered reply",
          parentId: "user-msg-1",
        },
      },
    });

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    expect(result.current.isLoading).toBe(true);

    // Simulate realtime connection error
    await act(async () => {
      realtimeState.connectionStatus = "error";
      rerender();
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(mockGetChat).toHaveBeenCalledWith("chat-1");
    expect(mockBuildChatFromRows).toHaveBeenCalled();
    expect(mockStoreState.upsertChat).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith("recovered reply");
    expect(result.current.isLoading).toBe(false);

    vi.useRealTimers();
  });

  it("catches error if persistMessage fails and shows toast error", async () => {
    mockPersist.mockRejectedValueOnce(new Error("Persist error"));
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Message may not have been saved. Please check your connection.",
    );
  });

  it("handles !res.ok when handleApiError handles the error", async () => {
    mockHandleApiError.mockReturnValueOnce(true);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Rate limit" }),
    });
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("handles !res.ok when handleApiError does not handle and json rejects", async () => {
    mockHandleApiError.mockReturnValueOnce(false);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error("JSON parse error");
      },
    });
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    expect(mockToastError).toHaveBeenCalledWith("Failed to generate response");
    expect(result.current.isLoading).toBe(false);
  });

  it("handles fetch exception and shows toast error", async () => {
    mockHandleApiError.mockReturnValueOnce(false);
    global.fetch = vi.fn().mockRejectedValue(new Error("Network failed"));
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    expect(mockToastError).toHaveBeenCalledWith("Network failed");
    expect(result.current.isLoading).toBe(false);
  });

  it("handles 'error' stream event and displays toast error", async () => {
    mockHandleApiError.mockReturnValueOnce(false);
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    await act(async () => {
      realtimeState.messages.delta = [
        {
          data: {
            type: "error",
            message: "Realtime stream error occurred",
          },
        },
      ];
      rerender();
    });

    expect(mockToastError).toHaveBeenCalledWith("Realtime stream error occurred");
    expect(result.current.isLoading).toBe(false);
  });

  it("handles 'error' stream event without toast when handleApiError returns true", async () => {
    mockHandleApiError.mockReturnValueOnce(true);
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    await act(async () => {
      realtimeState.messages.delta = [
        {
          data: {
            type: "error",
            message: "Handled error",
          },
        },
      ];
      rerender();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("falls back to messages.delta when messages.all is undefined", async () => {
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    await act(async () => {
      realtimeState.messages.all = undefined as any;
      realtimeState.messages.delta = [
        {
          data: {
            type: "text-delta",
            text: "delta fallback chunk",
          },
        },
      ];
      rerender();
    });

    expect(result.current.streamingContent).toBe("delta fallback chunk");
  });

  it("watchdog times out after 10 connection error attempts and displays toast", async () => {
    vi.useFakeTimers();
    mockGetChat.mockRejectedValue(new Error("DB sync failed"));

    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    expect(result.current.isLoading).toBe(true);

    // Set connection error and re-render so effects update refs
    await act(async () => {
      realtimeState.connectionStatus = "error";
      rerender();
    });

    // Advance 15 intervals in watchdog
    await act(async () => {
      for (let i = 0; i < 15; i++) {
        await vi.advanceTimersByTimeAsync(2500);
      }
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Connection lost to generation stream. Please refresh if response is ready.",
    );
    expect(result.current.isLoading).toBe(false);

    vi.useRealTimers();
  });

  it("handles realtimeError in useRealtime", async () => {
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    await act(async () => {
      realtimeState.error = new Error("Subscription failed");
      rerender();
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("rejects token fetch when chatId is empty", async () => {
    renderHook(() => useStreamResponse(""));
    expect(realtimeState.config?.token).toBeDefined();

    await expect(realtimeState.config.token()).rejects.toThrow("No chatId");
  });

  it("resolves slash prompt from store when selectedPromptId is a local prompt", async () => {
    mockStoreState.prompts = [
      { id: "local-p1", content: "You are an assistant" },
    ] as any;

    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse(
        "user-msg-1",
        "explain this",
        null,
        [],
        "gpt-4o",
        [],
        [],
        "local-p1",
      );
    });

    expect(mockPersist).toHaveBeenCalledWith(
      "chat-1",
      expect.objectContaining({
        content: expect.stringContaining("You are an assistant"),
      }),
    );
  });

  it("watchdog interval stops when syncFromDb returns true", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    mockGetChat.mockResolvedValue({
      id: "chat-1",
      messages: [
        {
          id: "asst-1",
          role: "assistant",
          parentId: "user-msg-1",
          content: "Synced message",
          createdAt: new Date().toISOString(),
        },
      ],
      attachments: [],
    });
    mockBuildChatFromRows.mockReturnValue({
      id: "chat-1",
      messages: {
        "asst-1": { id: "asst-1", role: "assistant", content: "Synced message" },
      },
    });

    const { result } = renderHook(() =>
      useStreamResponse("chat-1", { onDone }),
    );

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    // Advance timers past stalled threshold (5000ms) with open connection
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(onDone).toHaveBeenCalledWith("Synced message");
    expect(result.current.isLoading).toBe(false);

    vi.useRealTimers();
  });

  it("returns undefined for apiBaseUrl in production environment", () => {
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      renderHook(() => useStreamResponse("chat-prod"));
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});
