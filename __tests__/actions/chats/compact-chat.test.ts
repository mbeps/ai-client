import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.hoisted(() => vi.fn());
const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockLoadThreadFromDb = vi.hoisted(() => vi.fn());
const mockResolveProvider = vi.hoisted(() => vi.fn());
const mockResolveDefaultChatProvider = vi.hoisted(() => vi.fn());
const mockCompactChatThread = vi.hoisted(() => vi.fn());
const mockMapMessageFromDb = vi.hoisted(() => vi.fn((m) => ({ ...m, mapped: true })));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockSelectLimit,
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/chat/load-thread-from-db", () => ({
  loadThreadFromDb: mockLoadThreadFromDb,
}));

vi.mock("@/lib/chat/resolve-provider", () => ({
  resolveProvider: mockResolveProvider,
}));

vi.mock("@/lib/chat/resolve-default-chat-provider", () => ({
  resolveDefaultChatProvider: mockResolveDefaultChatProvider,
}));

vi.mock("@/lib/chat/compact-chat-thread", () => ({
  compactChatThread: mockCompactChatThread,
}));

vi.mock("@/lib/chat/map-message-from-db", () => ({
  mapMessageFromDb: mockMapMessageFromDb,
}));

import { compactChat } from "@/actions/chats/compact-chat";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";

const VALID_CHAT_ID = "00000000-0000-4000-8000-000000000001";

describe("compactChat action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } });
    mockLoadThreadFromDb.mockResolvedValue([
      { id: "m1", role: "user", content: "hi" },
      { id: "m2", role: "assistant", content: "hello" },
    ]);
    mockResolveProvider.mockResolvedValue({ modelId: "selected-model" });
    mockResolveDefaultChatProvider.mockResolvedValue({ modelId: "default-model" });
    mockCompactChatThread.mockResolvedValue({
      message: { id: "cp-1", role: "system", content: "summary" },
      compactedCount: 2,
      originalTokens: 100,
      compactedTokens: 20,
      summary: "summary",
    });
  });

  it("returns INVALID_INPUT when payload fails schema validation", async () => {
    const res = await compactChat({ chatId: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
    }
  });

  it("returns NOT_FOUND when chat does not exist", async () => {
    mockSelectLimit.mockResolvedValueOnce([]);
    const res = await compactChat({ chatId: VALID_CHAT_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.NOT_FOUND);
    }
  });

  it("returns INVALID_INPUT when chat has no currentLeafId", async () => {
    mockSelectLimit.mockResolvedValueOnce([{ id: VALID_CHAT_ID, currentLeafId: null }]);
    const res = await compactChat({ chatId: VALID_CHAT_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      expect(res.error.message).toBe("No Messages To Compact");
    }
  });

  it("uses resolveProvider when modelId is provided and passes expectedLeafId", async () => {
    mockSelectLimit.mockResolvedValueOnce([{ id: VALID_CHAT_ID, currentLeafId: "m2" }]);
    const res = await compactChat({ chatId: VALID_CHAT_ID, modelId: "claude-3-7" });

    expect(mockResolveProvider).toHaveBeenCalledWith("user-1", "claude-3-7");
    expect(mockResolveDefaultChatProvider).not.toHaveBeenCalled();
    expect(mockCompactChatThread).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: VALID_CHAT_ID,
        userId: "user-1",
        resolved: { modelId: "selected-model" },
        auto: false,
        expectedLeafId: "m2",
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.compactedCount).toBe(2);
    }
  });

  it("falls back to resolveDefaultChatProvider when modelId is omitted", async () => {
    mockSelectLimit.mockResolvedValueOnce([{ id: VALID_CHAT_ID, currentLeafId: "m2" }]);
    const res = await compactChat({ chatId: VALID_CHAT_ID });

    expect(mockResolveDefaultChatProvider).toHaveBeenCalledWith("user-1");
    expect(mockResolveProvider).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });

  it("propagates AppException from compactChatThread as fail(error)", async () => {
    mockSelectLimit.mockResolvedValueOnce([{ id: VALID_CHAT_ID, currentLeafId: "m2" }]);
    mockCompactChatThread.mockRejectedValueOnce(
      new AppException({
        code: ERROR_CODE.CONFLICT,
        message: "Chat thread changed during compaction. Please retry.",
      }),
    );

    const res = await compactChat({ chatId: VALID_CHAT_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.CONFLICT);
    }
  });

  it("converts unexpected non-AppException errors via defineAction", async () => {
    mockSelectLimit.mockResolvedValueOnce([{ id: VALID_CHAT_ID, currentLeafId: "m2" }]);
    mockCompactChatThread.mockRejectedValueOnce(new Error("Unexpected DB error"));

    const res = await compactChat({ chatId: VALID_CHAT_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INTERNAL);
    }
  });
});
