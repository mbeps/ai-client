import { describe, expect, it, vi } from "vitest";
import {
  applySyncedAssistantMessage,
  findMatchingAssistantMessage,
  handleSyncError,
  hasValidSyncTarget,
  isAccessOrNotFoundError,
  isChatInStore,
  resolveSyncTargetParentId,
} from "@/hooks/chat/stream/use-stream-db-sync";
import { ERROR_CODE } from "@/lib/error/error-code";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/lib/store/use-app-store";

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
  getLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe("use-stream-db-sync utilities", () => {
  describe("isAccessOrNotFoundError", () => {
    it("returns false for falsy or undefined values", () => {
      expect(isAccessOrNotFoundError(null)).toBe(false);
      expect(isAccessOrNotFoundError(undefined)).toBe(false);
      expect(isAccessOrNotFoundError("")).toBe(false);
      expect(isAccessOrNotFoundError("Not Found")).toBe(true);
      expect(isAccessOrNotFoundError("unknown error")).toBe(false);
    });

    it("identifies code property directly on error object", () => {
      expect(isAccessOrNotFoundError({ code: ERROR_CODE.NOT_FOUND })).toBe(true);
      expect(isAccessOrNotFoundError({ code: ERROR_CODE.UNAUTHORIZED })).toBe(true);
      expect(isAccessOrNotFoundError({ code: ERROR_CODE.FORBIDDEN })).toBe(true);
      expect(isAccessOrNotFoundError({ code: "INTERNAL" })).toBe(false);
    });

    it("identifies code nested under error.error", () => {
      expect(
        isAccessOrNotFoundError({
          error: { code: ERROR_CODE.NOT_FOUND },
        }),
      ).toBe(true);
      expect(
        isAccessOrNotFoundError({
          error: { code: ERROR_CODE.UNAUTHORIZED },
        }),
      ).toBe(true);
      expect(
        isAccessOrNotFoundError({
          error: { code: ERROR_CODE.FORBIDDEN },
        }),
      ).toBe(true);
      expect(
        isAccessOrNotFoundError({
          error: { code: "OTHER" },
        }),
      ).toBe(false);
    });

    it("matches standard message strings and patterns", () => {
      expect(isAccessOrNotFoundError(new Error("Not Found"))).toBe(true);
      expect(isAccessOrNotFoundError(new Error("Unauthorized"))).toBe(true);
      expect(isAccessOrNotFoundError(new Error("access denied"))).toBe(true);
      expect(isAccessOrNotFoundError(new Error("database constraint failed"))).toBe(false);
      expect(isAccessOrNotFoundError({ message: "404 Not Found" })).toBe(true);
      expect(isAccessOrNotFoundError({ message: "unrelated error" })).toBe(false);
    });
  });

  describe("isChatInStore", () => {
    it("returns true when chatId is in store, false otherwise", () => {
      useAppStore.setState({
        chats: {
          "chat-1": { id: "chat-1", messages: {} } as any,
        },
      });
      expect(isChatInStore("chat-1")).toBe(true);
      expect(isChatInStore("chat-unknown")).toBe(false);
      expect(isChatInStore("")).toBe(false);
    });
  });

  describe("resolveSyncTargetParentId", () => {
    it("returns pending user message id when supplied", () => {
      expect(resolveSyncTargetParentId("user-1", undefined)).toBe("user-1");
    });

    it("returns activeLeaf id when leaf is present", () => {
      expect(
        resolveSyncTargetParentId(null, {
          id: "leaf-msg-1",
        }),
      ).toBe("leaf-msg-1");
    });

    it("returns undefined when activeLeaf is undefined", () => {
      expect(resolveSyncTargetParentId(null, undefined)).toBeUndefined();
    });
  });

  describe("hasValidSyncTarget", () => {
    it("returns true when assistantId or targetParentId is defined", () => {
      expect(hasValidSyncTarget("asst-1", undefined)).toBe(true);
      expect(hasValidSyncTarget(null, "user-1")).toBe(true);
      expect(hasValidSyncTarget(null, undefined)).toBe(false);
    });
  });

  describe("findMatchingAssistantMessage", () => {
    it("finds message by assistantMessageId directly", () => {
      const messages = [
        { id: "msg-1", role: "assistant", parentId: "u-1", content: "hi" },
        { id: "msg-2", role: "assistant", parentId: "u-2", content: "there" },
      ];
      expect(findMatchingAssistantMessage(messages as any, "msg-2", null)).toEqual(
        messages[1],
      );
    });

    it("finds message by parentId when assistantId is null", () => {
      const messages = [
        { id: "msg-1", role: "assistant", parentId: "u-1", content: "hi" },
        { id: "msg-2", role: "assistant", parentId: "u-2", content: "there" },
      ];
      expect(findMatchingAssistantMessage(messages as any, null, "u-1")).toEqual(
        messages[0],
      );
    });

    it("falls back to first assistant message when neither assistantId nor parentId is provided", () => {
      const messages = [
        { id: "msg-1", role: "assistant", parentId: "u-1", content: "hi" },
      ];
      expect(findMatchingAssistantMessage(messages as any, null, null)).toEqual(
        messages[0],
      );
    });

    it("returns undefined when no message matches", () => {
      const messages = [
        { id: "msg-1", role: "user", parentId: null, content: "hi" },
      ];
      expect(findMatchingAssistantMessage(messages as any, "none", "u-none")).toBeUndefined();
    });
  });

  describe("handleSyncError", () => {
    it("suppresses error logging when error is access or not found", () => {
      vi.clearAllMocks();
      const setChatNotFound = vi.fn();
      const resetStreamingState = vi.fn();
      handleSyncError(new Error("Not Found"), setChatNotFound, resetStreamingState);
      expect(setChatNotFound).toHaveBeenCalledWith(true);
      expect(resetStreamingState).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("logs error when error is unexpected", () => {
      vi.clearAllMocks();
      const setChatNotFound = vi.fn();
      const resetStreamingState = vi.fn();
      const err = new Error("Database network crash");
      handleSyncError(err, setChatNotFound, resetStreamingState);
      expect(logger.error).toHaveBeenCalledWith("Failed to sync chat from DB", err);
    });
  });

  describe("applySyncedAssistantMessage", () => {
    it("applies full chat and invokes onDone callback when provided", () => {
      const upsertChat = vi.fn();
      const onDone = vi.fn();
      const fakeData = {
        chat: { id: "chat-1", title: "Test", userId: "u1" },
        messages: [],
        attachments: [],
      };

      applySyncedAssistantMessage(
        "chat-1",
        fakeData as any,
        { content: "Hello world" },
        upsertChat,
        onDone,
      );

      expect(upsertChat).toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledWith("Hello world");
    });

    it("applies full chat without onDone callback", () => {
      const upsertChat = vi.fn();
      const fakeData = {
        chat: { id: "chat-1", title: "Test", userId: "u1" },
        messages: [],
        attachments: [],
      };

      applySyncedAssistantMessage(
        "chat-1",
        fakeData as any,
        { content: "Hello world" },
        upsertChat,
      );

      expect(upsertChat).toHaveBeenCalled();
    });
  });
});
