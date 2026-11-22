import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPublish = vi.hoisted(() => vi.fn());
const mockPersistResponse = vi.hoisted(() => vi.fn());
const mockUpdateResponse = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const mockDbSelectLimit = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockResolveProvider = vi.hoisted(() => vi.fn());
const mockLoadChatContext = vi.hoisted(() => vi.fn());
const mockLoadThread = vi.hoisted(() => vi.fn());
const mockStreamText = vi.hoisted(() => vi.fn());
const mockGetUserSettings = vi.hoisted(() => vi.fn());

vi.mock("@/lib/user/get-user-settings-by-id", () => ({
  getUserSettingsByUserId: mockGetUserSettings,
}));

// Wrapped, not replaced: other tests assert on the real composed prompt.
vi.mock("@/lib/chat/build-system-prompt", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/chat/build-system-prompt")>();
  return { buildSystemPrompt: vi.fn(actual.buildSystemPrompt) };
});

vi.mock("@/lib/inngest/chat-response/tool-set-builder", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/inngest/chat-response/tool-set-builder")
    >();
  return {
    buildOrchestratorToolSet: vi.fn(actual.buildOrchestratorToolSet),
  };
});

vi.mock("@/lib/chat/compact-chat-thread", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/chat/compact-chat-thread")>();
  return { compactChatThread: vi.fn(actual.compactChatThread) };
});

vi.mock("@/lib/chat/resolve-provider", () => ({
  resolveProvider: mockResolveProvider,
}));

vi.mock("@/lib/chat/resolve-default-chat-provider", () => ({
  resolveDefaultChatProvider: mockResolveProvider,
}));

vi.mock("@/lib/chat/load-chat-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/chat/load-chat-context")>();
  return {
    ...actual,
    loadChatContext: mockLoadChatContext,
  };
});

vi.mock("@/lib/chat/load-thread-from-db", () => ({
  loadThreadFromDb: mockLoadThread,
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockDbSelectLimit,
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/chat/persist-response", () => ({
  persistAssistantResponse: mockPersistResponse,
  updateAssistantResponse: mockUpdateResponse,
}));

vi.mock("@/lib/chat/has-existing-assistant-message", () => ({
  hasExistingAssistantMessage: vi.fn().mockResolvedValue(false),
}));

vi.mock("ai", () => ({
  streamText: mockStreamText,
  isStepCount: mockIsStepCount,
  tool: vi.fn((def) => def),
}));

const mockMcpCleanup = vi.hoisted(() => vi.fn(async () => {}));
const mockRegisterMcpTools = vi.hoisted(() => vi.fn());
const mockDeleteScratchpadFiles = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);
const mockIsStepCount = vi.hoisted(() => vi.fn(() => ({ isStepCount: true })));
const abortState = vi.hoisted(() => ({
  controller: undefined as AbortController | undefined,
  release: vi.fn(),
}));

// The real registry hides its AbortController, so abort paths are untestable
// without this seam. Tests assign `abortState.controller` per scenario.
vi.mock("@/lib/chat/chat-abort-registry", () => ({
  chatAbortRegistry: {
    register: vi.fn(() => ({
      controller: abortState.controller!,
      release: abortState.release,
    })),
    delete: vi.fn(),
  },
}));

// Mirrors the real module's observable contract: tools exist only when servers
// are scoped or the artifact tool is explicitly selected.
vi.mock("@/lib/chat/register-mcp-tools", () => ({
  registerMcpTools: mockRegisterMcpTools,
}));

