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

import {
  getChatRealtimeToken,
  triggerChatResponseAction,
} from "@/actions/chats/chat-realtime-token";
import { inngest } from "@/lib/inngest/client";

describe("Chat Realtime Token & Trigger Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getChatRealtimeToken", () => {
    it("throws an error when user is unauthorized or chat does not belong to user", async () => {
      chainable.where.mockResolvedValueOnce([]);

      await expect(getChatRealtimeToken("chat-123")).rejects.toThrow(
        "Unauthorized",
      );
    });

    it("returns subscription token when chat is owned by user", async () => {
      chainable.where.mockResolvedValueOnce([{ id: "chat-123" }]);

      const token = await getChatRealtimeToken("chat-123");
      expect(token).toBe("mock-chat-token");
    });
  });

  describe("triggerChatResponseAction", () => {
    it("throws an error when chat is not found or access is denied", async () => {
      chainable.where.mockResolvedValueOnce([]);

      await expect(
        triggerChatResponseAction({
          chatId: "chat-123",
          userMessageId: "msg-123",
        }),
      ).rejects.toThrow("Chat not found or access denied");
    });

    it("dispatches chat/response.generate event to Inngest when valid", async () => {
      chainable.where.mockResolvedValueOnce([{ id: "chat-123" }]);

      const result = await triggerChatResponseAction({
        chatId: "chat-123",
        userMessageId: "msg-123",
        model: "openai/gpt-4o",
        selectedServerIds: ["srv-1"],
      });

      expect(result).toEqual({ success: true });
      expect(inngest.send).toHaveBeenCalledWith({
        name: "chat/response.generate",
        data: {
          chatId: "chat-123",
          userId: "user-1",
          userMessageId: "msg-123",
          model: "openai/gpt-4o",
          selectedServerIds: ["srv-1"],
          selectedTools: undefined,
          selectedAssistantId: undefined,
          selectedSkillIds: undefined,
          selectedKbIds: undefined,
        },
      });
    });
  });
});

