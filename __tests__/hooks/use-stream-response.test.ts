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
        realtimeState.messages.all.length > 0
          ? realtimeState.messages.all
          : [...realtimeState.messages.delta],
    };
    return {
      messages: realtimeState.messages,
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

vi.mock("@/hooks/use-api-error", () => ({
  useApiError: () => ({ handleApiError: vi.fn().mockReturnValue(false) }),
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
});
