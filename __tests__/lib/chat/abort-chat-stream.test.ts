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

const { logWarn } = vi.hoisted(() => ({ logWarn: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: logWarn,
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logger: {
    info: vi.fn(),
    warn: logWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("abortChatStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks clears implementations set with mockResolvedValue in the
    // factory, so restore the happy-path defaults explicitly.
    vi.mocked(inngest.realtime.publish).mockResolvedValue({});
    vi.mocked(inngest.send).mockResolvedValue({});
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

  it("stringifies a non-Error realtime rejection", async () => {
    vi.mocked(inngest.realtime.publish).mockRejectedValueOnce("realtime-string-failure");

    const aborted = await abortChatStream("chat-123", "user-456");

    expect(aborted).toBe(true);
    expect(logWarn).toHaveBeenCalledWith(
      "Failed to publish stop to Realtime: {err}",
      { err: "realtime-string-failure" },
    );
  });

  it("stringifies a non-Error Inngest send rejection", async () => {
    vi.mocked(inngest.send).mockRejectedValueOnce("inngest-string-failure");

    const aborted = await abortChatStream("chat-123", "user-456");

    expect(aborted).toBe(true);
    expect(logWarn).toHaveBeenCalledWith(
      "Failed to send cancel event to Inngest: {err}",
      { err: "inngest-string-failure" },
    );
  });

  it("stringifies a plain-object rejection from both call sites", async () => {
    vi.mocked(inngest.realtime.publish).mockRejectedValueOnce({ code: 1 });
    vi.mocked(inngest.send).mockRejectedValueOnce({ code: 2, detail: "down" });

    const aborted = await abortChatStream("chat-123", "user-456");

    expect(aborted).toBe(true);
    // String({code:1}) === "[object Object]" — proves the String(err) arm ran
    // rather than the `instanceof Error` arm.
    expect(logWarn).toHaveBeenCalledWith(
      "Failed to publish stop to Realtime: {err}",
      { err: "[object Object]" },
    );
    expect(logWarn).toHaveBeenCalledWith(
      "Failed to send cancel event to Inngest: {err}",
      { err: "[object Object]" },
    );
  });

  it("logs the message of a genuine Error rejection", async () => {
    vi.mocked(inngest.realtime.publish).mockRejectedValueOnce(new Error("Socket error"));
    vi.mocked(inngest.send).mockRejectedValueOnce(new Error("Inngest down"));

    await abortChatStream("chat-123", "user-456");

    expect(logWarn).toHaveBeenCalledWith(
      "Failed to publish stop to Realtime: {err}",
      { err: "Socket error" },
    );
    expect(logWarn).toHaveBeenCalledWith(
      "Failed to send cancel event to Inngest: {err}",
      { err: "Inngest down" },
    );
  });

  it("returns false when no stream was registered locally", async () => {
    vi.mocked(chatAbortRegistry.abort).mockReturnValueOnce(false);

    const aborted = await abortChatStream("chat-123", "user-456");

    expect(aborted).toBe(false);
    expect(chatAbortRegistry.abort).toHaveBeenCalledWith("chat-123");
  });
});
