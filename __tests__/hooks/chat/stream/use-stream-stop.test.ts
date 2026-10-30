import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeStopStream } from "@/hooks/chat/stream/use-stream-stop";
import { useAppStore } from "@/lib/store/use-app-store";

const mockPersistMessage = vi.hoisted(() => vi.fn());
vi.mock("@/actions/chats/persist-message", () => ({
  persistMessage: mockPersistMessage,
}));

const mockClearInflightState = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/chat/stream/use-stream-inflight-state", () => ({
  clearInflightState: mockClearInflightState,
}));

const mockLogError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => {
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLogError,
    debug: vi.fn(),
  };
  return {
    getLogger: vi.fn(() => log),
    logger: log,
  };
});

describe("executeStopStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistMessage.mockResolvedValue({ id: "asst-1" });
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    useAppStore.setState({
      chats: {
        "chat-1": {
          id: "chat-1",
          currentLeafId: "u1",
          messages: {
            u1: { id: "u1", role: "user" },
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createRefs(overrides?: Partial<any>) {
    return {
      stoppedRef: { current: false },
      accumulatedTextRef: { current: "" },
      accumulatedReasoningRef: { current: "" },
      activeToolCallsRef: { current: [] as any[] },
      assistantMessageIdRef: { current: null as string | null },
      pendingRef: { current: { userMessageId: "u1", model: "claude-3-5" } },
      rejoinedRef: { current: false },
      lastChunkTimeRef: { current: Date.now() },
      ...overrides,
    };
  }

  it("builds stopMetadata with reasoning and tool calls and awaits /api/chat/stop before persistMessage", async () => {
    const callOrder: string[] = [];
    global.fetch = vi.fn(async () => {
      callOrder.push("fetch-stop");
      return { ok: true } as Response;
    });
    mockPersistMessage.mockImplementation(async () => {
      callOrder.push("persist-message");
      return { id: "asst-msg-1" };
    });

    const addMessage = vi.fn();
    const resetStreamingState = vi.fn();
    const refs = createRefs({
      accumulatedTextRef: { current: "partial answer" },
      accumulatedReasoningRef: { current: "thought process" },
      activeToolCallsRef: {
        current: [
          {
            toolCallId: "tc-1",
            toolName: "calculator",
            args: { x: 1 },
            result: 2,
            status: "complete",
          },
          {
            toolCallId: "tc-2",
            toolName: "pending_tool",
            args: {},
            status: "calling",
          },
        ],
      },
      assistantMessageIdRef: { current: "asst-msg-1" },
    });

    await executeStopStream("chat-1", addMessage, resetStreamingState, refs as any);

    expect(refs.stoppedRef.current).toBe(true);
    expect(mockClearInflightState).toHaveBeenCalledWith("chat-1");
    expect(resetStreamingState).toHaveBeenCalled();
    expect(callOrder).toEqual(["fetch-stop", "persist-message"]);

    expect(addMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.objectContaining({
        id: "asst-msg-1",
        role: "assistant",
        content: "partial answer",
        parentId: "u1",
        reasoning: "thought process",
        metadata: expect.stringContaining('"stopped":true'),
      }),
    );

    const parsedMetadata = JSON.parse(addMessage.mock.calls[0][1].metadata);
    expect(parsedMetadata).toMatchObject({
      model: "claude-3-5",
      reasoning: "thought process",
      finishReason: "stop",
      stopped: true,
      toolCalls: [
        { toolCallId: "tc-1", toolName: "calculator", args: { x: 1 } },
        { toolCallId: "tc-2", toolName: "pending_tool", args: {} },
      ],
      toolResults: [
        { toolCallId: "tc-1", toolName: "calculator", result: 2 },
        {
          toolCallId: "tc-2",
          toolName: "pending_tool",
          result: { error: "Tool execution was interrupted" },
        },
      ],
    });

    expect(mockPersistMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.objectContaining({
        id: "asst-msg-1",
        metadata: expect.stringContaining('"stopped":true'),
      }),
    );
  });

  it("persists stopped message even when rejoinedRef is true if partial content exists", async () => {
    const addMessage = vi.fn();
    const resetStreamingState = vi.fn();
    const refs = createRefs({
      rejoinedRef: { current: true },
      accumulatedTextRef: { current: "rejoined partial text" },
      assistantMessageIdRef: { current: "rejoin-asst" },
    });

    await executeStopStream("chat-1", addMessage, resetStreamingState, refs as any);

    expect(addMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.objectContaining({
        content: "rejoined partial text",
        id: "rejoin-asst",
        parentId: "u1",
      }),
    );
    expect(mockPersistMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.objectContaining({
        content: "rejoined partial text",
        id: "rejoin-asst",
      }),
    );
  });

  it("skips persistence when there is no text, reasoning, or tool calls", async () => {
    const addMessage = vi.fn();
    const resetStreamingState = vi.fn();
    const refs = createRefs({
      accumulatedTextRef: { current: "" },
      accumulatedReasoningRef: { current: "" },
      activeToolCallsRef: { current: [] },
    });

    await executeStopStream("chat-1", addMessage, resetStreamingState, refs as any);

    expect(global.fetch).toHaveBeenCalledWith("/api/chat/stop", expect.anything());
    expect(addMessage).not.toHaveBeenCalled();
    expect(mockPersistMessage).not.toHaveBeenCalled();
  });

  it("resolves user message id from assistant parentId when currentLeafId is an assistant message", async () => {
    useAppStore.setState({
      chats: {
        "chat-2": {
          id: "chat-2",
          currentLeafId: "a1",
          messages: {
            u0: { id: "u0", role: "user" },
            a1: { id: "a1", role: "assistant", parentId: "u0" },
          },
        },
      },
    });

    const addMessage = vi.fn();
    const resetStreamingState = vi.fn();
    const refs = createRefs({
      accumulatedTextRef: { current: "partial answer" },
      pendingRef: { current: { userMessageId: null, model: "gpt-4o" } },
    });

    await executeStopStream("chat-2", addMessage, resetStreamingState, refs as any);

    expect(addMessage).toHaveBeenCalledWith(
      "chat-2",
      expect.objectContaining({ parentId: "u0" }),
    );
  });

  it("handles null leaf or unknown role gracefully when pending userMessageId is null", async () => {
    useAppStore.setState({
      chats: {
        "chat-3": {
          id: "chat-3",
          currentLeafId: "system-1",
          messages: {
            "system-1": { id: "system-1", role: "system" },
          },
        },
      },
    });

    const addMessage = vi.fn();
    const resetStreamingState = vi.fn();
    const refs = createRefs({
      accumulatedTextRef: { current: "partial answer" },
      pendingRef: { current: { userMessageId: null, model: "gpt-4o" } },
    });

    await executeStopStream("chat-3", addMessage, resetStreamingState, refs as any);

    // Cannot resolve user message id, skips persistence
    expect(addMessage).not.toHaveBeenCalled();
    expect(mockPersistMessage).not.toHaveBeenCalled();
  });

  it("logs errors when fetch /api/chat/stop fails or persistMessage fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));
    mockPersistMessage.mockRejectedValue(new Error("db error"));

    const addMessage = vi.fn();
    const resetStreamingState = vi.fn();
    const refs = createRefs({
      accumulatedTextRef: { current: "partial" },
    });

    await executeStopStream("chat-1", addMessage, resetStreamingState, refs as any);

    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to abort chat stream on server",
      expect.any(Error),
    );
    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to persist stopped message",
      expect.any(Error),
    );
  });

  it("handles stop with only an in-flight tool call (status: calling) and preserves serverName", async () => {
    const addMessage = vi.fn();
    const resetStreamingState = vi.fn();
    const refs = createRefs({
      accumulatedTextRef: { current: "" },
      accumulatedReasoningRef: { current: "" },
      activeToolCallsRef: {
        current: [
          {
            toolCallId: "tc-calling-1",
            toolName: "mcp_weather",
            args: { city: "London" },
            status: "calling",
            serverName: "weather-server",
          },
        ],
      },
      assistantMessageIdRef: { current: "asst-tool-only" },
    });

    await executeStopStream("chat-1", addMessage, resetStreamingState, refs as any);

    expect(addMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.objectContaining({
        id: "asst-tool-only",
        content: "",
        parentId: "u1",
      }),
    );

    const parsed = JSON.parse(addMessage.mock.calls[0][1].metadata);
    expect(parsed.toolCalls).toEqual([
      {
        toolCallId: "tc-calling-1",
        toolName: "mcp_weather",
        args: { city: "London" },
        serverName: "weather-server",
      },
    ]);
    expect(parsed.toolResults).toEqual([
      {
        toolCallId: "tc-calling-1",
        toolName: "mcp_weather",
        result: { error: "Tool execution was interrupted" },
        serverName: "weather-server",
      },
    ]);
  });

  it("resolves model from chat when stopping a rejoined stream with empty pendingRef model", async () => {
    useAppStore.setState({
      chats: {
        "chat-rejoined": {
          id: "chat-rejoined",
          currentLeafId: "u1",
          messages: {
            u0: {
              id: "u0",
              role: "assistant",
              metadata: JSON.stringify({ model: "anthropic/claude-3-7-sonnet" }),
            },
            u1: { id: "u1", role: "user" },
          },
        },
      },
    });

    const addMessage = vi.fn();
    const resetStreamingState = vi.fn();
    const refs = createRefs({
      rejoinedRef: { current: true },
      pendingRef: { current: { userMessageId: "u1", model: "" } },
      accumulatedTextRef: { current: "rejoined response" },
      assistantMessageIdRef: { current: "asst-rejoined-1" },
    });

    await executeStopStream(
      "chat-rejoined",
      addMessage,
      resetStreamingState,
      refs as any,
    );

    const parsed = JSON.parse(addMessage.mock.calls[0][1].metadata);
    expect(parsed.model).toBe("anthropic/claude-3-7-sonnet");
  });
});

