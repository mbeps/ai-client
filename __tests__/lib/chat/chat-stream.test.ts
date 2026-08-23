import { describe, it, expect, vi, beforeEach } from "vitest";

const mockHandleStreamChunk = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/stream-chunk-handler", () => ({
  handleStreamChunk: mockHandleStreamChunk,
}));

const mockPersist = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/persist-response", () => ({
  persistAssistantResponse: mockPersist,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { createChatStream } from "@/lib/chat/chat-stream";

function fakeResult(chunks: unknown[], errorAt?: number) {
  return {
    fullStream: {
      async *[Symbol.asyncIterator]() {
        for (let i = 0; i < chunks.length; i++) {
          if (errorAt === i) throw new Error("boom");
          yield chunks[i];
        }
        if (errorAt === chunks.length) throw new Error("boom");
      },
    },
  } as any;
}

async function readSSE(stream: ReadableStream): Promise<string[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((block) => block.replace(/^data: /, ""));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHandleStreamChunk.mockReturnValue({
    ssePayload: new TextEncoder().encode("x"),
    stateUpdates: { fullText: "hello" },
  });
});

function baseOptions(overrides: Record<string, unknown> = {}) {
  return {
    result: fakeResult([{ type: "text-delta" }, { type: "text-delta" }]),
    chatId: "chat-1",
    userId: "user-1",
    userMessageId: null,
    resolvedModelId: "gpt-test",
    toolSourceMap: {},
    ...overrides,
  };
}

describe("createChatStream mcpCleanup + persist error handling", () => {
  it("success: mcpCleanup called exactly once; done event present", async () => {
    const mcpCleanup = vi.fn().mockResolvedValue(undefined);
    const events = await readSSE(
      createChatStream(baseOptions({ mcpCleanup })) as ReadableStream,
    );

    expect(mcpCleanup).toHaveBeenCalledTimes(1);
    const parsed = events.map((e) => JSON.parse(e));
    expect(parsed.at(-1)?.type).toBe("done");
  });

  it("stream error mid-loop: mcpCleanup still called once; error SSE emitted", async () => {
    const mcpCleanup = vi.fn().mockResolvedValue(undefined);
    const events = await readSSE(
      createChatStream(
        baseOptions({ mcpCleanup, result: fakeResult([{}], 1) }),
      ) as ReadableStream,
    );

    expect(mcpCleanup).toHaveBeenCalledTimes(1);
    const parsed = events.map((e) => JSON.parse(e));
    expect(parsed.some((e) => e.type === "error")).toBe(true);
    expect(parsed.some((e) => e.type === "done")).toBe(false);
  });

  it("persistAssistantResponse rejects: PERSIST_ERROR emitted, no done, cleanup called", async () => {
    mockPersist.mockRejectedValue(new Error("db down"));
    const mcpCleanup = vi.fn().mockResolvedValue(undefined);
    const events = await readSSE(
      createChatStream(baseOptions({ mcpCleanup })) as ReadableStream,
    );

    const parsed = events.map((e) => JSON.parse(e));
    expect(parsed.some((e) => e.code === "PERSIST_ERROR")).toBe(true);
    expect(parsed.some((e) => e.type === "done")).toBe(false);
    expect(mcpCleanup).toHaveBeenCalledTimes(1);
  });
});
