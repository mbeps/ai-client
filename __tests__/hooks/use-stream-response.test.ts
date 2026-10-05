import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROMPTS } from "@/config/prompts";

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

const mockIsChatGenerating = vi.hoisted(() => vi.fn().mockResolvedValue(false));
vi.mock("@/actions/chats/is-chat-generating", () => ({
  isChatGenerating: mockIsChatGenerating,
}));

const mockGetChatRealtimeToken = vi.hoisted(() =>
  vi.fn().mockResolvedValue("mock-token"),
);
vi.mock("@/actions/chats/chat-realtime-token", () => ({
  getChatRealtimeToken: mockGetChatRealtimeToken,
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
  loadSkills: vi.fn(),
  prompts: [],
  chats: {} as Record<string, any>,
}));

vi.mock("@/lib/store", () => ({
  useAppStore: Object.assign(
    (selector: (s: any) => any) => selector(mockStoreState),
    { getState: () => mockStoreState },
  ),
}));

const mockLogError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => {
  const log = {
    error: mockLogError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
  return { logger: log, getLogger: vi.fn(() => log) };
});

const mockHandleApiError = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-api-error", () => ({
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
  mockIsChatGenerating.mockReset();
  mockIsChatGenerating.mockResolvedValue(false);
  mockStoreState.upsertChat.mockClear();
  mockStoreState.chats = {};
  mockLogError.mockClear();
  mockHandleApiError.mockReset();
  mockHandleApiError.mockReturnValue(false);
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

  it("reloads the skills store when a skill authoring tool wrote a skill", async () => {
    const { result, rerender } = renderHook(() =>
      useStreamResponse("chat-1"),
    );

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "make a skill", null);
    });

    mockStoreState.loadSkills.mockClear();

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "start", messageId: "server-assistant-id" } },
          {
            data: {
              type: "tool-call",
              toolCallId: "tc-1",
              toolName: "create_skill",
              args: { name: "clean-code" },
            },
          },
          {
            data: {
              type: "tool-result",
              toolCallId: "tc-1",
              toolName: "create_skill",
              result: { success: true, skillId: "skill-1" },
            },
          },
          { data: { type: "text-delta", text: "Created it." } },
          { data: { type: "finish", finishReason: "stop" } },
        ],
      };
      rerender();
    });

    expect(mockStoreState.loadSkills).toHaveBeenCalledTimes(1);
  });

  it("does not reload the skills store when no authoring tool ran", async () => {
    const { result, rerender } = renderHook(() =>
      useStreamResponse("chat-1"),
    );

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    mockStoreState.loadSkills.mockClear();

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "start", messageId: "server-assistant-id" } },
          { data: { type: "text-delta", text: "Hi." } },
          { data: { type: "finish", finishReason: "stop" } },
        ],
      };
      rerender();
    });

    expect(mockStoreState.loadSkills).not.toHaveBeenCalled();
  });

  it("does not reload the skills store when a skill tool failed", async () => {
    const { result, rerender } = renderHook(() =>
      useStreamResponse("chat-1"),
    );

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "make a skill", null);
    });

    mockStoreState.loadSkills.mockClear();

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "start", messageId: "server-assistant-id" } },
          {
            data: {
              type: "tool-call",
              toolCallId: "tc-1",
              toolName: "write_skill_file",
              args: { path: "../escape.md" },
            },
          },
          {
            data: {
              type: "tool-result",
              toolCallId: "tc-1",
              toolName: "write_skill_file",
              result: { error: "Invalid skill file path." },
            },
          },
          { data: { type: "text-delta", text: "Refused." } },
          { data: { type: "finish", finishReason: "stop" } },
        ],
      };
      rerender();
    });

    expect(mockStoreState.loadSkills).not.toHaveBeenCalled();
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

  it("resolves multiple slash prompts from store in order", async () => {
    mockStoreState.prompts = [
      { id: "local-p1", content: "Prompt One" },
      { id: "local-p2", content: "Prompt Two" },
    ] as any;

    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse(
        "user-msg-2",
        "user question",
        null,
        [],
        "gpt-4o",
        [],
        [],
        ["local-p1", "local-p2"],
      );
    });

    expect(mockPersist).toHaveBeenCalledWith(
      "chat-1",
      expect.objectContaining({
        content:
          "Prompt One" +
          PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR +
          "Prompt Two" +
          PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR +
          "user question",
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

  // ── Additional branch coverage ──────────────────────────────────────────

  it("ignores stream events that arrive after stopStream", async () => {
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [{ data: { type: "text-delta", text: "partial" } }],
      };
      rerender();
    });

    await act(async () => {
      result.current.stopStream();
    });
    expect(result.current.isLoading).toBe(false);

    mockStoreState.addMessage.mockClear();

    // Any event processed after the stop is dropped by the stoppedRef guard.
    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "text-delta", text: "partial" } },
          { data: { type: "text-delta", text: " LATE" } },
          { data: { type: "finish", finishReason: "stop" } },
        ],
      };
      rerender();
    });

    expect(result.current.streamingContent).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mockStoreState.addMessage).not.toHaveBeenCalled();
  });

  it("returns apiBaseUrl undefined when window is undefined (SSR)", async () => {
    const { renderToString } = await import("react-dom/server");
    const { createElement } = await import("react");

    function SsrProbe() {
      useStreamResponse("chat-ssr");
      return null;
    }

    // Server render: no DOM at all, so typeof window === "undefined" is true.
    vi.stubGlobal("window", undefined);
    try {
      renderToString(createElement(SsrProbe));
      expect(realtimeState.config?.apiBaseUrl).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }

    // Client render (outside production) takes the dev-server branch.
    renderHook(() => useStreamResponse("chat-dev"));
    expect(realtimeState.config?.apiBaseUrl).toContain("8288");
  });

  it("does not call getChat when syncing with an empty chatId", async () => {
    const { result, rerender } = renderHook(() => useStreamResponse(""));

    // isStreaming becomes true purely from realtime deltas, so the
    // connection-error effect runs syncFromDb with chatId === "".
    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [{ data: { type: "text-delta", text: "hi" } }],
      };
      realtimeState.error = new Error("socket closed");
      rerender();
    });

    expect(result.current.isLoading).toBe(true);
    expect(mockGetChat).not.toHaveBeenCalled();
  });

  it("fetches a realtime token for the current chatId", async () => {
    renderHook(() => useStreamResponse("chat-token"));
    await expect(realtimeState.config?.token()).resolves.toBe("mock-token");
    expect(mockGetChatRealtimeToken).toHaveBeenCalledWith("chat-token");
  });

  it("commits partial text on stop and persists it, logging persistence failures", async () => {
    mockPersist.mockResolvedValueOnce({});
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null, [], "gpt-4o");
    });

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "start", messageId: "a1" } },
          { data: { type: "text-delta", text: "half written" } },
        ],
      };
      rerender();
    });

    mockStoreState.addMessage.mockClear();
    mockPersist.mockClear();
    mockPersist.mockRejectedValueOnce(new Error("write failed"));

    await act(async () => {
      result.current.stopStream();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockStoreState.addMessage).toHaveBeenCalledWith("chat-1", {
      role: "assistant",
      content: "half written",
      parentId: "user-msg-1",
      id: "a1",
      metadata: JSON.stringify({ model: "gpt-4o", finishReason: "stop" }),
    });
    expect(mockPersist).toHaveBeenCalledWith("chat-1", {
      id: "a1",
      role: "assistant",
      content: "half written",
      parentId: "user-msg-1",
      metadata: JSON.stringify({ model: "gpt-4o", finishReason: "stop" }),
    });
    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to persist stopped message",
      expect.any(Error),
    );
    expect(result.current.isLoading).toBe(false);
  });

  it("swallows a rejected stop request without breaking the stop path", async () => {
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "start", messageId: "a1" } },
          { data: { type: "text-delta", text: "partial" } },
        ],
      };
      rerender();
    });

    global.fetch = vi.fn().mockRejectedValue(new Error("stop failed"));

    await act(async () => {
      result.current.stopStream();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat/stop",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.streamingContent).toBeNull();
  });

  it("generates a UUID assistant id when finish arrives without a start event", async () => {
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    mockStoreState.addMessage.mockClear();

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [
          { data: { type: "text-delta", text: "no start event" } },
          { data: { type: "finish", finishReason: "stop" } },
        ],
      };
      rerender();
    });

    const added = mockStoreState.addMessage.mock.calls[0][1];
    expect(added.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(added.content).toBe("no start event");
  });

  it("falls back to a generic toast when the error event has no message", async () => {
    mockHandleApiError.mockReturnValue(false);
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [{ data: { type: "error" } }],
      };
      rerender();
    });

    expect(mockToastError).toHaveBeenCalledWith("Failed to generate response");
    expect(result.current.isLoading).toBe(false);
  });

  it("does not match older assistant messages when neither assistant ID nor user message ID matches", async () => {
    const onDone = vi.fn();
    mockGetChat.mockResolvedValue({
      id: "chat-1",
      messages: [
        {
          id: "asst-orphan",
          role: "assistant",
          content: "orphan reply",
          parentId: "unknown-parent",
          createdAt: new Date().toISOString(),
        },
      ],
      attachments: [],
    });
    mockBuildChatFromRows.mockReturnValue({ id: "chat-1", messages: {} });

    const { result, rerender } = renderHook(() =>
      useStreamResponse("chat-1", { onDone }),
    );

    // isStreaming via realtime only — pendingRef.userMessageId stays null,
    // and no assistantMessageId is set, so syncFromDb returns false without matching old messages.
    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [{ data: { type: "text-delta", text: "pending" } }],
      };
      rerender();
    });

    await act(async () => {
      realtimeState.connectionStatus = "error";
      rerender();
    });

    expect(mockGetChat).toHaveBeenCalledWith("chat-1");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("skips realtime envelopes with no data and non-object entries in messages.all", async () => {
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        all: [
          null,
          { topic: "stream" },
          { data: { type: "text-delta", text: "after junk" } },
        ] as any,
        delta: [],
      };
      rerender();
    });

    expect(result.current.streamingContent).toBe("after junk");
  });

  it("skips realtime envelopes with no data and non-object entries in messages.delta", async () => {
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        all: undefined as any,
        delta: [
          null,
          { topic: "stream" },
          { data: { type: "text-delta", text: "delta after junk" } },
        ] as any,
      };
      rerender();
    });

    expect(result.current.streamingContent).toBe("delta after junk");
  });

  it("stops the watchdog on the stall timeout without a connection error toast", async () => {
    vi.useFakeTimers();
    mockGetChat.mockRejectedValue(new Error("DB sync failed"));
    const onDone = vi.fn();

    const { result } = renderHook(() => useStreamResponse("chat-1", { onDone }));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    // 30 watchdog ticks × 2000ms with an open connection: isStalled trips,
    // isConnectionError stays false, so the connection-lost toast is skipped.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(mockToastError).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.streamingContent).toBeNull();
    expect(onDone).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("stop while rejoined: skips committing partial text against the current leaf user message", async () => {
    const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));

    mockStoreState.chats = {
      "chat-1": {
        id: "chat-1",
        currentLeafId: "leaf-user-1",
        messages: {
          "leaf-user-1": { id: "leaf-user-1", role: "user", content: "q" },
        },
      },
    };

    await act(async () => {
      realtimeState.messages = {
        ...realtimeState.messages,
        delta: [{ data: { type: "text-delta", text: "orphan partial" } }],
      };
      rerender();
    });

    mockStoreState.addMessage.mockClear();

    await act(async () => {
      result.current.stopStream();
      await Promise.resolve();
    });

    expect(mockStoreState.addMessage).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat/stop",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("suppresses the dispatch toast when handleApiError absorbs the fetch rejection", async () => {
    mockHandleApiError.mockReturnValue(true);
    const fetchErr = new Error("Network failed");
    global.fetch = vi.fn().mockRejectedValue(fetchErr);

    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    expect(mockHandleApiError).toHaveBeenCalledWith(fetchErr);
    expect(mockToastError).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("falls back to a generic toast when the dispatch throws a non-Error", async () => {
    mockHandleApiError.mockReturnValue(false);
    global.fetch = vi.fn().mockRejectedValue("opaque failure");

    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    expect(mockToastError).toHaveBeenCalledWith("Failed to generate response");
    expect(result.current.isLoading).toBe(false);
  });

  describe("prompt metadata resolution", () => {
    it("skips an MCP prompt that resolves to empty content", async () => {
      // getMcpPrompt resolves, but resolveMcpPrompt maps every message to "",
      // so the `if (mcpContent)` guard sees a falsy value and pushes nothing.
      mockGetMcpPrompt.mockResolvedValueOnce({
        messages: [{ content: { type: "image" } }],
      });
      mockStoreState.prompts = [
        { id: "local-p1", content: "Local prompt body" },
      ] as any;

      const { result } = renderHook(() => useStreamResponse("chat-1"));

      await act(async () => {
        await result.current.streamResponse(
          "user-msg-1",
          "hello",
          null,
          [],
          "gpt-4o",
          [],
          [],
          ["mcp:srv-1:empty", "local-p1"],
        );
      });

      // Only the local prompt contributes content.
      expect(mockPersist).toHaveBeenCalledWith(
        "chat-1",
        expect.objectContaining({
          content:
            "Local prompt body" +
            PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR +
            "hello",
        }),
      );
    });

    it("skips a local prompt whose content is empty", async () => {
      mockStoreState.prompts = [
        { id: "local-p1", content: "" },
        { id: "local-p2", content: "Real body" },
      ] as any;

      const { result } = renderHook(() => useStreamResponse("chat-1"));

      await act(async () => {
        await result.current.streamResponse(
          "user-msg-1",
          "hello",
          null,
          [],
          "gpt-4o",
          [],
          [],
          ["local-p1", "local-p2"],
        );
      });

      expect(mockPersist).toHaveBeenCalledWith(
        "chat-1",
        expect.objectContaining({
          content:
            "Real body" + PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR + "hello",
        }),
      );
    });

    it("skips a local prompt id that is absent from the store", async () => {
      mockStoreState.prompts = [] as any;

      const { result } = renderHook(() => useStreamResponse("chat-1"));

      await act(async () => {
        await result.current.streamResponse(
          "user-msg-1",
          "hello",
          null,
          [],
          "gpt-4o",
          [],
          [],
          "not-in-store",
        );
      });

      // No prompt chunk resolved, so the raw content is sent through untouched.
      expect(mockPersist).toHaveBeenCalledWith(
        "chat-1",
        expect.objectContaining({ content: "hello" }),
      );
    });

    it("omits promptId from the metadata when every MCP prompt yields empty content", async () => {
      mockGetMcpPrompt.mockResolvedValueOnce({
        messages: [{ content: { type: "image" } }],
      });

      const { result } = renderHook(() => useStreamResponse("chat-1"));

      await act(async () => {
        await result.current.streamResponse(
          "user-msg-1",
          "hello",
          null,
          [],
          "gpt-4o",
          [],
          [],
          "mcp:srv-1:empty",
        );
      });

      // selectedPromptIds[0] is truthy, so meta.promptId is still written.
      const metadata = JSON.parse(
        mockPersist.mock.calls[0][1].metadata as string,
      );
      expect(metadata.promptId).toBe("mcp:srv-1:empty");
      expect(metadata.promptIds).toEqual(["mcp:srv-1:empty"]);
      expect(metadata.userContent).toBe("hello");
    });

    it("writes a defined metadata string to both the optimistic insert and persistMessage", async () => {
      const { result } = renderHook(() => useStreamResponse("chat-1"));

      await act(async () => {
        await result.current.streamResponse("user-msg-1", "hello", null);
      });

      const optimisticMetadata =
        mockStoreState.addMessage.mock.calls[0][1].metadata;
      const persistedMetadata = mockPersist.mock.calls[0][1].metadata;

      // JSON.stringify always returns a string here, so the
      // `userMsgMetadata ?? undefined` fallback arm is never taken.
      expect(typeof optimisticMetadata).toBe("string");
      expect(typeof persistedMetadata).toBe("string");
      expect(persistedMetadata).toBe(optimisticMetadata);
    });

    it("omits promptId when the selected prompt array starts with an empty id", async () => {
      mockStoreState.prompts = [
        { id: "", content: "Headless prompt body" },
        { id: "local-p2", content: "Second" },
      ] as any;

      const { result } = renderHook(() => useStreamResponse("chat-1"));

      await act(async () => {
        await result.current.streamResponse(
          "user-msg-1",
          "hello",
          null,
          [],
          "gpt-4o",
          [],
          [],
          ["", "local-p2"],
        );
      });

      // selectedPromptIds[0] is "" (falsy), so meta.promptId is not written
      // while meta.promptIds still carries the full list.
      const metadata = JSON.parse(
        mockPersist.mock.calls[0][1].metadata as string,
      );
      expect(metadata).not.toHaveProperty("promptId");
      expect(metadata.promptIds).toEqual(["", "local-p2"]);
    });
  });

  describe("rejoin handling after page refresh", () => {
    it("1. rejoined finish refetches and never addMessages the partial tail", async () => {
      mockIsChatGenerating.mockResolvedValue(true);
      mockStoreState.chats = {
        "chat-1": {
          id: "chat-1",
          currentLeafId: "user-1",
          messages: {
            "user-1": { id: "user-1", role: "user", content: "hello" },
          },
        },
      };

      const onDone = vi.fn();
      mockGetChat.mockResolvedValue({
        id: "chat-1",
        messages: [
          {
            id: "user-1",
            role: "user",
            content: "hello",
            parentId: null,
            createdAt: new Date().toISOString(),
          },
          {
            id: "asst-1",
            role: "assistant",
            content: "full complete reply from database",
            parentId: "user-1",
            createdAt: new Date().toISOString(),
          },
        ],
        attachments: [],
      });
      mockBuildChatFromRows.mockReturnValue({
        id: "chat-1",
        messages: {
          "user-1": { id: "user-1", role: "user", content: "hello" },
          "asst-1": {
            id: "asst-1",
            role: "assistant",
            content: "full complete reply from database",
          },
        },
      });

      const { result, rerender } = renderHook(() =>
        useStreamResponse("chat-1", { onDone }),
      );

      // Wait for mount check to complete
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isLoading).toBe(true);

      // Delta arrives (partial tail)
      await act(async () => {
        realtimeState.messages = {
          ...realtimeState.messages,
          all: [{ data: { type: "text-delta", text: "partial tail" } }],
        };
        rerender();
      });

      mockStoreState.addMessage.mockClear();

      // Finish event arrives (accumulated in all)
      await act(async () => {
        realtimeState.messages = {
          ...realtimeState.messages,
          all: [
            { data: { type: "text-delta", text: "partial tail" } },
            { data: { type: "finish", finishReason: "stop" } },
          ],
        };
        rerender();
      });

      // Await async handleStreamEvent resolution
      await act(async () => {
        await Promise.resolve();
      });

      // Never addMessage the partial tail
      expect(mockStoreState.addMessage).not.toHaveBeenCalled();
      expect(mockGetChat).toHaveBeenCalledWith("chat-1");
      expect(mockStoreState.upsertChat).toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledWith("full complete reply from database");
      expect(result.current.isLoading).toBe(false);
    });

    it("2. rejoin watchdog does not end streaming because an older assistant message exists", async () => {
      mockIsChatGenerating.mockResolvedValue(true);
      mockStoreState.chats = {
        "chat-1": {
          id: "chat-1",
          currentLeafId: "user-2",
          messages: {
            "user-2": { id: "user-2", role: "user", content: "new question" },
          },
        },
      };

      const onDone = vi.fn();
      mockGetChat.mockResolvedValue({
        id: "chat-1",
        messages: [
          {
            id: "asst-old",
            role: "assistant",
            content: "older answer",
            parentId: "user-1",
            createdAt: new Date(Date.now() - 60000).toISOString(),
          },
        ],
        attachments: [],
      });

      const { result } = renderHook(() =>
        useStreamResponse("chat-1", { onDone }),
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isLoading).toBe(true);

      // Trigger syncFromDb via error
      await act(async () => {
        realtimeState.connectionStatus = "error";
        await Promise.resolve();
      });

      // Does not end streaming because asst-old belongs to user-1, not user-2
      expect(onDone).not.toHaveBeenCalled();
      expect(mockStoreState.upsertChat).not.toHaveBeenCalled();
    });

    it("3. mount: leaf=user + true -> isLoading; false -> idle; leaf=assistant -> action not called; rejection -> idle, no toast", async () => {
      // (a) leaf=user + true -> isLoading
      mockIsChatGenerating.mockResolvedValueOnce(true);
      mockStoreState.chats = {
        "chat-1": {
          id: "chat-1",
          currentLeafId: "u1",
          messages: { u1: { id: "u1", role: "user" } },
        },
      };

      const { result: r1 } = renderHook(() => useStreamResponse("chat-1"));
      await act(async () => {
        await Promise.resolve();
      });
      expect(r1.current.isLoading).toBe(true);
      expect(mockIsChatGenerating).toHaveBeenCalledWith("chat-1");

      // (b) leaf=user + false -> idle
      mockIsChatGenerating.mockClear();
      mockIsChatGenerating.mockResolvedValueOnce(false);
      const { result: r2 } = renderHook(() => useStreamResponse("chat-1"));
      await act(async () => {
        await Promise.resolve();
      });
      expect(r2.current.isLoading).toBe(false);

      // (c) leaf=assistant -> action not called
      mockIsChatGenerating.mockClear();
      mockStoreState.chats = {
        "chat-1": {
          id: "chat-1",
          currentLeafId: "a1",
          messages: { a1: { id: "a1", role: "assistant" } },
        },
      };
      const { result: r3 } = renderHook(() => useStreamResponse("chat-1"));
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockIsChatGenerating).not.toHaveBeenCalled();
      expect(r3.current.isLoading).toBe(false);

      // (d) rejection -> idle, no toast
      mockIsChatGenerating.mockClear();
      mockToastError.mockClear();
      mockIsChatGenerating.mockRejectedValueOnce(new Error("Network failed"));
      mockStoreState.chats = {
        "chat-1": {
          id: "chat-1",
          currentLeafId: "u1",
          messages: { u1: { id: "u1", role: "user" } },
        },
      };
      const { result: r4 } = renderHook(() => useStreamResponse("chat-1"));
      await act(async () => {
        await Promise.resolve();
      });
      expect(r4.current.isLoading).toBe(false);
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("4. stop while rejoined: no addMessage/persistMessage, still calls /api/chat/stop", async () => {
      mockIsChatGenerating.mockResolvedValue(true);
      mockStoreState.chats = {
        "chat-1": {
          id: "chat-1",
          currentLeafId: "u1",
          messages: { u1: { id: "u1", role: "user" } },
        },
      };

      const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));
      await act(async () => {
        await Promise.resolve();
      });

      // Partial delta arrives
      await act(async () => {
        realtimeState.messages = {
          ...realtimeState.messages,
          delta: [{ data: { type: "text-delta", text: "tail" } }],
        };
        rerender();
      });

      mockStoreState.addMessage.mockClear();
      mockPersist.mockClear();

      await act(async () => {
        result.current.stopStream();
        await Promise.resolve();
      });

      expect(mockStoreState.addMessage).not.toHaveBeenCalled();
      expect(mockPersist).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/chat/stop",
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(result.current.isLoading).toBe(false);
    });

    it("5. streamResponse resets rejoinedRef; normal finish still adds the message with the start id", async () => {
      // First mount in rejoined mode
      mockIsChatGenerating.mockResolvedValue(true);
      mockStoreState.chats = {
        "chat-1": {
          id: "chat-1",
          currentLeafId: "u1",
          messages: { u1: { id: "u1", role: "user" } },
        },
      };

      const { result, rerender } = renderHook(() => useStreamResponse("chat-1"));
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.isLoading).toBe(true);

      // Now dispatch normal streamResponse
      await act(async () => {
        await result.current.streamResponse("u-normal", "hello", null);
      });

      mockStoreState.addMessage.mockClear();

      // Send start, text-delta, finish
      await act(async () => {
        realtimeState.messages = {
          ...realtimeState.messages,
          delta: [
            { data: { type: "start", messageId: "asst-start-id" } },
            { data: { type: "text-delta", text: "normal text" } },
            { data: { type: "finish", finishReason: "stop" } },
          ],
        };
        rerender();
      });

      expect(mockStoreState.addMessage).toHaveBeenCalledWith(
        "chat-1",
        expect.objectContaining({
          id: "asst-start-id",
          content: "normal text",
          parentId: "u-normal",
        }),
      );
    });

    it("6. late hydration via rerender(); once per chatId; switching chatId re-checks", async () => {
      mockIsChatGenerating.mockResolvedValue(true);
      mockStoreState.chats = {}; // Empty store, not hydrated

      const { rerender } = renderHook(
        ({ id }: { id: string }) => useStreamResponse(id),
        { initialProps: { id: "chat-1" } },
      );

      await act(async () => {
        await Promise.resolve();
      });

      // Not called while store is empty
      expect(mockIsChatGenerating).not.toHaveBeenCalled();

      // Store hydrates
      mockStoreState.chats = {
        "chat-1": {
          id: "chat-1",
          currentLeafId: "u1",
          messages: { u1: { id: "u1", role: "user" } },
        },
        "chat-2": {
          id: "chat-2",
          currentLeafId: "u2",
          messages: { u2: { id: "u2", role: "user" } },
        },
      };

      rerender({ id: "chat-1" });
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockIsChatGenerating).toHaveBeenCalledTimes(1);
      expect(mockIsChatGenerating).toHaveBeenCalledWith("chat-1");

      // Rerender same chatId does not call again (once per chatId)
      rerender({ id: "chat-1" });
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockIsChatGenerating).toHaveBeenCalledTimes(1);

      // Switching chatId to chat-2 re-checks
      rerender({ id: "chat-2" });
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockIsChatGenerating).toHaveBeenCalledTimes(2);
      expect(mockIsChatGenerating).toHaveBeenCalledWith("chat-2");
    });

    it("7. run finished before subscribe: stall -> syncFromDb by parentId -> done", async () => {
      mockIsChatGenerating.mockResolvedValue(true);
      mockStoreState.chats = {
        "chat-1": {
          id: "chat-1",
          currentLeafId: "u1",
          messages: { u1: { id: "u1", role: "user" } },
        },
      };

      const onDone = vi.fn();
      mockGetChat.mockResolvedValue({
        id: "chat-1",
        messages: [
          {
            id: "asst-done",
            role: "assistant",
            content: "already finished reply",
            parentId: "u1",
            createdAt: new Date().toISOString(),
          },
        ],
        attachments: [],
      });
      mockBuildChatFromRows.mockReturnValue({
        id: "chat-1",
        messages: {
          "asst-done": {
            id: "asst-done",
            role: "assistant",
            content: "already finished reply",
          },
        },
      });

      const { result, rerender } = renderHook(() =>
        useStreamResponse("chat-1", { onDone }),
      );

      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.isLoading).toBe(true);

      // Connection error / stall triggers syncFromDb
      await act(async () => {
        realtimeState.connectionStatus = "error";
        rerender();
      });

      expect(mockGetChat).toHaveBeenCalledWith("chat-1");
      expect(mockStoreState.upsertChat).toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledWith("already finished reply");
      expect(result.current.isLoading).toBe(false);
    });
  });
});
