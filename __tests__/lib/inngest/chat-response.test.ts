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

import { generateChatResponse } from "@/lib/inngest/functions/chat-response";
import { inngest } from "@/lib/inngest/client";

describe("generateChatResponse Inngest Function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserSettings.mockResolvedValue(null);

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
    mockStreamText.mockReturnValue({
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
      finishReason: new Promise((_, reject) => {
        queueMicrotask(() => reject(new Error("Finish reason failed")));
      }),
      usage: new Promise((_, reject) => {
        queueMicrotask(() => reject(new Error("Usage failed")));
      }),
    });

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
});

