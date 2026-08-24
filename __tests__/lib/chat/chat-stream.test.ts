import { describe, it, expect, vi, beforeEach } from "vitest";

// ── mock the ai module: capture createUIMessageStream config ─────────────────
const uiStreamCaptures = vi.hoisted(() => ({
  config: null as any,
  responseInit: null as any,
}));

vi.mock("ai", () => ({
  createUIMessageStream: (config: any) => {
    uiStreamCaptures.config = config;
    return `fake-ui-stream` as any;
  },
  createUIMessageStreamResponse: (init: any) => {
    uiStreamCaptures.responseInit = init;
    return new Response("ui-stream-response") as any;
  },
}));

const mockPersist = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/persist-response", () => ({
  persistAssistantResponse: mockPersist,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { createChatStream } from "@/lib/chat/chat-stream";

function baseOptions(overrides: Record<string, unknown> = {}) {
  return {
    result: {} as any,
    chatId: "chat-1",
    userId: "user-1",
    userMessageId: "user-msg-1",
    resolvedModelId: "gpt-test",
    toolSourceMap: {},
    finishRef: { current: null } as { current: any },
    ...overrides,
  };
}

function fakeWriter() {
  return { write: vi.fn(), merge: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  uiStreamCaptures.config = null;
  uiStreamCaptures.responseInit = null;
  mockPersist.mockResolvedValue(undefined);
});

describe("createChatStream (UI message stream)", () => {
  it("returns a Response built via createUIMessageStreamResponse with the UI stream", async () => {
    const response = createChatStream(baseOptions());

    expect(uiStreamCaptures.config).toBeTruthy();
    expect(uiStreamCaptures.responseInit.stream).toBe("fake-ui-stream");
    expect(response).toBeInstanceOf(Response);
  });

  it("execute writes start chunk and merges result.toUIMessageStream()", async () => {
    const toUIMessageStream = vi.fn().mockReturnValue("inner-stream");
    const writer = fakeWriter();

    createChatStream(
      baseOptions({
        result: { toUIMessageStream } as any,
        assistantMessageId: "assistant-1",
      }),
    );
    await uiStreamCaptures.config.execute({ writer });

    expect(writer.write).toHaveBeenCalledWith(
      expect.objectContaining({ type: "start", messageId: "assistant-1" }),
    );
    expect(writer.merge).toHaveBeenCalledWith("inner-stream");
  });

  it("generates an assistantMessageId when none is provided", async () => {
    const writer = fakeWriter();
    createChatStream(
      baseOptions({ result: { toUIMessageStream: vi.fn() } as any }),
    );
    await uiStreamCaptures.config.execute({ writer });

    const startCall = writer.write.mock.calls[0][0];
    expect(startCall.messageId).toBeTruthy();
  });

  it("onFinish persists accumulated content from finishRef with metadata", async () => {
    const finishRef = {
      current: {
        text: "final answer",
        reasoning: "thinking...",
        toolCalls: [{ toolCallId: "t1", toolName: "search", args: {} }],
        toolResults: [{ toolCallId: "t1", toolName: "search", result: [] }],
        finishReason: "stop",
      },
    };

    createChatStream(baseOptions({ finishRef }));
    await uiStreamCaptures.config.onFinish({} as any);

    expect(mockPersist).toHaveBeenCalledTimes(1);
    const call = mockPersist.mock.calls[0][0];
    expect(call.chatId).toBe("chat-1");
    expect(call.content).toBe("final answer");
    expect(call.parentId).toBe("user-msg-1");
    const metadata = JSON.parse(call.metadata);
    expect(metadata.model).toBe("gpt-test");
    expect(metadata.reasoning).toBe("thinking...");
    expect(metadata.toolCalls).toHaveLength(1);
  });

  it("onFinish persists only the model in metadata when there is no reasoning or tools", async () => {
    const finishRef = {
      current: {
        text: "plain answer",
        reasoning: "",
        toolCalls: [],
        toolResults: [],
        finishReason: "stop",
      },
    };
    createChatStream(baseOptions({ finishRef }));
    await uiStreamCaptures.config.onFinish({} as any);

    expect(mockPersist).toHaveBeenCalledTimes(1);
    // Model is always persisted — the UI displays it on assistant messages.
    expect(JSON.parse(mockPersist.mock.calls[0][0].metadata)).toEqual({
      model: "gpt-test",
    });
  });

  it("onFinish skips persistence when finishRef holds no data", async () => {
    createChatStream(baseOptions());
    await uiStreamCaptures.config.onFinish({} as any);

    expect(mockPersist).not.toHaveBeenCalled();
  });

  it("onFinish swallows persist failures (best-effort)", async () => {
    mockPersist.mockRejectedValue(new Error("db down"));
    const finishRef = {
      current: {
        text: "answer",
        reasoning: "",
        toolCalls: [],
        toolResults: [],
        finishReason: "stop",
      },
    };
    createChatStream(baseOptions({ finishRef }));

    await expect(
      uiStreamCaptures.config.onFinish({} as any),
    ).resolves.toBeUndefined();
  });

  it("cleanup runs exactly once across abort + onError + onFinish", async () => {
    const mcpCleanup = vi.fn().mockResolvedValue(undefined);
    const controller = new AbortController();

    createChatStream(
      baseOptions({ mcpCleanup, abortSignal: controller.signal }),
    );

    // All three exit paths fire
    controller.abort();
    await uiStreamCaptures.config.onError(new Error("boom"));
    await uiStreamCaptures.config.onFinish({} as any);
    // Give the abort listener a tick
    await new Promise((r) => setTimeout(r, 0));

    expect(mcpCleanup).toHaveBeenCalledTimes(1);
  });

  it("onError returns a generic message for unknown errors (no raw leak)", async () => {
    createChatStream(baseOptions());
    const message = uiStreamCaptures.config.onError(new Error("secret db dsn"));

    expect(message).not.toContain("secret db dsn");
    expect(typeof message).toBe("string");
    expect(message.length).toBeGreaterThan(0);
  });
});
