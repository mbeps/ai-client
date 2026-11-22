import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerateText = vi.hoisted(() => vi.fn());
const mockInsertValues = vi.hoisted(() => vi.fn());
const mockInsertReturning = vi.hoisted(() => vi.fn());
const mockUpdateSet = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn());
const mockUpdateReturning = vi.hoisted(() => vi.fn());

const mockTx = vi.hoisted(() => ({
  insert: vi.fn(() => ({
    values: mockInsertValues.mockReturnValue({
      returning: mockInsertReturning,
    }),
  })),
  update: vi.fn(() => ({
    set: mockUpdateSet.mockReturnValue({
      where: mockUpdateWhere.mockReturnValue({
        returning: mockUpdateReturning,
      }),
    }),
  })),
}));

vi.mock("ai", () => ({
  generateText: mockGenerateText,
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx),
    ),
  },
}));

import { compactChatThread } from "@/lib/chat/compact-chat-thread";
import { ERROR_CODE } from "@/lib/error/error-code";
import type { ThreadMessage } from "@/lib/chat/load-thread-from-db";

function makeResolved(contextWindow?: number) {
  return {
    modelId: "gpt-4o",
    modelRow: contextWindow !== undefined ? { contextWindow } : undefined,
    sdkProvider: {
      chat: vi.fn(() => "mock-chat-model"),
    },
  } as any;
}

function makeMessage(
  id: string,
  role: string,
  content: string,
  overrides: Partial<ThreadMessage> = {},
): ThreadMessage {
  return {
    id,
    chatId: "chat-1",
    parentId: null,
    role,
    content,
    metadata: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    attachments: [],
    ...overrides,
  } as any;
}

