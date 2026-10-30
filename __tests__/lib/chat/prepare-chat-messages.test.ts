import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({
  env: { CHAT_MAX_HISTORY_TURNS: 3 },
}));

const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => mockLog),
  logger: mockLog,
}));

import {
  estimateModelMessageTokens,
  prepareChatMessages,
} from "@/lib/chat/prepare-chat-messages";

function thread(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `msg ${i}`,
  }));
}

describe("prepareChatMessages — history truncation (T4A.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("truncates to the most recent CHAT_MAX_HISTORY_TURNS messages and strips leading non-user message", () => {
    const messages = prepareChatMessages({ history: thread(10) });

    // 10 messages, limit 3 would take [m7 (asst), m8 (user), m9 (asst)].
    // Stripping leading non-user message leaves [m8 (user), m9 (asst)]
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ content: "msg 8", role: "user" });
    expect(messages.at(-1)).toMatchObject({ content: "msg 9" });
  });

  it("keeps full window when truncation boundary lands on a user message", () => {
    // 11 messages, limit 3 → [m8 (user), m9 (asst), m10 (user)]
    const messages = prepareChatMessages({ history: thread(11) });
    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatchObject({ content: "msg 8", role: "user" });
    expect(messages.at(-1)).toMatchObject({ content: "msg 10" });
  });

  it("trims oldest turn pairs when prompt exceeds maxContextTokens budget", () => {
    // 4 messages: Turn 1 (m0 user, m1 asst), Turn 2 (m2 user, m3 asst)
    // Long content on Turn 1
    const longThread: any = [
      { id: "m0", role: "user", content: "A".repeat(1000) }, // ~264 tokens
      { id: "m1", role: "assistant", content: "B".repeat(1000) }, // ~264 tokens
      { id: "m2", role: "user", content: "Short question" }, // ~4 tokens
      { id: "m3", role: "assistant", content: "Short answer" }, // ~4 tokens
    ];

    // Total tokens ~536. If maxContextTokens is 50, Turn 1 should be dropped
    const messages = prepareChatMessages({
      history: longThread,
      maxContextTokens: 50,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ content: "Short question", role: "user" });
    expect(messages[1]).toMatchObject({ content: "Short answer", role: "assistant" });
  });

  it("always retains at least the final user turn even when exceeding maxContextTokens", () => {
    const longTurn: any = [
      { id: "m0", role: "user", content: "A".repeat(500) },
      { id: "m1", role: "assistant", content: "B".repeat(500) },
      { id: "m2", role: "user", content: "Huge prompt: " + "C".repeat(2000) },
    ];

    // maxContextTokens is 10, but the final user turn must not be dropped
    const messages = prepareChatMessages({
      history: longTurn,
      maxContextTokens: 10,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("Huge prompt");
  });

  it("always keeps the last message even when limit is 1", () => {
    const messages = prepareChatMessages({ history: thread(5) });
    expect(messages.at(-1)).toMatchObject({ content: "msg 4" });
  });

  it("does not truncate when under the limit", () => {
    const messages = prepareChatMessages({ history: thread(2) });
    expect(messages).toHaveLength(2);
  });

  it("logs a warning when truncation occurs", () => {
    prepareChatMessages({ history: thread(10) });
    expect(mockLog.warn).toHaveBeenCalled();
  });

  it("does not log a warning when nothing is truncated", () => {
    prepareChatMessages({ history: thread(2) });
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it("strips leading non-user message even when thread is under the turn limit", () => {
    const threadStartingWithAssistant: any = [
      { id: "m0", role: "assistant", content: "hello from asst" },
      { id: "m1", role: "user", content: "user prompt" },
    ];

    const messages = prepareChatMessages({
      history: threadStartingWithAssistant,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
  });

  it("handles multimodal array content and tool calls when estimating budget tokens", () => {
    const complexThread: any = [
      {
        id: "m0",
        role: "user",
        content: "Explain image",
        attachments: [
          {
            id: "att-1",
            type: "image",
            url: "https://example.com/img.png",
            name: "img.png",
          },
        ],
      },
      {
        id: "m1",
        role: "assistant",
        content: "Here is answer",
        metadata: JSON.stringify({
          toolCalls: [
            { toolCallId: "tc1", toolName: "search", args: { query: "foo" } },
            { toolCallId: "tc2", toolName: "raw", args: "string-args" },
          ],
          toolResults: [
            { toolCallId: "tc1", toolName: "search", result: { hits: 1 } },
            { toolCallId: "tc2", toolName: "raw", result: "string-result" },
          ],
        }),
      },
      {
        id: "m2",
        role: "user",
        content: "Next question",
      },
    ];

    const messages = prepareChatMessages({
      history: complexThread,
      maxContextTokens: 50, // Force dropping first turn
    });

    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].role).toBe("user");
  });

  describe("estimateModelMessageTokens", () => {
    it("estimates tokens for string content", () => {
      const msg: any = { role: "user", content: "Hello world" };
      expect(estimateModelMessageTokens(msg)).toBeGreaterThan(0);
    });

    it("estimates tokens for array content containing all supported part types", () => {
      const msg: any = {
        role: "user",
        content: [
          "raw string part",
          { type: "text", text: "text part" },
          { type: "file", data: { type: "url", url: "https://example.com" }, mediaType: "image/png" },
          { type: "image", image: "https://example.com/img.png" },
          { type: "tool-call", args: { query: "search" } },
          { type: "tool-call", args: "string-query" },
          { type: "tool-result", result: { data: 123 } },
          { type: "tool-result", result: "raw result" },
          { type: "unknown", foo: "bar" },
        ],
      };

      const tokens = estimateModelMessageTokens(msg);
      // 800 + 800 for files/images plus text tokens
      expect(tokens).toBeGreaterThan(1600);
    });

    it("returns 0 for unrecognized or empty message content", () => {
      const msg: any = { role: "user", content: null };
      expect(estimateModelMessageTokens(msg)).toBe(0);
    });
  });
});
