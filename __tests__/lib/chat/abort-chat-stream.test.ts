import { describe, expect, it, vi, beforeEach } from "vitest";
import { abortChatStream } from "@/lib/chat/abort-chat-stream";
import { chatAbortRegistry } from "@/lib/chat/chat-abort-registry";
import { inngest } from "@/lib/inngest/client";

vi.mock("@/lib/chat/chat-abort-registry", () => ({
  chatAbortRegistry: {
    abort: vi.fn(() => true),
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    realtime: {
      publish: vi.fn().mockResolvedValue({}),
    },
    send: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("abortChatStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aborts active stream locally, publishes finish to realtime, and sends cancel event", async () => {
    const aborted = await abortChatStream("chat-123", "user-456");

    expect(aborted).toBe(true);
    expect(chatAbortRegistry.abort).toHaveBeenCalledWith("chat-123");
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "stream" }),
      { type: "finish", finishReason: "stop" },
    );
    expect(inngest.send).toHaveBeenCalledWith({
      name: "chat/response.cancel",
      data: { chatId: "chat-123", userId: "user-456" },
    });
  });

  it("handles realtime and inngest publish failures gracefully without throwing", async () => {
    vi.mocked(inngest.realtime.publish).mockRejectedValueOnce(new Error("Socket error"));
    vi.mocked(inngest.send).mockRejectedValueOnce(new Error("Inngest down"));

    const aborted = await abortChatStream("chat-123", "user-456");

    expect(aborted).toBe(true);
    expect(chatAbortRegistry.abort).toHaveBeenCalledWith("chat-123");
  });
});
