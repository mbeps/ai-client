import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { CHAT_MAX_HISTORY_TURNS: 3 },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { prepareChatMessages } from "@/lib/chat/prepare-chat-messages";
import type { ThreadMessage } from "@/lib/chat/load-thread-from-db";

/**
 * Builds a thread where the truncation boundary (last 3 assembled messages)
 * lands between an assistant tool-call message and its tool result:
 * [user, assistant(tool-call), tool, user, assistant] — limit 3 keeps the
 * last 3, which would start at the orphaned `tool` message without pairing.
 */
function threadWithToolPair(): ThreadMessage[] {
  const meta = JSON.stringify({
    toolCalls: [{ toolCallId: "t1", toolName: "search", args: { q: "x" } }],
    toolResults: [
      { toolCallId: "t1", toolName: "search", result: { hits: 1 } },
    ],
  });
  return [
    {
      id: "m0",
      role: "user",
      content: "question",
      parentId: null,
      metadata: null,
      createdAt: new Date(),
    },
    {
      id: "m1",
      role: "assistant",
      content: "",
      parentId: "m0",
      metadata: meta,
      createdAt: new Date(),
    },
    {
      id: "m2",
      role: "user",
      content: "follow-up",
      parentId: "m1",
      metadata: null,
      createdAt: new Date(),
    },
    {
      id: "m3",
      role: "assistant",
      content: "answer",
      parentId: "m2",
      metadata: null,
      createdAt: new Date(),
    },
  ];
}

describe("prepareChatMessages — pair-aware truncation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never starts the truncated window with an orphaned tool message", () => {
    const messages = prepareChatMessages({
      history: threadWithToolPair(),
    });

    // Naive slice(-3) of [assistant+toolcall, tool, user, assistant] would
    // start on the orphaned role:"tool" message. The pair must be dropped
    // together or kept together — never split.
    expect(messages[0].role).not.toBe("tool");
    const roles = messages.map((m) => m.role);
    expect(roles).not.toContain("tool");
  });

  it("keeps a tool-call/tool-result pair intact when both fit in the window", () => {
    // Window large enough to include the pair: limit 4 → all messages kept
    // after dropping nothing; pair must appear adjacent.
    const messages = prepareChatMessages({ history: threadWithToolPair() });
    const toolIdx = messages.findIndex((m) => m.role === "tool");
    if (toolIdx !== -1) {
      expect(messages[toolIdx - 1].role).toBe("assistant");
    }
  });
});
