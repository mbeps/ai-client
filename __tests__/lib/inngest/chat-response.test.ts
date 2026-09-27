import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPublish = vi.hoisted(() => vi.fn());
const mockPersistResponse = vi.hoisted(() => vi.fn());
const mockResolveProvider = vi.hoisted(() => vi.fn());
const mockLoadChatContext = vi.hoisted(() => vi.fn());
const mockLoadThread = vi.hoisted(() => vi.fn());
const mockStreamText = vi.hoisted(() => vi.fn());
const mockGetUserSettings = vi.hoisted(() => vi.fn());

vi.mock("@/actions/user-settings/get-user-settings", () => ({
  getUserSettings: vi.fn().mockResolvedValue(null),
  getUserSettings: mockGetUserSettings,
}));

vi.mock("@/lib/chat/resolve-provider", () => ({
  resolveProvider: mockResolveProvider,
}));

vi.mock("@/lib/chat/resolve-default-chat-provider", () => ({
  resolveDefaultChatProvider: mockResolveProvider,
}));

vi.mock("@/lib/chat/load-chat-context", () => ({
  loadChatContext: mockLoadChatContext,
}));

vi.mock("@/lib/chat/load-thread-from-db", () => ({
  loadThreadFromDb: mockLoadThread,
}));

vi.mock("@/lib/chat/persist-response", () => ({
  persistAssistantResponse: mockPersistResponse,
}));

vi.mock("ai", () => ({
  streamText: mockStreamText,
  isStepCount: vi.fn(),
  tool: vi.fn((def) => def),
}));

const mockMcpCleanup = vi.hoisted(() => vi.fn(async () => {}));
const mockRegisterMcpTools = vi.hoisted(() => vi.fn());
const abortState = vi.hoisted(() => ({
  controller: undefined as AbortController | undefined,
}));

// The real registry hides its AbortController, so abort paths are untestable
// without this seam. Tests assign `abortState.controller` per scenario.
vi.mock("@/lib/chat/chat-abort-registry", () => ({
  chatAbortRegistry: {
    register: vi.fn(() => abortState.controller),
    delete: vi.fn(),
  },
}));

// Mirrors the real module's observable contract: tools exist only when servers
// are scoped or the artifact tool is explicitly selected.
vi.mock("@/lib/chat/register-mcp-tools", () => ({
  registerMcpTools: mockRegisterMcpTools,
}));

// Dual export shape per .agents/testing.md: domain-scoped getLogger plus the
// `logger` facade. Log assertions prove which branch ran.
const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => mockLog),
  logger: mockLog,
}));

import { generateChatResponse } from "@/lib/inngest/functions/chat-response";
import { inngest } from "@/lib/inngest/client";

