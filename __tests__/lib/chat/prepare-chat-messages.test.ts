import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { CHAT_MAX_HISTORY_TURNS: 3 },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { prepareChatMessages } from "@/lib/chat/prepare-chat-messages";
import { logger } from "@/lib/logger";

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

  it("truncates to the most recent CHAT_MAX_HISTORY_TURNS messages", () => {
    const messages = prepareChatMessages({ history: thread(10) });

    // 10 messages, limit 3 → last 3 kept
    expect(messages).toHaveLength(3);
    expect(messages.at(-1)).toMatchObject({ content: "msg 9" });
    expect(messages[0]).toMatchObject({ content: "msg 7" });
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
    expect(logger.warn).toHaveBeenCalled();
  });

  it("does not log a warning when nothing is truncated", () => {
    prepareChatMessages({ history: thread(2) });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
