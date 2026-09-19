import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPublish = vi.hoisted(() => vi.fn());
const mockPersistResponse = vi.hoisted(() => vi.fn());
const mockResolveProvider = vi.hoisted(() => vi.fn());
const mockLoadChatContext = vi.hoisted(() => vi.fn());
const mockLoadThread = vi.hoisted(() => vi.fn());
const mockStreamText = vi.hoisted(() => vi.fn());

vi.mock("@/actions/user-settings/get-user-settings", () => ({
  getUserSettings: vi.fn().mockResolvedValue(null),
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
}));

import { generateChatResponse } from "@/lib/inngest/functions/chat-response";
import { inngest } from "@/lib/inngest/client";

describe("generateChatResponse Inngest Function", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
});

