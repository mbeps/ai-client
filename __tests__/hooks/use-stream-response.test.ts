import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ── mock @ai-sdk/react useChat: capture config, expose controllable state ────
const chatState = vi.hoisted(() => ({
  config: null as any,
  status: "ready" as string,
  messages: [] as any[],
  sendMessage: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: (config: any) => {
    chatState.config = config;
    return {
      messages: chatState.messages,
      status: chatState.status,
      sendMessage: chatState.sendMessage,
      stop: chatState.stop,
      error: undefined,
      setMessages: vi.fn(),
      clearError: vi.fn(),
    };
  },
}));

const mockPersist = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/chats/persist-message", () => ({
  persistMessage: mockPersist,
}));

const mockProcessAttachments = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/attachments/process-attachments", () => ({
  processAttachments: mockProcessAttachments,
}));

const mockStoreState = vi.hoisted(() => ({
  addMessage: vi.fn(),
  updateMessageAttachments: vi.fn(),
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

function textMsg(id: string, role: "user" | "assistant", text: string) {
  return { id, role, parts: [{ type: "text", text }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  chatState.status = "ready";
  chatState.messages = [];
  mockPersist.mockResolvedValue({});
  mockProcessAttachments.mockResolvedValue([]);
});

describe("useStreamResponse (useChat-backed)", () => {
  it("configures the transport to send identifier-only bodies (no messages array)", async () => {
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    // prepareSendMessagesRequest must forward ONLY the caller-supplied body
    const prepare = chatState.config.transport.prepareSendMessagesRequest;
    const prepared = await prepare({
      body: { chatId: "chat-1", userMessageId: "user-msg-1" },
    });
    expect(prepared.body).toEqual({
      chatId: "chat-1",
      userMessageId: "user-msg-1",
    });
    expect(JSON.stringify(prepared.body)).not.toContain('"messages"');
  });

  it("awaits persistMessage BEFORE triggering the API call", async () => {
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    let resolvePersist!: () => void;
    mockPersist.mockReturnValue(new Promise<void>((r) => (resolvePersist = r)));

    const p = result.current.streamResponse("user-msg-1", "hello", null);
    // Flush the synchronous part of streamResponse (reaches the persist await)
    await act(async () => {});
    expect(chatState.sendMessage).not.toHaveBeenCalled();

    await act(async () => {
      resolvePersist();
      await p;
    });

    expect(mockPersist).toHaveBeenCalledWith("chat-1", expect.anything());
    expect(chatState.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("sends chatId + userMessageId + selections in the request body", async () => {
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

    const call = chatState.sendMessage.mock.calls[0];
    const body = call[1].body;
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

  it("onFinish syncs the assistant message into the store with the server-assigned id", async () => {
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", "parent-1");
    });

    const finish = chatState.config.onFinish;
    await act(async () => {
      await finish({
        message: {
          id: "server-assistant-id",
          role: "assistant",
          parts: [
            { type: "reasoning", text: "thinking" },
            { type: "text", text: "answer" },
          ],
        },
        isAbort: false,
        isError: false,
        isDisconnect: false,
        messages: [],
      });
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

  it("onFinish syncs completed tool calls and results as raw objects in metadata", async () => {
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse(
        "user-msg-1",
        "generate artifact",
        null,
      );
    });

    mockStoreState.addMessage.mockClear();

    await act(async () => {
      await chatState.config.onFinish({
        message: {
          id: "server-assistant-id",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "manage_artifact",
              toolCallId: "tc-1",
              state: "output-available",
              input: { type: "spreadsheet", title: "Test" },
              output: {
                success: true,
                artifact: { id: "art-1", type: "spreadsheet" },
              },
            },
            { type: "text", text: "I made the spreadsheet." },
          ],
        },
        isAbort: false,
        isError: false,
        isDisconnect: false,
        messages: [],
      });
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

  it("onFinish skips syncing when the assistant produced no content", async () => {
    const { result } = renderHook(() => useStreamResponse("chat-1"));

    await act(async () => {
      await result.current.streamResponse("user-msg-1", "hello", null);
    });

    mockStoreState.addMessage.mockClear();
    await act(async () => {
      await chatState.config.onFinish({
        message: { id: "a1", role: "assistant", parts: [] },
        isAbort: false,
        isError: false,
        isDisconnect: false,
        messages: [],
      });
    });

    expect(mockStoreState.addMessage).not.toHaveBeenCalled();
  });

  it("derives streaming state from useChat while status is not ready", () => {
    chatState.status = "streaming";
    chatState.messages = [
      textMsg("u1", "user", "hi"),
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "hmm" },
          { type: "text", text: "partial ans" },
          {
            type: "dynamic-tool",
            toolName: "search",
            toolCallId: "t1",
            state: "input-available",
            input: { q: "x" },
          },
          {
            type: "dynamic-tool",
            toolName: "search",
            toolCallId: "t2",
            state: "output-available",
            input: { q: "y" },
            output: { hits: 1 },
          },
        ],
      },
    ];

    const { result } = renderHook(() => useStreamResponse("chat-1"));

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

  it("clears streaming state when status returns to ready", () => {
    chatState.status = "ready";
    chatState.messages = [textMsg("a1", "assistant", "done")];

    const { result } = renderHook(() => useStreamResponse("chat-1"));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.streamingContent).toBeNull();
    expect(result.current.streamingReasoning).toBeNull();
    expect(result.current.activeToolCalls).toEqual([]);
  });

  it("stopStream aborts the active chat request", () => {
    const { result } = renderHook(() => useStreamResponse("chat-1"));
    result.current.stopStream();
    expect(chatState.stop).toHaveBeenCalledTimes(1);
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
});