describe("compactChatThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertReturning.mockResolvedValue([
      {
        id: "checkpoint-1",
        chatId: "chat-1",
        parentId: "m2",
        role: "system",
        content: "Summary text",
        metadata: "{}",
      },
    ]);
    mockUpdateReturning.mockResolvedValue([{ id: "chat-1" }]);
  });

  it("throws INVALID_INPUT when fewer than minMessagesToCompact exist", async () => {
    await expect(
      compactChatThread({
        chatId: "chat-1",
        userId: "user-1",
        thread: [makeMessage("m1", "user", "hi")],
        resolved: makeResolved(10000),
      }),
    ).rejects.toMatchObject({
      error: { code: ERROR_CODE.INVALID_INPUT },
    });
  });

  it("compacts single-chunk thread with attachments, toolCalls, and previousSummary", async () => {
    mockGenerateText.mockResolvedValueOnce({ text: "  Compacted summary  " });

    const thread: ThreadMessage[] = [
      makeMessage("cp-0", "system", "Earlier summary", {
        metadata: JSON.stringify({ compaction: { compactedCount: 2 } }),
      }),
      makeMessage("m1", "user", "Check this file", {
        attachments: [
          { name: "report.pdf", type: "file" },
          { name: "", type: "image" },
        ] as any,
      }),
      makeMessage("m2", "assistant", "", {
        metadata: JSON.stringify({
          toolCalls: [
            { toolCallId: "tc-1", toolName: "read_file" },
            { toolCallId: "tc-2", toolName: "ping" },
            { toolCallId: "tc-3", toolName: "empty" },
          ],
          toolResults: [
            { toolCallId: "tc-1", result: { ok: true } },
            { toolCallId: "tc-3", result: undefined },
          ],
        }),
      }),
    ];

    const result = await compactChatThread({
      chatId: "chat-1",
      userId: "user-1",
      thread,
      resolved: makeResolved(128000),
      expectedLeafId: "m2",
    });

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(result.summary).toBe("Compacted summary");
    expect(result.compactedCount).toBe(2);
    expect(result.originalTokens).toBeGreaterThan(0);
    expect(result.compactedTokens).toBeGreaterThan(0);
    expect(mockUpdateReturning).toHaveBeenCalledTimes(1);
  });

  it("summarizes all turns in bounded chronological chunks when exceeding transcript budget", async () => {
    mockGenerateText
      .mockResolvedValueOnce({ text: "Chunk 1 summary" })
      .mockResolvedValueOnce({ text: "Final combined summary" });

    // contextWindow = 200 -> maxTranscriptTokens = 140 (~560 chars per chunk)
    const thread: ThreadMessage[] = [
      makeMessage("m1", "user", "A".repeat(220)),
      makeMessage("m2", "assistant", "B".repeat(220)),
      makeMessage("m3", "user", "C".repeat(220)),
    ];

    const result = await compactChatThread({
      chatId: "chat-1",
      userId: "user-1",
      thread,
      resolved: makeResolved(200),
    });

    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    const firstPrompt = mockGenerateText.mock.calls[0][0].prompt as string;
    const secondPrompt = mockGenerateText.mock.calls[1][0].prompt as string;
    expect(firstPrompt).toContain("A".repeat(220));
    expect(secondPrompt).toContain("Chunk 1 summary");
    expect(secondPrompt).toContain("C".repeat(220));
    expect(result.summary).toBe("Final combined summary");
    expect(result.compactedCount).toBe(3);
  });

  it("throws UPSTREAM_HTTP when summary generation returns empty text", async () => {
    mockGenerateText.mockResolvedValueOnce({ text: "   " });

    await expect(
      compactChatThread({
        chatId: "chat-1",
        userId: "user-1",
        thread: [
          makeMessage("m1", "user", "hello"),
          makeMessage("m2", "assistant", "world"),
        ],
        resolved: makeResolved(undefined),
      }),
    ).rejects.toMatchObject({
      error: { code: ERROR_CODE.UPSTREAM_HTTP },
    });
  });

  it("reparents trailing user message when reparentUserMessageId is provided", async () => {
    mockGenerateText.mockResolvedValueOnce({ text: "Auto summary" });

    const thread: ThreadMessage[] = [
      makeMessage("m1", "user", "hello", { parentId: null }),
      makeMessage("m2", "assistant", "hi", { parentId: "m1" }),
      makeMessage("m3", "user", "next question", { parentId: "m2" }),
    ];

    const result = await compactChatThread({
      chatId: "chat-1",
      userId: "user-1",
      thread,
      resolved: makeResolved(128000),
      auto: true,
      reparentUserMessageId: "m3",
    });

    expect(result.compactedCount).toBe(2);
    expect(mockUpdateSet).toHaveBeenCalledWith({
      parentId: expect.any(String),
    });
    expect(mockUpdateReturning).not.toHaveBeenCalled();
  });

  it("falls back to last compacted message id when reparentUserMessageId is not found in activeMessages", async () => {
    mockGenerateText.mockResolvedValueOnce({ text: "Auto summary" });

    const thread: ThreadMessage[] = [
      makeMessage("m1", "user", "hello", { parentId: null }),
      makeMessage("m2", "assistant", "hi", { parentId: "m1" }),
    ];

    const result = await compactChatThread({
      chatId: "chat-1",
      userId: "user-1",
      thread,
      resolved: makeResolved(128000),
      auto: true,
      reparentUserMessageId: "missing-id",
    });

    expect(result.compactedCount).toBe(2);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: "m1" }),
    );
  });

  it("uses messagesToCompact.at(-1).id when trailingMsg has no parentId", async () => {
    mockGenerateText.mockResolvedValueOnce({ text: "Auto summary" });

    const thread: ThreadMessage[] = [
      makeMessage("m1", "user", "hello", { parentId: undefined as any }),
      makeMessage("m2", "assistant", "hi", { parentId: undefined as any }),
    ];

    const result = await compactChatThread({
      chatId: "chat-1",
      userId: "user-1",
      thread,
      resolved: makeResolved(128000),
      auto: true,
      reparentUserMessageId: "missing-id",
    });

    expect(result.compactedCount).toBe(2);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: "m2" }),
    );
  });

  it("throws CONFLICT and aborts transaction when expectedLeafId no longer matches", async () => {
    mockGenerateText.mockResolvedValueOnce({ text: "Summary" });
    mockUpdateReturning.mockResolvedValueOnce([]);

    await expect(
      compactChatThread({
        chatId: "chat-1",
        userId: "user-1",
        thread: [
          makeMessage("m1", "user", "hello"),
          makeMessage("m2", "assistant", "hi"),
        ],
        resolved: makeResolved(128000),
        expectedLeafId: "stale-leaf",
      }),
    ).rejects.toMatchObject({
      error: { code: ERROR_CODE.CONFLICT },
    });
  });

  it("handles reparentUserMessageId when messagesToCompact is empty and minMessagesToCompact is 0", async () => {
    const result = await compactChatThread({
      chatId: "chat-1",
      userId: "user-1",
      thread: [makeMessage("m1", "user", "only msg", { parentId: undefined as any })],
      resolved: makeResolved(128000),
      reparentUserMessageId: "m1",
      minMessagesToCompact: 0,
    });

    expect(result.compactedCount).toBe(0);
    expect(result.summary).toBe("");
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: null }),
    );
  });

  it("sets parentId to null when thread is empty and minMessagesToCompact is 0", async () => {
    const result = await compactChatThread({
      chatId: "chat-1",
      userId: "user-1",
      thread: [],
      resolved: makeResolved(128000),
      minMessagesToCompact: 0,
    });

    expect(result.compactedCount).toBe(0);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: null }),
    );
  });
});
