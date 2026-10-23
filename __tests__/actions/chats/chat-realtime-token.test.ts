import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["select", "from", "where"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User" },
    session: { id: "session-1" },
  }),
}));

vi.mock("inngest/react", () => ({
  getClientSubscriptionToken: vi.fn().mockResolvedValue("mock-chat-token"),
}));

import { getChatRealtimeToken } from "@/actions/chats/chat-realtime-token";

describe("Chat Realtime Token Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getChatRealtimeToken", () => {
    it("throws an error when user is unauthorized or chat does not belong to user", async () => {
      chainable.where.mockResolvedValueOnce([]);

      await expect(getChatRealtimeToken("chat-123")).rejects.toThrow(
        "Chat not found or access denied",
      );
    });

    it("returns subscription token when chat is owned by user", async () => {
      chainable.where.mockResolvedValueOnce([{ id: "chat-123" }]);

      const token = await getChatRealtimeToken("chat-123");
      expect(token).toBe("mock-chat-token");
    });
  });
});

