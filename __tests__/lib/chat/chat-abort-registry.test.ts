import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatAbortRegistry } from "@/lib/chat/chat-abort-registry";

const mockLog = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => mockLog),
  logger: mockLog,
}));

/** Chat ids used across the suite; cleared after each test so the module-level
 * singleton never leaks AbortControllers between cases. */
const CHAT_IDS = ["chat-a", "chat-b", "chat-c"];

describe("chatAbortRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const id of CHAT_IDS) chatAbortRegistry.delete(id);
  });

  afterEach(() => {
    for (const id of CHAT_IDS) chatAbortRegistry.delete(id);
  });

  describe("register", () => {
    it("creates a live controller and release handle when none is registered for the chat", () => {
      const { controller, release } = chatAbortRegistry.register("chat-a");

      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal.aborted).toBe(false);
      expect(typeof release).toBe("function");
      expect(mockLog.debug).not.toHaveBeenCalled();
    });

    it("aborts the previous controller and replaces it on re-register", () => {
      const { controller: first } = chatAbortRegistry.register("chat-a");
      const { controller: second } = chatAbortRegistry.register("chat-a");

      expect(first.signal.aborted).toBe(true);
      expect(second).not.toBe(first);
      expect(second.signal.aborted).toBe(false);
      expect(mockLog.debug).toHaveBeenCalledWith(
        "Aborting previous stream for chat (chatId: {chatId})",
        { chatId: "chat-a" },
      );
    });

    it("keeps controllers for different chats independent", () => {
      const { controller: a } = chatAbortRegistry.register("chat-a");
      const { controller: b } = chatAbortRegistry.register("chat-b");
      const { controller: aAgain } = chatAbortRegistry.register("chat-a");

      expect(a.signal.aborted).toBe(true);
      expect(b.signal.aborted).toBe(false);
      expect(aAgain.signal.aborted).toBe(false);
    });

    it("conditional release only deletes the controller if it is still active", () => {
      const { controller: first, release: releaseFirst } =
        chatAbortRegistry.register("chat-a");
      const { controller: second, release: releaseSecond } =
        chatAbortRegistry.register("chat-a");

      // First run finishes after second run started; releasing first run must NOT clear second run
      releaseFirst();

      // Second run is still registered and active
      expect(chatAbortRegistry.abort("chat-a")).toBe(true);
      expect(second.signal.aborted).toBe(true);

      // Releasing second run cleans it up
      releaseSecond();
      expect(chatAbortRegistry.abort("chat-a")).toBe(false);
    });

    it("calling release on the active controller unregisters it", () => {
      const { controller, release } = chatAbortRegistry.register("chat-a");

      release();

      expect(controller.signal.aborted).toBe(false);
      expect(chatAbortRegistry.abort("chat-a")).toBe(false);
    });
  });

  describe("abort", () => {
    it("aborts and forgets a registered controller, returning true", () => {
      const { controller } = chatAbortRegistry.register("chat-a");

      const result = chatAbortRegistry.abort("chat-a");

      expect(result).toBe(true);
      expect(controller.signal.aborted).toBe(true);
      expect(mockLog.info).toHaveBeenCalledWith(
        "Aborted active stream (chatId: {chatId})",
        { chatId: "chat-a" },
      );
      // Registry entry is removed, so a second abort misses.
      expect(chatAbortRegistry.abort("chat-a")).toBe(false);
    });

    it("returns false and leaves other controllers alone when the chat is absent", () => {
      const { controller: other } = chatAbortRegistry.register("chat-b");

      const result = chatAbortRegistry.abort("chat-a");

      expect(result).toBe(false);
      expect(other.signal.aborted).toBe(false);
      expect(mockLog.info).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("removes a present controller without aborting it", () => {
      const { controller } = chatAbortRegistry.register("chat-a");

      chatAbortRegistry.delete("chat-a");

      expect(controller.signal.aborted).toBe(false);
      expect(chatAbortRegistry.abort("chat-a")).toBe(false);
    });

    it("is a no-op for an absent key", () => {
      const { controller } = chatAbortRegistry.register("chat-b");

      expect(() => chatAbortRegistry.delete("chat-c")).not.toThrow();

      // The unrelated registration survives the no-op delete.
      expect(chatAbortRegistry.abort("chat-b")).toBe(true);
      expect(controller.signal.aborted).toBe(true);
    });
  });
});
