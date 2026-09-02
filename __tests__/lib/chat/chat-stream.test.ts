import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mock the ai module: capture createUIMessageStream config ─────────────────
const uiStreamCaptures = vi.hoisted(() => ({
  config: null as any,
  responseInit: null as any,
}));

const toUIMessageStreamMock = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({
  createUIMessageStream: (config: any) => {
    uiStreamCaptures.config = config;
    return `fake-ui-stream` as any;
  },
  createUIMessageStreamResponse: (init: any) => {
    uiStreamCaptures.responseInit = init;
    return new Response("ui-stream-response") as any;
  },
  toUIMessageStream: toUIMessageStreamMock,
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

  it("execute writes start chunk and merges the SDK toUIMessageStream()", async () => {
    const stream = { symbol: "fixture-stream" };
    toUIMessageStreamMock.mockReturnValue("inner-stream");
    const writer = fakeWriter();

    createChatStream(
      baseOptions({
        result: { stream } as any,
        assistantMessageId: "assistant-1",
      }),
    );
    await uiStreamCaptures.config.execute({ writer });

    expect(writer.write).toHaveBeenCalledWith(
      expect.objectContaining({ type: "start", messageId: "assistant-1" }),
    );
    expect(toUIMessageStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({ stream, sendStart: false }),
    );
    expect(writer.merge).toHaveBeenCalledWith("inner-stream");
  });

  it("generates an assistantMessageId when none is provided", async () => {
    const writer = fakeWriter();
    createChatStream(baseOptions({ result: { stream: {} } as any }));
    await uiStreamCaptures.config.execute({ writer });

    const startCall = writer.write.mock.calls[0][0];
    expect(startCall.messageId).toBeTruthy();
  });

  it("onEnd persists accumulated content from finishRef with metadata", async () => {
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
    await uiStreamCaptures.config.onEnd({} as any);

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

  it("onEnd normalizes AI SDK v7 input and output properties into args and result", async () => {
    const finishRef = {
      current: {
        text: "artifact ready",
        reasoning: "",
        toolCalls: [
          {
            toolCallId: "t1",
            toolName: "manage_artifact",
            input: { type: "spreadsheet" },
          },
        ],
        toolResults: [
          {
            toolCallId: "t1",
            toolName: "manage_artifact",
            output: { success: true },
          },
        ],
        finishReason: "stop",
      },
    };

    createChatStream(baseOptions({ finishRef }));
    await uiStreamCaptures.config.onEnd({} as any);

    expect(mockPersist).toHaveBeenCalledTimes(1);
    const call = mockPersist.mock.calls[0][0];
    const metadata = JSON.parse(call.metadata);
    expect(metadata.toolCalls).toEqual([
      {
        toolCallId: "t1",
        toolName: "manage_artifact",
        args: { type: "spreadsheet" },
      },
    ]);
    expect(metadata.toolResults).toEqual([
      {
        toolCallId: "t1",
        toolName: "manage_artifact",
        result: { success: true },
      },
    ]);
  });

  it("onEnd persists only the model in metadata when there is no reasoning or tools", async () => {
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
    await uiStreamCaptures.config.onEnd({} as any);

    expect(mockPersist).toHaveBeenCalledTimes(1);
    // Model, finishReason, and durationMs are persisted
    expect(JSON.parse(mockPersist.mock.calls[0][0].metadata)).toEqual(
      expect.objectContaining({
        model: "gpt-test",
        finishReason: "stop",
        durationMs: expect.any(Number),
      }),
    );
  });

  it("onEnd persists token usage when available in finishRef", async () => {
    const finishRef = {
      current: {
        text: "answer with usage",
        reasoning: "",
        toolCalls: [],
        toolResults: [],
        finishReason: "stop",
        usage: {
          promptTokens: 120,
          completionTokens: 45,
          totalTokens: 165,
        },
      },
    };
    createChatStream(baseOptions({ finishRef }));
    await uiStreamCaptures.config.onEnd({} as any);

    expect(mockPersist).toHaveBeenCalledTimes(1);
    const metadata = JSON.parse(mockPersist.mock.calls[0][0].metadata);
    expect(metadata.usage).toEqual({
      promptTokens: 120,
      completionTokens: 45,
      totalTokens: 165,
    });
    expect(metadata.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("onEnd skips persistence when finishRef holds no data", async () => {
    createChatStream(baseOptions());
    await uiStreamCaptures.config.onEnd({} as any);

    expect(mockPersist).not.toHaveBeenCalled();
  });

  it("onEnd swallows persist failures (best-effort)", async () => {
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
      uiStreamCaptures.config.onEnd({} as any),
    ).resolves.toBeUndefined();
  });

  it("cleanup runs exactly once across abort + onError + onEnd", async () => {
    const mcpCleanup = vi.fn().mockResolvedValue(undefined);
    const controller = new AbortController();

    createChatStream(
      baseOptions({ mcpCleanup, abortSignal: controller.signal }),
    );

    // All three exit paths fire
    controller.abort();
    await uiStreamCaptures.config.onError(new Error("boom"));
    await uiStreamCaptures.config.onEnd({} as any);
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