vi.mock("@/lib/subagents/delete-scratchpad-files", () => ({
  deleteScratchpadFiles: mockDeleteScratchpadFiles,
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
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import { compactChatThread } from "@/lib/chat/compact-chat-thread";
import { ChatNotFoundError } from "@/lib/chat/load-chat-context";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { inngest } from "@/lib/inngest/client";

describe("generateChatResponse Inngest Function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistResponse.mockResolvedValue(true);
    mockGetUserSettings.mockResolvedValue(null);
    abortState.controller = new AbortController();
    mockRegisterMcpTools.mockImplementation(
      async (servers: unknown) => ({
        mcpTools:
          Array.isArray(servers) && servers.length > 0
            ? { external_mcp_tool: { description: "external tool" } }
            : {},
        toolSourceMap:
          Array.isArray(servers) && servers.length > 0
            ? { external_mcp_tool: "MCP" }
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

  it("is configured with concurrency limit 1 keyed on event.data.chatId", () => {
    expect((generateChatResponse as any).opts.concurrency).toEqual({
      key: "event.data.chatId",
      limit: 1,
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

  it("forwards the user's name and email to buildSystemPrompt", async () => {
    const fn = (generateChatResponse as any).fn;

    await fn({
      event: {
        data: {
          chatId: "chat-123",
          userId: "user-123",
          userName: "Alice Smith",
          userEmail: "alice@example.com",
          userMessageId: "msg-1",
          model: "gpt-4o",
        },
      },
    });

    const [, , , , options] = vi.mocked(buildSystemPrompt).mock.calls[0];
    expect(options).toEqual(
      expect.objectContaining({
        userContext: { name: "Alice Smith", email: "alice@example.com" },
      }),
    );
  });

  it("extracts and forwards canvasArtifacts from thread to buildSystemPrompt", async () => {
    const fn = (generateChatResponse as any).fn;
    const artifactMeta = JSON.stringify({
      toolCalls: [
        {
          toolCallId: "call_1",
          toolName: "manage_artifact",
          args: { title: "Draft", type: "markdown", content: "old" },
        },
      ],
      toolResults: [
        {
          toolCallId: "call_1",
          toolName: "manage_artifact",
          result: {
            success: true,
            artifact: {
              id: "art-1",
              title: "Draft",
              type: "markdown",
              content: "Dear Andy, updated content",
            },
          },
        },
      ],
    });

    mockLoadThread.mockResolvedValueOnce([
      { id: "m1", role: "user", content: "draft email" },
      { id: "m2", role: "assistant", content: "done", metadata: artifactMeta },
      { id: "m3", role: "user", content: "what is manager name?" },
    ]);

    await fn({
      event: {
        data: {
          chatId: "chat-123",
          userId: "user-123",
          userMessageId: "m3",
          model: "gpt-4o",
        },
      },
    });

    const [, , , , options] = vi.mocked(buildSystemPrompt).mock.calls[0];
    expect(options.canvasArtifacts).toBeDefined();
    expect(options.canvasArtifacts).toHaveLength(1);
    expect(options.canvasArtifacts[0]).toMatchObject({
      id: "art-1",
      title: "Draft",
      type: "markdown",
      content: "Dear Andy, updated content",
    });
  });

  it("omits save_memory tool when memoryEnabled is false in userSettings", async () => {
    mockGetUserSettings.mockResolvedValueOnce({
      id: "settings-1",
      userId: "user-123",
      memoryEnabled: false,
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

    const streamArgs = mockStreamText.mock.calls[0][0];
    const tools = streamArgs.tools ?? {};
    expect(tools.save_memory).toBeUndefined();
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
    expect(mockDeleteScratchpadFiles).toHaveBeenCalled();
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

  it("does not throw ToolsNotSupportedError when model lacks tools support but knowledge base is attached", async () => {
    mockResolveProvider.mockResolvedValueOnce({
      modelId: "no-tools",
      modelRow: { capVision: true, capTools: false },
      sdkProvider: { chat: () => () => {} },
    });

    mockLoadChatContext.mockResolvedValueOnce({
      servers: [],
      activeKbId: "kb-1",
      kbIsReady: true,
      availableSkills: [],
      selectedSkills: [],
      projectRow: null,
      assistantRow: null,
    });

    mockLoadThread.mockResolvedValueOnce([
      { id: "msg-1", role: "user", content: "Tell me something" },
    ]);

    mockStreamText.mockReturnValueOnce({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "Answer without tools." };
      })(),
      finishReason: Promise.resolve("stop"),
      usage: Promise.resolve({ promptTokens: 5, completionTokens: 10 }),
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
          },
        },
      }),
    ).resolves.not.toThrow();

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: undefined,
      }),
    );
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
      expect(mockPersistResponse).toHaveBeenCalledWith({
        assistantMessageId: expect.any(String),
        chatId: "chat-loop-abort",
        content: "partial",
        parentId: "msg-1",
        metadata: expect.stringContaining('"stopped":true'),
      });
      expect(mockDeleteScratchpadFiles).not.toHaveBeenCalled();
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
      expect(mockDeleteScratchpadFiles).not.toHaveBeenCalled();
      // The first chunk was emitted, then the guard returned before persisting
      expect(inngest.realtime.publish).toHaveBeenCalledWith(
        expect.anything(),
        { type: "text-delta", text: "first" },
      );
      expect(mockLog.info).toHaveBeenCalledWith(
        "Chat generation cleanly aborted by user (chatId: {chatId})",
        { chatId: "chat-post-loop-abort" },
      );
      expect(mockPersistResponse).toHaveBeenCalledWith({
        assistantMessageId: expect.any(String),
        chatId: "chat-post-loop-abort",
        content: "first",
        parentId: "msg-1",
        metadata: expect.stringContaining('"stopped":true'),
      });
      expect(inngest.realtime.publish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "finish" }),
      );
      expect(mockMcpCleanup).toHaveBeenCalledTimes(1);
    });

    it("deletes scratchpad files and skips persistence when stream is aborted with no content or tools", async () => {
      const controller = new AbortController();
      abortState.controller = controller;

      mockStreamText.mockImplementationOnce(() => ({
        fullStream: (async function* () {
          controller.abort();
        })(),
        finishReason: Promise.resolve("stop"),
        usage: Promise.resolve({ promptTokens: 1, completionTokens: 0 }),
      }));

      const fn = (generateChatResponse as any).fn;

      const result = await fn({
        event: {
          data: {
            chatId: "chat-empty-abort",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      expect(result).toBeUndefined();
      expect(mockPersistResponse).not.toHaveBeenCalled();
      expect(mockDeleteScratchpadFiles).toHaveBeenCalled();
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

    it("does not treat TimeoutError or ResponseAborted as clean user abort", async () => {
      const timeoutError = new Error("Gateway timeout");
      timeoutError.name = "TimeoutError";
      mockLoadChatContext.mockRejectedValueOnce(timeoutError);

      const fn = (generateChatResponse as any).fn;

      await expect(
        fn({
          event: {
            data: {
              chatId: "chat-timeout-error",
              userId: "user-1",
              userMessageId: "msg-1",
            },
          },
        }),
      ).rejects.toThrow("Gateway timeout");

      const respAbortedError = new Error("Response aborted by upstream");
      respAbortedError.name = "ResponseAborted";
      mockLoadChatContext.mockRejectedValueOnce(respAbortedError);

      await expect(
        fn({
          event: {
            data: {
              chatId: "chat-resp-aborted",
              userId: "user-1",
              userMessageId: "msg-1",
            },
          },
        }),
      ).rejects.toThrow("Response aborted by upstream");
    });

    it("skips finish emission and exits cleanly when persistAssistantResponse returns false", async () => {
      mockPersistResponse.mockResolvedValueOnce(false);
      const fn = (generateChatResponse as any).fn;

      await expect(
        fn({
          event: {
            data: {
              chatId: "chat-concurrent-delete",
              userId: "user-1",
              userMessageId: "msg-1",
            },
          },
        }),
      ).resolves.toBeUndefined();

      expect(inngest.realtime.publish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "finish" }),
      );
    });

    it("exits cleanly without error event or rethrow when ChatNotFoundError is raised", async () => {
      mockLoadChatContext.mockRejectedValueOnce(new ChatNotFoundError("chat-deleted"));
      const fn = (generateChatResponse as any).fn;

      await expect(
        fn({
          event: {
            data: {
              chatId: "chat-deleted",
              userId: "user-1",
              userMessageId: "msg-1",
            },
          },
        }),
      ).resolves.toBeUndefined();

      expect(inngest.realtime.publish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "error" }),
      );

      // Also verify AppException with ERROR_CODE.NOT_FOUND
      mockLoadChatContext.mockRejectedValueOnce(
        new AppException({ code: ERROR_CODE.NOT_FOUND, message: "Chat not found" }),
      );
      await expect(
        fn({
          event: {
            data: {
              chatId: "chat-deleted",
              userId: "user-1",
              userMessageId: "msg-1",
            },
          },
        }),
      ).resolves.toBeUndefined();
    });

    it("exits cleanly and persists partial response if stream was aborted before persistAssistantResponse", async () => {
      const controller = new AbortController();
      abortState.controller = controller;

      mockStreamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Text" };
        })(),
        finishReason: Promise.resolve("stop"),
        usage: new Promise((resolve) => {
          setTimeout(() => {
            controller.abort();
            resolve(undefined);
          }, 10);
        }),
      });

      const fn = (generateChatResponse as any).fn;
      await fn({
        event: {
          data: {
            chatId: "chat-abort-pre-persist",
            userId: "user-1",
            userMessageId: "msg-1",
          },
        },
      });

      expect(mockPersistResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: "chat-abort-pre-persist",
          content: "Text",
          metadata: expect.stringContaining('"stopped":true'),
        }),
      );
      expect(mockDeleteScratchpadFiles).not.toHaveBeenCalled();
      expect(mockLog.info).toHaveBeenCalledWith(
        "Chat generation cleanly aborted before persistence (chatId: {chatId})",
        { chatId: "chat-abort-pre-persist" },
      );
      expect(inngest.realtime.publish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "finish" }),
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
          output: { ok: true },
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

      // `m.attachments ?? []` yields no file attachments, so no file-url tool.
      // Skill authoring is unconditional, so the tool set is present.
      const tools = mockStreamText.mock.calls[0][0].tools;
      expect(tools.get_file_url).toBeUndefined();
      expect(tools.load_skill).toBeUndefined();
      expect(Object.keys(tools)).toContain("create_skill");
      expect(mockPersistResponse).toHaveBeenCalledWith(
        expect.objectContaining({ chatId: "chat-no-attachments" }),
      );
    });

    it("registers only MCP tools and skill authoring when no file or skill catalog exists", async () => {
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
            selectedTools: [
              "internal:tool:manage_artifact",
              "internal:tool:manage_skill",
            ],
          },
        },
      });

      const tools = mockStreamText.mock.calls[0][0].tools;
      // No get_file_url and no load_skill, but authoring is always offered and
      // must not be shadowed by the MCP tools spread.
      expect(tools.get_file_url).toBeUndefined();
      expect(tools.load_skill).toBeUndefined();
      expect(Object.keys(tools).sort()).toEqual([
        "create_skill",
        "delete_skill_file",
        "manage_artifact",
        "read_skill_file",
        "update_skill",
        "write_skill_file",
      ]);
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

  describe("tool availability gating", () => {
    /**
     * A model without tool support must reach streamText with NO tools and no
     * step limit. `hasSkillAuthoring` and `hasAnyTools` both collapse to false,
     * which is the only way to reach the falsy arms of the three conditionals
     * that build the `tools` object and the `stopWhen` limit.
     *
     * No MCP tools may be present, because `!isToolCallingModel && hasMcpTools`
     * throws ToolsNotSupportedError before streamText is ever called.
     */
    it("sends no tools and no step limit for a non-tool-calling model", async () => {
      mockResolveProvider.mockResolvedValueOnce({
        modelId: "plain-chat",
        modelRow: { capVision: true, capTools: false },
        sdkProvider: { chat: () => () => {} },
      });

      mockLoadThread.mockResolvedValueOnce([
        { id: "msg-1", role: "user", content: "just chat", attachments: [] },
      ]);

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-no-tools-gate",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "plain-chat",
          },
        },
      });

      const call = mockStreamText.mock.calls[0][0];
      // Skill authoring is offered only to tool-calling models.
      expect(call.tools).toBeUndefined();
      // No multi-step loop without tools.
      expect(call.stopWhen).toBeUndefined();
      // The model still produces a normal completion.
      expect(mockPersistResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: "chat-no-tools-gate",
          content: "Hello there!",
        }),
      );
    });

    it("registers skill authoring and a step limit for a tool-calling model", async () => {
      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-tools-gate",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      const call = mockStreamText.mock.calls[0][0];
      expect(Object.keys(call.tools)).toContain("create_skill");
      // The multi-step limit is produced by `isStepCount(env.CHAT_MAX_STEPS)`.
      expect(call.stopWhen).toBe(mockIsStepCount.mock.results[0].value);
      expect(mockIsStepCount).toHaveBeenCalled();
    });

    /**
     * Covers the `Array.isArray(servers) ? servers.length : 0` fallback in
     * setupChatMcpTools: a non-tool-calling model whose `servers` value is not
     * an array must still resolve hasExternalMcpTools to false without
     * throwing, and must not register any MCP tools.
     */
    it("treats a non-array servers value as zero external servers for a non-tool-calling model", async () => {
      mockResolveProvider.mockResolvedValueOnce({
        modelId: "plain-chat",
        modelRow: { capVision: true, capTools: false },
        sdkProvider: { chat: () => () => {} },
      });

      mockLoadChatContext.mockResolvedValueOnce({
        servers: "not-an-array" as any,
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        assistantRow: null,
      });

      mockLoadThread.mockResolvedValueOnce([
        { id: "msg-1", role: "user", content: "just chat", attachments: [] },
      ]);

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-non-array-servers",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "plain-chat",
          },
        },
      });

      // No MCP tools were registered and no capability error was raised.
      expect(mockRegisterMcpTools).not.toHaveBeenCalled();
      expect(mockPersistResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: "chat-non-array-servers",
          content: "Hello there!",
        }),
      );
    });

    /**
     * Covers the truthy arm of `resolved.modelRow?.contextWindow ? ... :
     * undefined`: a model row with a contextWindow must derive
     * maxContextTokens as 85% of the window for prepareChatMessages.
     */
    it("derives maxContextTokens from the model context window", async () => {
      const prepareSpy = vi.spyOn(
        await import("@/lib/chat/prepare-chat-messages"),
        "prepareChatMessages",
      );

      mockResolveProvider.mockResolvedValueOnce({
        modelId: "gpt-4o",
        modelRow: {
          capVision: true,
          capTools: true,
          contextWindow: 10000,
        },
        sdkProvider: { chat: () => () => {} },
      });

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-context-window",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      expect(prepareSpy).toHaveBeenCalledWith(
        expect.objectContaining({ maxContextTokens: 8500 }),
      );
      prepareSpy.mockRestore();
    });
  });

  describe("stream chunk dispatch", () => {
    /**
     * The chunk dispatcher is a single if/else-if chain. A lifecycle chunk that
     * matches none of the five handled types (text-delta, reasoning-delta,
     * tool-call, tool-result, tool-error) falls off the end of the chain and
     * must be ignored rather than treated as a failure.
     */
    it("ignores lifecycle chunks that match no handler in the chain", async () => {
      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "start" };
          yield { type: "step-start" };
          yield { type: "text-delta", text: "Only real text survives." };
        })(),
        finishReason: Promise.resolve("stop"),
        usage: Promise.resolve({ promptTokens: 1, completionTokens: 1 }),
      });

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-lifecycle-chunks",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      expect(mockPersistResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: "chat-lifecycle-chunks",
          content: "Only real text survives.",
        }),
      );
      // Unhandled chunks must not be forwarded to the client as deltas
      expect(inngest.realtime.publish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "text-delta", text: "start" }),
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

    it("allows non-tool-calling model when selectedTools only contain internal non-mcp tool ids", async () => {
      mockResolveProvider.mockResolvedValueOnce({
        modelId: "simple-model",
        modelRow: { capVision: true, capTools: false },
        sdkProvider: { chat: () => () => {} },
      });

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-internal-tools",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "simple-model",
            selectedTools: [
              "internal:tool:manage_artifact",
              "search_knowledge_base",
              "get_file_url",
              "load_skill",
            ],
          },
        },
      });

      expect(mockPersistResponse).toHaveBeenCalled();
      expect(mockRegisterMcpTools).not.toHaveBeenCalled();
    });

    it("resolves target kb IDs from activeKbIds array and handles undefined kbIsReady", async () => {
      mockLoadChatContext.mockResolvedValueOnce({
        servers: [],
        activeKbIds: ["kb-1", "kb-2"],
        activeKbId: null,
        kbIsReady: undefined,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        assistantRow: null,
      });

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-active-kb-ids",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      expect(mockPersistResponse).toHaveBeenCalled();
    });

    it("resolves worker chat provider when subagentModelId is provided and handles rejection", async () => {
      mockResolveProvider
        .mockResolvedValueOnce({
          modelId: "orchestrator-model",
          modelRow: { capVision: true, capTools: true },
          sdkProvider: { chat: () => () => {} },
        })
        .mockRejectedValueOnce(new Error("Worker model not found"));

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-subagent-worker-fail",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "orchestrator-model",
            subagentsEnabled: true,
            subagentModelId: "worker-missing",
          },
        },
      });

      expect(mockPersistResponse).toHaveBeenCalled();
    });

    it("handles subagent tool results with preliminary flag and custom worker model", async () => {
      mockResolveProvider
        .mockResolvedValueOnce({
          modelId: "orchestrator-model",
          modelRow: { capVision: true, capTools: true },
          sdkProvider: { chat: () => () => {} },
        })
        .mockResolvedValueOnce({
          modelId: "worker-model",
          modelRow: { capVision: true, capTools: true },
          sdkProvider: { chat: () => () => {} },
        });

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield {
            type: "tool-call",
            toolCallId: "tc-sub",
            toolName: "delegate_task",
            args: { task: "research" },
          };
          yield {
            type: "tool-result",
            toolCallId: "tc-sub",
            toolName: "delegate_task",
            result: { output: "research in progress" },
            preliminary: true,
          };
          yield {
            type: "tool-result",
            toolCallId: "tc-sub",
            toolName: "delegate_task",
            result: { output: "research finished" },
            preliminary: false,
          };
          yield { type: "text-delta", text: "Final answer" };
        })(),
        finishReason: Promise.resolve("stop"),
        usage: Promise.resolve({ promptTokens: 10, completionTokens: 10 }),
      });

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-subagent-preliminary",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "orchestrator-model",
            subagentsEnabled: true,
            subagentModelId: "worker-model",
          },
        },
      });

      expect(mockPersistResponse).toHaveBeenCalled();
    });

    it("handles synthesis pass error when synthesis stream throws", async () => {
      mockStreamText
        .mockReturnValueOnce({
          fullStream: (async function* () {
            yield {
              type: "tool-call",
              toolCallId: "tc-sub",
              toolName: "delegate_task",
              args: { task: "deep task" },
            };
            yield {
              type: "tool-result",
              toolCallId: "tc-sub",
              toolName: "delegate_task",
              result: "plain string result",
            };
          })(),
          finishReason: Promise.resolve("tool-calls"),
          usage: Promise.resolve({ promptTokens: 10, completionTokens: 10 }),
        })
        .mockImplementationOnce(() => {
          throw new Error("Synthesis failure");
        });

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-synth-fail-err",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
            subagentsEnabled: true,
            selectedTools: [],
          },
        },
      });

      expect(mockPersistResponse).toHaveBeenCalled();

      // Non-Error throwable in synthesis
      mockStreamText
        .mockReturnValueOnce({
          fullStream: (async function* () {
            yield {
              type: "tool-call",
              toolCallId: "tc-sub",
              toolName: "delegate_task",
              args: { task: "deep task" },
            };
            yield {
              type: "tool-result",
              toolCallId: "tc-sub",
              toolName: "delegate_task",
              result: "string result",
            };
          })(),
          finishReason: Promise.resolve("tool-calls"),
          usage: Promise.resolve({ promptTokens: 10, completionTokens: 10 }),
        })
        .mockImplementationOnce(() => {
          throw "string synth explosion";
        });

      await fn({
        event: {
          data: {
            chatId: "chat-synth-fail-str",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
            subagentsEnabled: true,
            selectedTools: [],
          },
        },
      });

      expect(mockPersistResponse).toHaveBeenCalled();
    });

    it("includes serverName in message metadata when tool execution has server origin", async () => {
      mockLoadChatContext.mockResolvedValueOnce({
        servers: [{ id: "srv-1", name: "ExcelServer" }],
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        assistantRow: null,
      });

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield {
            type: "tool-call",
            toolCallId: "tc-srv",
            toolName: "external_mcp_tool",
            args: { x: 1 },
          };
          yield {
            type: "tool-result",
            toolCallId: "tc-srv",
            toolName: "external_mcp_tool",
            result: { data: "from server" },
          };
          yield { type: "text-delta", text: "Answer with server tool" };
        })(),
        finishReason: Promise.resolve("stop"),
        usage: Promise.resolve({ promptTokens: 5, completionTokens: 5 }),
      });

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-server-origin",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      expect(mockPersistResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.stringContaining('"serverName":"MCP"'),
        }),
      );
    });

    it("sets allTools to undefined when hasAnyTools is false", async () => {
      mockLoadChatContext.mockResolvedValueOnce({
        servers: [],
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        assistantRow: null,
      });

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-no-tools",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
            selectedTools: ["unmatched_tool"],
            subagentsEnabled: false,
          },
        },
      });

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: undefined,
        }),
      );
    });

    it("registers subagentServers MCP tools separately from parent servers and cleans up both on completion", async () => {
      const subCleanup = vi.fn(async () => {});
      mockRegisterMcpTools
        .mockResolvedValueOnce({
          mcpTools: {},
          toolSourceMap: {},
          mcpCleanup: mockMcpCleanup,
        })
        .mockResolvedValueOnce({
          mcpTools: { subagent_only_mcp_tool: { description: "sub mcp" } },
          toolSourceMap: { subagent_only_mcp_tool: "SubMCP" },
          mcpCleanup: subCleanup,
        });

      mockLoadChatContext.mockResolvedValueOnce({
        servers: [],
        subagentServers: [{ id: "srv-sub", name: "SubMCP", url: "https://sub.mcp" }],
        linkedSubagents: [
          {
            id: "sub-1",
            name: "Maruf MCP Researcher",
            tools: ["srv-sub:tool:subagent_only_mcp_tool", "internal:tool:search_knowledge_base"],
            knowledgebaseIds: [],
            skillMode: "dynamic",
            skillIds: [],
            guardrails: { maxSteps: 8, scratchpadAccess: "read_only", isolateTools: true },
          },
        ],
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        agentRow: { id: "orch-1", subagentIds: ["sub-1"] },
      });

      const fn = (generateChatResponse as any).fn;

      await fn({
        event: {
          data: {
            chatId: "chat-sub-mcp",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
            selectedAgentId: "orch-1",
            subagentIds: ["sub-1"],
          },
        },
      });

      expect(mockLoadChatContext).toHaveBeenCalledWith(
        "chat-sub-mcp",
        "user-1",
        undefined,
        undefined,
        "orch-1",
        undefined,
        undefined,
        ["sub-1"],
      );
      expect(mockRegisterMcpTools).toHaveBeenCalledTimes(2);
      expect(mockRegisterMcpTools).toHaveBeenNthCalledWith(
        2,
        [{ id: "srv-sub", name: "SubMCP", url: "https://sub.mcp" }],
        ["srv-sub:tool:subagent_only_mcp_tool"],
      );
      const streamTools = mockStreamText.mock.calls[0][0].tools;
      // Parent orchestrator must NOT get subagent_only_mcp_tool directly
      expect(streamTools.subagent_only_mcp_tool).toBeUndefined();
      // Delegate task should be enabled
      expect(streamTools.delegate_task).toBeDefined();
      expect(mockMcpCleanup).toHaveBeenCalled();
      expect(subCleanup).toHaveBeenCalled();

      // Also test when subagentServers is non-empty but linkedSubagents only have internal tools (or undefined)
      mockRegisterMcpTools.mockClear();
      mockLoadChatContext.mockResolvedValueOnce({
        servers: [],
        subagentServers: [{ id: "srv-sub", name: "SubMCP", url: "https://sub.mcp" }],
        linkedSubagents: undefined,
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        agentRow: null,
      });

      await fn({
        event: {
          data: {
            chatId: "chat-sub-mcp-empty-tools",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
          },
        },
      });

      expect(mockRegisterMcpTools).toHaveBeenCalledTimes(1);
    });

    it("disambiguates same-named subagent MCP tools from another server without overwriting parent tools", async () => {
      const parentSearchTool = { description: "parent-srv1-search" };
      const subSearchTool = { description: "sub-srv2-search" };
      const subCleanup = vi.fn().mockResolvedValue(undefined);

      mockRegisterMcpTools
        .mockResolvedValueOnce({
          mcpTools: {
            search: parentSearchTool,
            search_2: { description: "parent-srv3-search" },
            dup_tool: { description: "parent-dup" },
            same_name_tool: { description: "parent-same-name" },
            anon_tool: { description: "parent-anon" },
          },
          toolSourceMap: {
            search: "Server1",
            search_2: "Server3",
            dup_tool: "Server1",
            same_name_tool: "Server1",
          },
          toolServerIdMap: {
            search: "srv-1",
            search_2: "srv-3",
            dup_tool: "srv-1",
          },
          mcpCleanup: mockMcpCleanup,
        })
        .mockResolvedValueOnce({
          mcpTools: {
            search: subSearchTool,
            dup_tool: { description: "sub-dup" },
            same_name_tool: { description: "sub-same-name" },
            anon_tool: { description: "sub-anon" },
            fresh_tool: { description: "sub-fresh" },
          },
          toolSourceMap: {
            search: "Server2",
            dup_tool: "Server1",
            same_name_tool: "Server1",
          },
          toolServerIdMap: {
            search: "srv-2",
            dup_tool: "srv-1",
            fresh_tool: "srv-2",
          },
          mcpCleanup: subCleanup,
        });

      mockLoadChatContext.mockResolvedValueOnce({
        servers: [{ id: "srv-1", name: "Server1", url: "https://srv1.mcp" }],
        subagentServers: [{ id: "srv-2", name: "Server2", url: "https://srv2.mcp" }],
        linkedSubagents: [
          {
            id: "sub-1",
            name: "Sub 1",
            description: "Uses srv-1 search",
            prompt: "",
            subagentPrompt: "",
            modelId: null,
            knowledgebaseIds: [],
            tools: ["srv-1:tool:search"],
            skillMode: "none",
            skillIds: [],
            promptMode: "none",
            promptIds: [],
            subagentIds: [],
            guardrails: { maxSteps: 5, scratchpadAccess: "none", isolateTools: true },
            isBuiltIn: false,
            userId: "u1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "sub-2",
            name: "Sub 2",
            description: "Uses srv-2 search",
            prompt: "",
            subagentPrompt: "",
            modelId: null,
            knowledgebaseIds: [],
            tools: ["srv-2:tool:search"],
            skillMode: "none",
            skillIds: [],
            promptMode: "none",
            promptIds: [],
            subagentIds: [],
            guardrails: { maxSteps: 5, scratchpadAccess: "none", isolateTools: true },
            isBuiltIn: false,
            userId: "u1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        agentRow: null,
      });

      const fn = (generateChatResponse as any).fn;
      await fn({
        event: {
          data: {
            chatId: "chat-sub-mcp-collision",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
            subagentsEnabled: true,
          },
        },
      });

      const streamTools = mockStreamText.mock.calls[0][0].tools;
      expect(streamTools.search).toBe(parentSearchTool);
      expect(streamTools.delegate_task).toBeDefined();
      expect(subCleanup).toHaveBeenCalled();
    });
  });

  describe("compaction attachment & context budget handling", () => {
    it("retains pre-compaction file attachments for get_file_url while keeping vision validation scoped to activeMessages", async () => {
      mockResolveProvider.mockResolvedValueOnce({
        modelId: "text-only-model",
        modelRow: {
          capTools: true,
          capVision: false,
          contextWindow: 128_000,
        },
        sdkProvider: { chat: vi.fn(() => "model") },
      });

      mockLoadChatContext.mockResolvedValueOnce({
        servers: [],
        subagentServers: [],
        linkedSubagents: [],
        activeKbIds: [],
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        agentRow: null,
        userMemories: [],
      });

      mockLoadThread.mockResolvedValueOnce([
        {
          id: "u-old",
          role: "user",
          content: "See attachment",
          attachments: [
            {
              name: "old-doc.pdf",
              key: "files/old-doc.pdf",
              type: "file",
            },
            {
              name: "old-img.png",
              key: "files/old-img.png",
              type: "image",
            },
          ],
          metadata: null,
        },
        {
          id: "cp-1",
          role: "system",
          content: "Summary mentioning old-doc.pdf",
          attachments: [],
          metadata: JSON.stringify({ compaction: { compactedCount: 1 } }),
        },
        {
          id: "u-new",
          role: "user",
          content: "Open old-doc.pdf again",
          attachments: [],
          metadata: null,
        },
      ]);

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Done" };
        })(),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
      });

      const fn = (generateChatResponse as any).fn;
      await fn({
        event: {
          data: {
            chatId: "chat-compact-att",
            userId: "user-1",
            userMessageId: "u-new",
            model: "text-only-model",
          },
        },
      });

      const streamTools = mockStreamText.mock.calls[0][0].tools;
      expect(streamTools.get_file_url).toBeDefined();
      expect(buildSystemPrompt).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        false,
        expect.objectContaining({
          attachmentNames: expect.arrayContaining(["old-doc.pdf", "old-img.png"]),
        }),
      );
    });

    it("counts compactionSummary tokens against context budget for auto-compaction trigger", async () => {
      mockResolveProvider.mockResolvedValueOnce({
        modelId: "small-window-model",
        modelRow: {
          capTools: true,
          capVision: false,
          // 0.85 * 100 = 85 tokens budget
          contextWindow: 100,
        },
        sdkProvider: { chat: vi.fn(() => "model") },
      });

      mockLoadChatContext.mockResolvedValueOnce({
        servers: [],
        subagentServers: [],
        linkedSubagents: [],
        activeKbIds: [],
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        agentRow: null,
        userMemories: [],
      });

      // Summary is ~60 tokens (240 chars), activeMessages is ~40 tokens (160 chars).
      // Active alone (40 <= 85) wouldn't compact, but combined (40 + 60 = 100 > 85) triggers compaction!
      mockLoadThread.mockResolvedValueOnce([
        {
          id: "cp-1",
          role: "system",
          content: "S".repeat(240),
          attachments: [],
          metadata: JSON.stringify({ compaction: { compactedCount: 1 } }),
        },
        {
          id: "u-1",
          role: "user",
          content: "A".repeat(60),
          attachments: [],
          metadata: null,
        },
        {
          id: "a-1",
          role: "assistant",
          content: "B".repeat(60),
          attachments: [],
          metadata: null,
        },
        {
          id: "u-2",
          role: "user",
          content: "C".repeat(40),
          attachments: [],
          metadata: null,
        },
      ]);

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Ok" };
        })(),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
      });

      const fn = (generateChatResponse as any).fn;
      await fn({
        event: {
          data: {
            chatId: "chat-compact-budget",
            userId: "user-1",
            userMessageId: "u-2",
            model: "small-window-model",
          },
        },
      });

      // Auto-compaction was attempted (and in this unit test without mocked db/generateText,
      // fell back gracefully to truncation with warning log)
      expect(mockLog.warn).toHaveBeenCalledWith(
        "Auto-compaction failed, falling back to truncation: {error}",
        expect.any(Object),
      );
      // And prepareChatMessages trimmed history within (maxContextTokens - summaryTokens)
      const passedMessages = mockStreamText.mock.calls[0][0].messages;
      expect(passedMessages).toHaveLength(1);
      expect(passedMessages[0].content).toBe("C".repeat(40));
    });

    it("updates compactionSummary and emits compacted when auto-compaction succeeds", async () => {
      vi.mocked(compactChatThread).mockResolvedValueOnce({
        message: { id: "cp-new" } as any,
        compactedCount: 3,
        originalTokens: 100,
        compactedTokens: 10,
        summary: "Fresh compacted summary",
      });

      mockResolveProvider.mockResolvedValueOnce({
        modelId: "small-window-model",
        modelRow: {
          capTools: true,
          capVision: false,
          contextWindow: 100,
        },
        sdkProvider: { chat: vi.fn(() => "model") },
      });

      mockLoadChatContext.mockResolvedValueOnce({
        servers: [],
        subagentServers: [],
        linkedSubagents: [],
        activeKbIds: [],
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        agentRow: null,
        userMemories: [],
      });

      mockLoadThread.mockResolvedValueOnce([
        {
          id: "u-1",
          role: "user",
          content: "A".repeat(200),
          attachments: [],
          metadata: null,
        },
        {
          id: "a-1",
          role: "assistant",
          content: "B".repeat(200),
          attachments: [],
          metadata: null,
        },
        {
          id: "u-2",
          role: "user",
          content: "Latest",
          attachments: [],
          metadata: null,
        },
      ]);

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Ok" };
        })(),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
      });

      const fn = (generateChatResponse as any).fn;
      await fn({
        event: {
          data: {
            chatId: "chat-compact-ok",
            userId: "user-1",
            userMessageId: "u-2",
            model: "small-window-model",
          },
        },
      });

      expect(buildSystemPrompt).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        false,
        expect.objectContaining({
          compactionSummary: "Fresh compacted summary",
        }),
      );
      expect(inngest.realtime.publish).toHaveBeenCalledWith(
        expect.anything(),
        { type: "compacted" },
      );
    });

    it("logs stringified error when auto-compaction throws a non-Error value", async () => {
      vi.mocked(compactChatThread).mockRejectedValueOnce("string-compaction-err");

      mockResolveProvider.mockResolvedValueOnce({
        modelId: "small-window-model",
        modelRow: { capTools: true, capVision: false, contextWindow: 100 },
        sdkProvider: { chat: vi.fn(() => "model") },
      });

      mockLoadChatContext.mockResolvedValueOnce({
        servers: [],
        subagentServers: [],
        linkedSubagents: [],
        activeKbIds: [],
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        agentRow: null,
        userMemories: [],
      });

      mockLoadThread.mockResolvedValueOnce([
        { id: "u-1", role: "user", content: "A".repeat(200), attachments: [], metadata: null },
        { id: "a-1", role: "assistant", content: "B".repeat(200), attachments: [], metadata: null },
        { id: "u-2", role: "user", content: "Latest", attachments: [], metadata: null },
      ]);

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Ok" };
        })(),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
      });

      const fn = (generateChatResponse as any).fn;
      await fn({
        event: {
          data: {
            chatId: "chat-compact-non-err",
            userId: "user-1",
            userMessageId: "u-2",
            model: "small-window-model",
          },
        },
      });

      expect(mockLog.warn).toHaveBeenCalledWith(
        "Auto-compaction failed, falling back to truncation: {error}",
        { error: "string-compaction-err" },
      );
    });

    it("skips auto-compaction when activeMessages.length > 2 but combined tokens fit within budget", async () => {
      vi.mocked(compactChatThread).mockClear();

      mockResolveProvider.mockResolvedValueOnce({
        modelId: "large-window-model",
        modelRow: { capTools: true, capVision: false, contextWindow: 128_000 },
        sdkProvider: { chat: vi.fn(() => "model") },
      });

      mockLoadChatContext.mockResolvedValueOnce({
        servers: [],
        subagentServers: [],
        linkedSubagents: [],
        activeKbIds: [],
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        agentRow: null,
        userMemories: [],
      });

      mockLoadThread.mockResolvedValueOnce([
        { id: "u-1", role: "user", content: "Hi", attachments: [], metadata: null },
        { id: "a-1", role: "assistant", content: "Hello", attachments: [], metadata: null },
        { id: "u-2", role: "user", content: "How are you?", attachments: [], metadata: null },
      ]);

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Good" };
        })(),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
      });

      const fn = (generateChatResponse as any).fn;
      await fn({
        event: {
          data: {
            chatId: "chat-within-budget",
            userId: "user-1",
            userMessageId: "u-2",
            model: "large-window-model",
          },
        },
      });

      expect(compactChatThread).not.toHaveBeenCalled();
    });
  });

  describe("tool approval gate and resume loop", () => {
    it("parks pendingApprovals, skips synthesis fallback and finish on tool-approval-request", async () => {
      mockPersistResponse.mockClear();
      mockPublish.mockClear();
      mockStreamText.mockReset();

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Let me create that skill. " };
          yield {
            type: "tool-call",
            toolCallId: "tc-1",
            toolName: "create_skill",
            input: { name: "my-skill" },
          };
          yield {
            type: "tool-approval-request",
            approvalId: "app-1",
            toolCall: {
              toolCallId: "tc-1",
              toolName: "create_skill",
              input: { name: "my-skill" },
            },
            signature: "sig-1",
          };
        })(),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
        finishReason: Promise.resolve("tool-calls"),
      });

      const fn = (generateChatResponse as any).fn;
      await fn({
        event: {
          name: "chat/response.generate",
          data: {
            chatId: "chat-park",
            userId: "user-1",
            userMessageId: "msg-1",
            model: "gpt-4o",
            approvalMode: "ask",
          },
        },
      });

      // streamText should be called only once (no synthesis fallback pass)
      expect(mockStreamText).toHaveBeenCalledTimes(1);
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          toolApproval: expect.objectContaining({
            create_skill: "user-approval",
          }),
          experimental_toolApprovalSecret: expect.any(String),
        }),
      );

      // Should emit tool-approval-required, and NOT emit finish
      expect(inngest.realtime.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: "tool-approval-required",
          round: 1,
        }),
      );
      expect(inngest.realtime.publish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "finish" }),
      );

      // Should persist assistant message with pendingApprovals
      expect(mockPersistResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: "chat-park",
          content: "Let me create that skill. ",
        }),
      );
      const persistedMeta = JSON.parse(
        mockPersistResponse.mock.calls[0][0].metadata,
      );
      expect(persistedMeta.approvalRound).toBe(1);
      expect(persistedMeta.parentUserMessageId).toBe("msg-1");
      expect(persistedMeta.pendingApprovals).toHaveLength(1);
      expect(persistedMeta.pendingApprovals[0].approvalId).toBe("app-1");
    });

    it("resumes on chat/approval.respond, preserves Round 1 state, injects denial policy note, and updates DB", async () => {
      mockUpdateResponse.mockClear();
      mockPublish.mockClear();
      mockStreamText.mockReset();

      mockDbSelectLimit
        .mockResolvedValueOnce([
          {
            content: "Round 1 text. ",
            parentId: "u-1",
            metadata: JSON.stringify({
              model: "gpt-4o",
              reasoning: "Round 1 reasoning. ",
              toolCalls: [
                {
                  toolCallId: "tc-auto",
                  toolName: "save_memory",
                  args: { content: "x" },
                },
              ],
              toolResults: [
                {
                  toolCallId: "tc-auto",
                  toolName: "save_memory",
                  result: { saved: true },
                },
              ],
              approvalRound: 1,
              parentUserMessageId: "u-1",
              pendingApprovals: [
                {
                  approvalId: "app-deny",
                  toolCallId: "tc-skill",
                  toolName: "create_skill",
                  args: { name: "bad" },
                  signature: "sig-deny",
                },
              ],
            }),
          },
        ])
        .mockResolvedValueOnce([
          {
            metadata: JSON.stringify({
              model: "gpt-4o",
              approvalMode: "ask",
            }),
          },
        ]);

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "tool-output-denied", toolCallId: "tc-skill", toolName: "create_skill" };
          yield { type: "text-delta", text: "Understood, skipping." };
        })(),
        usage: Promise.resolve({ inputTokens: 20, outputTokens: 10 }),
        finishReason: Promise.resolve("stop"),
      });

      const fn = (generateChatResponse as any).fn;
      await fn({
        event: {
          name: "chat/approval.respond",
          data: {
            chatId: "chat-resume",
            userId: "user-1",
            assistantMessageId: "asst-parked",
            decisions: [{ approvalId: "app-deny", approved: false }],
          },
        },
      });

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: expect.stringContaining("## Tool Approval Policy"),
        }),
      );
      expect(mockUpdateResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: "asst-parked",
          chatId: "chat-resume",
          content: "Round 1 text. Understood, skipping.",
        }),
      );
      const updatedMeta = JSON.parse(
        mockUpdateResponse.mock.calls[0][0].metadata,
      );
      expect(updatedMeta.reasoning).toBe("Round 1 reasoning. ");
      expect(updatedMeta.toolCalls).toHaveLength(1);
      expect(updatedMeta.pendingApprovals).toBeUndefined();
      expect(inngest.realtime.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "finish" }),
      );
    });

    it("returns early on chat/approval.respond when parked message is missing or has no pendingApprovals", async () => {
      mockStreamText.mockReset();
      mockDbSelectLimit.mockResolvedValueOnce([]);

      const fn = (generateChatResponse as any).fn;
      await fn({
        event: {
          name: "chat/approval.respond",
          data: {
            chatId: "chat-missing",
            userId: "user-1",
            assistantMessageId: "asst-none",
            decisions: [],
          },
        },
      });

      expect(mockStreamText).not.toHaveBeenCalled();
    });

    it("updates existing assistant message when a resumed turn pauses for another approval round", async () => {
      mockUpdateResponse.mockClear();
      mockStreamText.mockReset();

      mockDbSelectLimit
        .mockResolvedValueOnce([
          {
            content: "Round 1 ",
            parentId: "u-1",
            metadata: JSON.stringify({
              model: "gpt-4o",
              approvalRound: 1,
              parentUserMessageId: "u-1",
              pendingApprovals: [
                {
                  approvalId: "app-1",
                  toolCallId: "tc-1",
                  toolName: "create_skill",
                  args: {},
                  signature: "sig-1",
                },
              ],
            }),
          },
        ])
        .mockResolvedValueOnce([{ metadata: JSON.stringify({ model: "gpt-4o" }) }]);

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield {
            type: "tool-approval-request",
            approvalId: "app-2",
            toolCall: {
              toolCallId: "tc-2",
              toolName: "write_skill_file",
              input: {},
            },
            signature: "sig-2",
          };
        })(),
        usage: Promise.resolve({}),
        finishReason: Promise.resolve("tool-calls"),
      });

      const fn = (generateChatResponse as any).fn;
      await fn({
        event: {
          name: "chat/approval.respond",
          data: {
            chatId: "chat-round-2",
            userId: "user-1",
            assistantMessageId: "asst-2",
            decisions: [{ approvalId: "app-1", approved: true }],
          },
        },
      });

      expect(mockUpdateResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: "asst-2",
          chatId: "chat-round-2",
        }),
      );
      const meta = JSON.parse(mockUpdateResponse.mock.calls[0][0].metadata);
      expect(meta.approvalRound).toBe(2);
      expect(meta.pendingApprovals[0].approvalId).toBe("app-2");
    });

    it("covers parked null content, missing userMessageId, missing model fallback, server autoApprovedTools, and wrapSubagentTools persistence", async () => {
      mockStreamText.mockReset();
      mockUpdateResponse.mockClear();
      mockPersistResponse.mockClear();

      // 1. Missing userMessageId everywhere -> early return
      mockDbSelectLimit.mockResolvedValueOnce([
        {
          content: null,
          parentId: null,
          metadata: JSON.stringify({
            pendingApprovals: [
              {
                approvalId: "app-x",
                toolCallId: "tc-x",
                toolName: "create_skill",
                args: {},
                signature: "sig-x",
              },
            ],
          }),
        },
      ]);

      const fn = (generateChatResponse as any).fn;
      await fn({
        event: {
          name: "chat/approval.respond",
          data: {
            chatId: "chat-no-user-msg",
            userId: "user-1",
            assistantMessageId: "asst-no-user-msg",
            decisions: [{ approvalId: "app-x", approved: true }],
          },
        },
      });
      expect(mockStreamText).not.toHaveBeenCalled();

      // 2. Parked null content, parentId fallback, userMeta/parked model both null, and subagent server autoApprovedTools + wrapSubagentTools
      mockLoadChatContext.mockResolvedValueOnce({
        servers: [
          {
            id: "srv-1",
            name: "GitHub",
            url: "https://example.com/mcp",
            autoApprovedTools: ["list_repos"],
          },
        ],
        subagentServers: undefined as any,
        linkedSubagents: [],
        activeKbIds: [],
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        agentRow: null,
        userMemories: [],
      });

      mockDbSelectLimit
        .mockResolvedValueOnce([
          {
            content: null,
            parentId: "u-fallback",
            metadata: JSON.stringify({
              approvalRound: 1,
              pendingApprovals: [
                {
                  approvalId: "app-fb",
                  toolCallId: "tc-fb",
                  toolName: "create_skill",
                  args: {},
                  signature: "sig-fb",
                },
              ],
            }),
          },
        ])
        .mockResolvedValueOnce([
          { metadata: JSON.stringify({ subagentsEnabled: true }) },
        ]);

      let capturedTools: Record<string, any> | undefined;
      mockStreamText.mockImplementationOnce((cfg: any) => {
        capturedTools = cfg.tools;
        return {
          fullStream: (async function* () {
            yield { type: "text-delta", text: "ok" };
          })(),
          usage: Promise.resolve({}),
          finishReason: Promise.resolve("stop"),
        };
      });

      await fn({
        event: {
          name: "chat/approval.respond",
          data: {
            chatId: "chat-fb",
            userId: "user-1",
            assistantMessageId: "asst-fb",
            subagentsEnabled: true,
            decisions: [{ approvalId: "app-fb", approved: true }],
          },
        },
      });

      expect(capturedTools?.delegate_task).toBeDefined();

      // 3. Exercise wrapSubagentTools callback (both update=false -> persist, and update=true)
      const { buildOrchestratorToolSet } = await import(
        "@/lib/inngest/chat-response/tool-set-builder"
      );
      const { chatApprovalRegistry } = await import(
        "@/lib/chat/chat-approval-registry"
      );
      const lastCallArgs =
        vi.mocked(buildOrchestratorToolSet).mock.calls.at(-1)?.[0];
      expect(lastCallArgs?.wrapSubagentTools).toBeDefined();

      mockUpdateResponse.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const subExec = vi.fn().mockResolvedValue("sub-ok");
      const wrapped = lastCallArgs!.wrapSubagentTools!(
        { create_skill: { execute: subExec } },
        { id: "sub-1", name: "Researcher" } as any,
      );

      // Trigger first subagent approval batch (updateAssistantResponse returns false -> persistAssistantResponse)
      mockPersistResponse.mockClear();
      vi.mocked(inngest.realtime.publish).mockClear();
      const p1 = wrapped.create_skill.execute({}, { toolCallId: "tc-sub-1" });
      await vi.waitFor(() => {
        expect(inngest.realtime.publish).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ type: "tool-approval-required" }),
        );
      });
      const firstEmitCall = vi
        .mocked(inngest.realtime.publish)
        .mock.calls.filter((c) => (c[1] as any)?.type === "tool-approval-required")
        .at(-1);
      const appId1 = (firstEmitCall?.[1] as any).approvals[0].approvalId;
      expect(
        chatApprovalRegistry.resolve("asst-fb", [
          { approvalId: appId1, approved: true },
        ]),
      ).toBe(true);
      await expect(p1).resolves.toBe("sub-ok");
      expect(mockPersistResponse).toHaveBeenCalledTimes(1);

      // Trigger second subagent approval batch (updateAssistantResponse returns true -> skips persistAssistantResponse)
      mockPersistResponse.mockClear();
      vi.mocked(inngest.realtime.publish).mockClear();
      const p2 = wrapped.create_skill.execute({}, { toolCallId: "tc-sub-2" });
      await vi.waitFor(() => {
        expect(inngest.realtime.publish).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ type: "tool-approval-required" }),
        );
      });
      const secondEmitCall = vi
        .mocked(inngest.realtime.publish)
        .mock.calls.filter((c) => (c[1] as any)?.type === "tool-approval-required")
        .at(-1);
      const appId2 = (secondEmitCall?.[1] as any).approvals[0].approvalId;
      expect(
        chatApprovalRegistry.resolve("asst-fb", [
          { approvalId: appId2, approved: true },
        ]),
      ).toBe(true);
      await expect(p2).resolves.toBe("sub-ok");
      expect(mockPersistResponse).not.toHaveBeenCalled();

      // 4. Cover undefined ctx.servers in buildAutoApprovedMcpToolsMap
      mockLoadChatContext.mockResolvedValueOnce({
        servers: undefined as any,
        subagentServers: [{ id: "srv-sub", autoApprovedTools: ["t1"] }] as any,
        linkedSubagents: [],
        activeKbIds: [],
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        selectedSkills: [],
        projectRow: null,
        agentRow: null,
        userMemories: [],
      });
      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "ok" };
        })(),
        usage: Promise.resolve({}),
        finishReason: Promise.resolve("stop"),
      });
      await fn({
        event: {
          name: "chat/response.generate",
          data: {
            chatId: "chat-undef-servers",
            userId: "user-1",
            userMessageId: "u-undef",
            model: "gpt-4o",
          },
        },
      });
    });
  });
});