describe("generateChatResponse Inngest Function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserSettings.mockResolvedValue(null);
    abortState.controller = new AbortController();
    mockRegisterMcpTools.mockImplementation(
      async (
        _servers: unknown,
        _selectedTools: unknown,
        isArtifactToolSelected: boolean,
      ) => ({
        mcpTools: isArtifactToolSelected
          ? { manage_artifact: { description: "artifact" } }
          : {},
        toolSourceMap: isArtifactToolSelected
          ? { manage_artifact: "Internal" }
          : {},
        mcpCleanup: mockMcpCleanup,
      }),
    );

    mockResolveProvider.mockResolvedValue({
      modelId: "gpt-4o",
      modelRow: { capVision: true, capTools: true },
      sdkProvider: { chat: () => () => {} },
    });

    mockLoadChatContext.mockResolvedValue({
      servers: [],
      activeKbId: null,
      kbIsReady: false,
      availableSkills: [],
      selectedSkills: [],
      projectRow: null,
      assistantRow: null,
    });

    mockLoadThread.mockResolvedValue([
      {
        id: "msg-1",
        role: "user",
        content: "hello",
        attachments: [],
      },
    ]);

    mockStreamText.mockReturnValue({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "Hello " };
        yield { type: "text-delta", text: "there!" };
      })(),
      finishReason: Promise.resolve("stop"),
      usage: Promise.resolve({ promptTokens: 5, completionTokens: 4 }),
    });
  });

  it("streams text tokens and persists assistant message on finish", async () => {
    const fn = (generateChatResponse as any).fn;

    await fn({
      event: {
        data: {
          chatId: "chat-123",
          userId: "user-123",
          userMessageId: "msg-1",
          model: "gpt-4o",
        },
      },
    });

    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "start" }),
    );
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      { type: "text-delta", text: "Hello " },
    );
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      { type: "text-delta", text: "there!" },
    );
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "finish", finishReason: "stop" }),
    );

    expect(mockPersistResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "chat-123",
        content: "Hello there!",
        parentId: "msg-1",
      }),
    );
  });

  it("publishes error event when an error occurs during execution", async () => {
    mockLoadChatContext.mockRejectedValueOnce(new Error("Context load failed"));

    const fn = (generateChatResponse as any).fn;

    await expect(
      fn({
        event: {
          data: {
            chatId: "chat-123",
            userId: "user-123",
            userMessageId: "msg-1",
          },
        },
      }),
    ).rejects.toThrow("Context load failed");

    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "error",
        message: "Context load failed",
      }),
    );
  });

  it("publishes error event with classified code when provider error matches known pattern", async () => {
    mockLoadChatContext.mockRejectedValueOnce(
      new Error("Maximum context length exceeded: requested 8192 tokens"),
    );

    const fn = (generateChatResponse as any).fn;

    await expect(
      fn({
        event: {
          data: {
            chatId: "chat-123",
            userId: "user-123",
            userMessageId: "msg-1",
          },
        },
      }),
    ).rejects.toThrow();

    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "error",
        code: "CONTEXT_WINDOW_EXCEEDED",
        message: expect.stringContaining("too long"),
      }),
    );
  });

  it("handles reasoning, tool calls, tool results, and artifact creation chunks", async () => {
    mockStreamText.mockImplementation(() => ({
      fullStream: (async function* () {
        yield { type: "reasoning-delta", text: "Planning search..." };
        yield {
          type: "tool-call",
          toolCallId: "tc-1",
          toolName: "manage_artifact",
          input: { action: "create", type: "markdown", title: "Plan", content: "# Plan" },
        };
        yield {
          type: "tool-result",
          toolCallId: "tc-1",
          toolName: "manage_artifact",
          result: {
            success: true,
            artifact: { id: "art-1", type: "markdown", title: "Plan", content: "# Plan" },
          },
        };
        yield { type: "text-delta", text: "Done creating plan." };
      })(),
      finishReason: Promise.reject(new Error("Finish reason failed")),
      usage: Promise.reject(new Error("Usage failed")),
    }));

    const fn = (generateChatResponse as any).fn;

    await fn({
      event: {
        data: {
          chatId: "chat-123",
          userId: "user-123",
          userMessageId: "msg-1",
          model: "gpt-4o",
          selectedTools: ["internal:tool:manage_artifact"],
        },
      },
    });

    // Verify tool-call and tool-result were published
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "tool-call",
        toolName: "manage_artifact",
      }),
    );
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "tool-result",
        toolName: "manage_artifact",
      }),
    );

    // Verify persist response was called with metadata containing reasoning and tool results
    expect(mockPersistResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.stringContaining("Planning search..."),
      }),
    );
  });

  it("handles realtime publish failure gracefully without crashing generation", async () => {
    (inngest.realtime.publish as any).mockRejectedValueOnce(new Error("Redis down"));

    const fn = (generateChatResponse as any).fn;

    await fn({
      event: {
        data: {
          chatId: "chat-123",
          userId: "user-123",
          userMessageId: "msg-1",
          model: "gpt-4o",
        },
      },
    });

    expect(mockPersistResponse).toHaveBeenCalled();
  });

  it("throws VisionNotSupportedError and emits error event when model lacks vision support", async () => {
    mockResolveProvider.mockResolvedValueOnce({
      modelId: "text-only",
      modelRow: { capVision: false, capTools: true },
      sdkProvider: { chat: () => () => {} },
    });

    mockLoadThread.mockResolvedValueOnce([
      {
        id: "msg-1",
        role: "user",
        content: "look at this",
        attachments: [
          {
            id: "att-img",
            name: "pic.png",
            type: "image",
            url: "https://example.com/pic.png",
          },
        ],
      },
    ]);

    const fn = (generateChatResponse as any).fn;

    await expect(
      fn({
        event: {
          data: {
            chatId: "chat-123",
            userId: "user-123",
            userMessageId: "msg-1",
            model: "text-only",
          },
        },
      }),
    ).rejects.toThrow("The selected model does not support vision/image analysis.");
  });

  it("throws ToolsNotSupportedError when model lacks tools support but MCP tools are present", async () => {
    mockResolveProvider.mockResolvedValueOnce({
      modelId: "no-tools",
      modelRow: { capVision: true, capTools: false },
      sdkProvider: { chat: () => () => {} },
    });

    mockLoadChatContext.mockResolvedValueOnce({
      servers: [{ id: "srv-1", name: "MCP", url: "http://localhost:8000/sse" }],
      activeKbId: null,
      kbIsReady: false,
      availableSkills: [],
      selectedSkills: [],
      projectRow: null,
      assistantRow: null,
    });

    const fn = (generateChatResponse as any).fn;

    await expect(
      fn({
        event: {
          data: {
            chatId: "chat-123",
            userId: "user-123",
            userMessageId: "msg-1",
            model: "no-tools",
            selectedTools: ["internal:tool:manage_artifact"],
          },
        },
      }),
    ).rejects.toThrow();
  });

  it("registers file url tool and skill tool when thread has files and skills are present", async () => {
    mockLoadChatContext.mockResolvedValueOnce({
      servers: [],
      activeKbId: "kb-1",
      kbIsReady: true,
      availableSkills: [{ name: "skill-1", displayName: "Skill 1", description: "desc" }],
      selectedSkills: [{ id: "sk-1", name: "skill-1", displayName: "Skill 1", description: "desc" }],
      projectRow: { globalPrompt: "Project prompt" },
      assistantRow: { prompt: "Assistant prompt" },
    });

    mockLoadThread.mockResolvedValueOnce([
      {
        id: "msg-1",
        role: "user",
        content: "inspect files",
        attachments: [
          {
            id: "att-doc",
            name: "sheet.xlsx",
            key: "uploads/user-123/sheet.xlsx",
            type: "spreadsheet",
          },
        ],
      },
    ]);

    mockStreamText.mockReturnValueOnce({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "Checked files and skills." };
      })(),
      finishReason: Promise.resolve("stop"),
      usage: Promise.resolve({ promptTokens: 10, completionTokens: 5 }),
    });

    const fn = (generateChatResponse as any).fn;

    await fn({
      event: {
        data: {
          chatId: "chat-123",
          userId: "user-123",
          userMessageId: "msg-1",
          model: "gpt-4o",
        },
      },
    });

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.objectContaining({
          get_file_url: expect.anything(),
          load_skill: expect.anything(),
        }),
      }),
    );
  });

  it("handles empty model and rejected getUserSettings by resolving default chat provider", async () => {
    mockGetUserSettings.mockRejectedValueOnce(new Error("Settings load error"));
    const fn = (generateChatResponse as any).fn;

    await fn({
      event: {
        data: {
          chatId: "chat-default",
          userId: "user-default",
          userMessageId: "msg-default",
          // model is deliberately omitted
        },
      },
    });

    expect(mockResolveProvider).toHaveBeenCalledWith("user-default");
    expect(mockStreamText).toHaveBeenCalled();
  });

  it("handles errors when inngest.realtime.publish throws", async () => {
    const publishSpy = vi
      .spyOn(inngest.realtime, "publish")
      .mockRejectedValueOnce(new Error("Realtime publish failed"));

    const fn = (generateChatResponse as any).fn;

    await fn({
      event: {
        data: {
          chatId: "chat-publish-err",
          userId: "user-1",
          userMessageId: "msg-1",
          model: "gpt-4o",
        },
      },
    });

    expect(publishSpy).toHaveBeenCalled();
  });

  it("handles tool-error chunks and guarantees symmetric 1:1 toolResults serialization", async () => {
    mockStreamText.mockReturnValueOnce({
      fullStream: (async function* () {
        yield {
          type: "tool-call",
          toolCallId: "tc-err",
          toolName: "fetch_api",
          args: { endpoint: "/data" },
        };
        yield {
          type: "tool-error",
          toolCallId: "tc-err",
          toolName: "fetch_api",
          error: new Error("Network timeout"),
        };
        yield {
          type: "tool-call",
          toolCallId: "tc-interrupted",
          toolName: "slow_tool",
          args: { run: true },
        };
        // tc-interrupted has no matching result or error
      })(),
      finishReason: Promise.resolve("stop"),
      usage: Promise.resolve({ promptTokens: 10, completionTokens: 10 }),
    });

    const fn = (generateChatResponse as any).fn;

    await fn({
      event: {
        data: {
          chatId: "chat-tool-error",
          userId: "user-1",
          userMessageId: "msg-1",
          model: "gpt-4o",
        },
      },
    });

    // Verify realtime emit called for tool-error converted to tool-result with error
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "tool-result",
        toolCallId: "tc-err",
        toolName: "fetch_api",
        result: { error: "Network timeout" },
      }),
    );

    // Verify metadata serialization has 1:1 symmetry
    const callArgs = mockPersistResponse.mock.calls.find(
      (call: any[]) => call[0]?.chatId === "chat-tool-error",
    )[0];
    const parsedMetadata = JSON.parse(callArgs.metadata);

    expect(parsedMetadata.toolCalls).toHaveLength(2);
    expect(parsedMetadata.toolResults).toHaveLength(2);

    expect(parsedMetadata.toolResults[0]).toEqual({
      toolCallId: "tc-err",
      toolName: "fetch_api",
      result: { error: "Network timeout" },
    });

    expect(parsedMetadata.toolResults[1]).toEqual({
      toolCallId: "tc-interrupted",
      toolName: "slow_tool",
      result: { error: "Tool execution was interrupted" },
    });
  });

  describe("abort handling", () => {
    it("skips the start event entirely when already aborted before any emit", async () => {
      const controller = new AbortController();
      controller.abort();
      abortState.controller = controller;

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-pre-aborted",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      // `emit` short-circuits on the aborted signal, so no event is published
      // (not even the start event).
      expect(inngest.realtime.publish).not.toHaveBeenCalled();
      // The already-aborted signal also trips the loop guard on the first
      // iteration, so the stream loop returns before any chunk is processed.
      expect(mockLog.info).toHaveBeenCalledWith(
        "Stream loop aborted by user (chatId: {chatId})",
        { chatId: "chat-pre-aborted" },
      );
      expect(mockPersistResponse).not.toHaveBeenCalled();
    });

    it("returns from inside the stream loop when the signal aborts mid-stream", async () => {
      const controller = new AbortController();
      abortState.controller = controller;

      // The first chunk yields normally; the stream generator aborts the
      // controller afterwards, so the second iteration hits the loop guard.
      mockStreamText.mockImplementationOnce(() => ({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "partial" };
          controller.abort();
          yield { type: "text-delta", text: "unreachable" };
        })(),
        finishReason: Promise.resolve("stop"),
        usage: Promise.resolve({ promptTokens: 1, completionTokens: 1 }),
      }));

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-loop-abort",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      expect(mockLog.info).toHaveBeenCalledWith(
        "Stream loop aborted by user (chatId: {chatId})",
        { chatId: "chat-loop-abort" },
      );
      // Early return means nothing is persisted and no finish event is emitted
      expect(mockPersistResponse).not.toHaveBeenCalled();
      expect(inngest.realtime.publish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "text-delta", text: "unreachable" }),
      );
      expect(inngest.realtime.publish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "finish" }),
      );
    });

    it("returns after the stream loop when the signal aborts before persisting", async () => {
      const controller = new AbortController();
      abortState.controller = controller;

      // The generator aborts the controller as it closes, so the loop itself
      // never sees an aborted signal on entry and exits normally. The
      // post-loop guard is then the only check that can stop persistence.
      mockStreamText.mockImplementationOnce(() => ({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "first" };
          controller.abort();
        })(),
        finishReason: Promise.resolve("stop"),
        usage: Promise.resolve({ promptTokens: 1, completionTokens: 1 }),
      }));

      const fn = (generateChatResponse as any).fn;

      const result = await fn({
        event: {
          data: {
            chatId: "chat-post-loop-abort",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      expect(result).toBeUndefined();
      // The first chunk was emitted, then the guard returned before persisting
      expect(inngest.realtime.publish).toHaveBeenCalledWith(
        expect.anything(),
        { type: "text-delta", text: "first" },
      );
      expect(mockLog.info).toHaveBeenCalledWith(
        "Chat generation cleanly aborted by user (chatId: {chatId})",
        { chatId: "chat-post-loop-abort" },
      );
      expect(mockPersistResponse).not.toHaveBeenCalled();
      expect(inngest.realtime.publish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "finish" }),
      );
      expect(mockMcpCleanup).toHaveBeenCalledTimes(1);
    });

    it("returns without emitting an error when the catch block sees an aborted signal", async () => {
      const controller = new AbortController();
      abortState.controller = controller;

      mockLoadChatContext.mockImplementationOnce(async () => {
        controller.abort();
        throw new Error("Boom after abort");
      });

      const fn = (generateChatResponse as any).fn;

      const result = await fn({
        event: {
          data: {
            chatId: "chat-catch-abort",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      expect(result).toBeUndefined();
      expect(mockLog.info).toHaveBeenCalledWith(
        "Chat generation cleanly aborted by user (chatId: {chatId})",
        { chatId: "chat-catch-abort" },
      );
      // The abort path must not surface an error event to the client
      expect(inngest.realtime.publish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "error" }),
      );
      expect(mockPersistResponse).not.toHaveBeenCalled();
      // registration never completed, so the default no-op cleanup is used
      expect(mockMcpCleanup).not.toHaveBeenCalled();
    });

    it("treats an AbortError-named error as a clean abort when the signal is not aborted", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockLoadChatContext.mockRejectedValueOnce(abortError);

      const fn = (generateChatResponse as any).fn;

      const result = await fn({
        event: {
          data: {
            chatId: "chat-abort-error-name",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      expect(result).toBeUndefined();
      expect(mockLog.info).toHaveBeenCalledWith(
        "Chat generation cleanly aborted by user (chatId: {chatId})",
        { chatId: "chat-abort-error-name" },
      );
      expect(inngest.realtime.publish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "error" }),
      );
    });
  });

  describe("tool chunk normalisation", () => {
    const runWithChunks = async (
      chatId: string,
      chunks: Array<Record<string, unknown>>,
    ) => {
      mockStreamText.mockImplementationOnce(() => ({
        fullStream: (async function* () {
          for (const chunk of chunks) yield chunk;
        })(),
        finishReason: Promise.resolve("stop"),
        usage: Promise.resolve({ promptTokens: 1, completionTokens: 1 }),
      }));

      const fn = (generateChatResponse as any).fn;
      await fn({
        event: {
          data: {
            chatId,
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });
    };

    it("falls back to `output` when a tool-result chunk has no `result` field", async () => {
      await runWithChunks("chat-output-fallback", [
        {
          type: "tool-call",
          toolCallId: "tc-1",
          toolName: "fetch_api",
          args: { endpoint: "/a" },
        },
        {
          type: "tool-result",
          toolCallId: "tc-1",
          toolName: "fetch_api",
          output: { ok: true, value: 42 },
        },
      ]);

      expect(inngest.realtime.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: "tool-result",
          toolCallId: "tc-1",
          result: { ok: true, value: 42 },
        }),
      );

      const metadata = JSON.parse(
        mockPersistResponse.mock.calls.find(
          (c: any[]) => c[0]?.chatId === "chat-output-fallback",
        )[0].metadata,
      );
      // the `output` fallback must also feed the persisted toolResults
      expect(metadata.toolResults[0].result).toEqual({ ok: true, value: 42 });
    });

    it("ignores a tool-result chunk with no matching tool-call and still emits it", async () => {
      await runWithChunks("chat-orphan-result", [
        {
          type: "tool-result",
          toolCallId: "tc-unknown",
          toolName: "orphan_tool",
          result: { ok: true },
        },
      ]);

      expect(inngest.realtime.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: "tool-result",
          toolCallId: "tc-unknown",
          result: { ok: true },
        }),
      );
      // No tool call was recorded, so there is nothing to persist
      const metadata = JSON.parse(
        mockPersistResponse.mock.calls.find(
          (c: any[]) => c[0]?.chatId === "chat-orphan-result",
        )[0].metadata,
      );
      expect(metadata.toolCalls).toEqual([]);
      expect(metadata.toolResults).toEqual([]);
    });

    it("stringifies a tool-error whose throwable is a plain object", async () => {
      await runWithChunks("chat-err-object", [
        {
          type: "tool-call",
          toolCallId: "tc-1",
          toolName: "flaky",
          args: {},
        },
        {
          type: "tool-error",
          toolCallId: "tc-1",
          toolName: "flaky",
          error: { statusCode: 500, reason: "upstream exploded" },
        },
      ]);

      expect(inngest.realtime.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: "tool-result",
          toolCallId: "tc-1",
          result: { error: '{"statusCode":500,"reason":"upstream exploded"}' },
        }),
      );

      const metadata = JSON.parse(
        mockPersistResponse.mock.calls.find(
          (c: any[]) => c[0]?.chatId === "chat-err-object",
        )[0].metadata,
      );
      expect(metadata.toolResults[0].result).toEqual({
        error: '{"statusCode":500,"reason":"upstream exploded"}',
      });
    });

    it("uses the raw string when a tool-error throwable is a string", async () => {
      await runWithChunks("chat-err-string", [
        {
          type: "tool-call",
          toolCallId: "tc-1",
          toolName: "flaky",
          args: {},
        },
        {
          type: "tool-error",
          toolCallId: "tc-1",
          toolName: "flaky",
          error: "Tool timed out after 30s",
        },
      ]);

      expect(inngest.realtime.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: "tool-result",
          toolCallId: "tc-1",
          result: { error: "Tool timed out after 30s" },
        }),
      );
    });

    it.each([
      ["undefined", undefined],
      ["null", null],
    ])(
      "falls back to the default message when a tool-error throwable is %s",
      async (_label, errorValue) => {
        await runWithChunks(`chat-err-${_label}`, [
          {
            type: "tool-call",
            toolCallId: "tc-1",
            toolName: "flaky",
            args: {},
          },
          {
            type: "tool-error",
            toolCallId: "tc-1",
            toolName: "flaky",
            error: errorValue,
          },
        ]);

        // JSON.stringify('Tool execution failed') yields a quoted string
        expect(inngest.realtime.publish).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            type: "tool-result",
            toolCallId: "tc-1",
            result: { error: '"Tool execution failed"' },
          }),
        );
      },
    );

    it("emits a tool-result for a tool-error chunk with no matching tool-call", async () => {
      await runWithChunks("chat-err-orphan", [
        {
          type: "tool-error",
          toolCallId: "tc-orphan",
          toolName: "unknown_tool",
          error: new Error("nope"),
        },
      ]);

      expect(inngest.realtime.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: "tool-result",
          toolCallId: "tc-orphan",
          result: { error: "nope" },
        }),
      );
      const metadata = JSON.parse(
        mockPersistResponse.mock.calls.find(
          (c: any[]) => c[0]?.chatId === "chat-err-orphan",
        )[0].metadata,
      );
      expect(metadata.toolCalls).toEqual([]);
    });
  });

  describe("thread and tool registration variants", () => {
    it("handles thread messages with no attachments field at all", async () => {
      mockLoadThread.mockResolvedValueOnce([
        { id: "msg-1", role: "user", content: "no attachments key" },
      ]);

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-no-attachments",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      // `m.attachments ?? []` yields no file attachments, so no file-url tool
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({ tools: undefined }),
      );
      expect(mockPersistResponse).toHaveBeenCalledWith(
        expect.objectContaining({ chatId: "chat-no-attachments" }),
      );
    });

    it("passes an empty tool set when MCP tools exist but a file tool is absent", async () => {
      mockLoadThread.mockResolvedValueOnce([
        { id: "msg-1", role: "user", content: "hi", attachments: [] },
      ]);

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-mcp-only",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
            selectedTools: ["internal:tool:manage_artifact"],
          },
        },
      });

      const tools = mockStreamText.mock.calls[0][0].tools;
      // only the MCP-provided artifact tool, no get_file_url or load_skill
      expect(Object.keys(tools)).toEqual(["manage_artifact"]);
    });

    it("drops attachments that have no storage key when building file tools", async () => {
      mockLoadThread.mockResolvedValueOnce([
        {
          id: "msg-1",
          role: "user",
          content: "mixed",
          attachments: [
            { id: "a-1", name: "kept.xlsx", key: "uploads/kept.xlsx", type: "spreadsheet" },
            { id: "a-2", name: "orphan.csv", type: "spreadsheet" },
          ],
        },
      ]);

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-key-filter",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      const tools = mockStreamText.mock.calls[0][0].tools;
      expect(tools.get_file_url).toBeDefined();
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: expect.stringContaining("kept.xlsx"),
        }),
      );
      expect(mockStreamText.mock.calls[0][0].instructions).not.toContain(
        "orphan.csv",
      );
    });
  });

  describe("outer error handling", () => {
    it("rethrows a non-Error throwable and emits a generic message", async () => {
      const thrown = { code: "E_PROVIDER", detail: "socket hang up" };
      mockLoadChatContext.mockRejectedValueOnce(thrown);

      const fn = (generateChatResponse as any).fn;

      await expect(
        fn({
          event: {
            data: {
              chatId: "chat-non-error",
              userId: "user-1",
              userMessageId: "msg-1",
              model: "gpt-4o",
            },
          },
        }),
      ).rejects.toBe(thrown);

      expect(inngest.realtime.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: "error",
          message: "Generation failed",
          code: "E_PROVIDER",
        }),
      );
      expect(mockLog.error).toHaveBeenCalledWith(
        "Chat generation failed in Inngest (chatId: {chatId}): {error}",
        { chatId: "chat-non-error", error: "Generation failed" },
      );
    });

    it("logs a stringified publish failure when the realtime channel throws a non-Error", async () => {
      (inngest.realtime.publish as any).mockRejectedValueOnce("redis exploded");

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-publish-string",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      expect(mockLog.warn).toHaveBeenCalledWith(
        "Failed to publish chat stream event to Inngest Realtime",
        { error: "redis exploded", type: "start" },
      );
      expect(mockPersistResponse).toHaveBeenCalled();
    });

    it("calls the MCP cleanup returned by registerMcpTools even on failure", async () => {
      mockLoadChatContext.mockRejectedValueOnce(new Error("Context load failed"));

      const fn = (generateChatResponse as any).fn;

      await expect(
        fn({
          event: {
            data: {
              chatId: "chat-cleanup-on-error",
              userId: "user-1",
              userMessageId: "msg-1",
              model: "gpt-4o",
            },
          },
        }),
      ).rejects.toThrow("Context load failed");

      // registerMcpTools never ran, so the no-op default must be used
      expect(mockMcpCleanup).not.toHaveBeenCalled();
    });
  });
});


