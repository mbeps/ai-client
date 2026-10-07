import { describe, expect, it, vi } from "vitest";
import { persistAssistantResponse } from "@/lib/chat/persist-response";

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  c.select = vi.fn().mockImplementation(() => c);
  c.from = vi.fn().mockImplementation(() => c);
  c.insert = vi.fn().mockImplementation(() => c);
  c.values = vi.fn().mockImplementation(() => c);
  c.update = vi.fn().mockImplementation(() => c);
  c.set = vi.fn().mockImplementation(() => c);
  c.where = vi.fn().mockImplementation(() => c);
  c.limit = vi.fn().mockResolvedValue([]);
  c.onConflictDoNothing = vi.fn().mockImplementation(() => c);
  c.onConflictDoUpdate = vi.fn().mockImplementation(() => c);
  c.returning = vi.fn().mockResolvedValue([{ id: "msg-1" }]);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));


describe("persistAssistantResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let limitCall = 0;
    chainable.select.mockImplementation(() => chainable);
    chainable.from.mockImplementation(() => chainable);
    chainable.insert.mockImplementation(() => chainable);
    chainable.values.mockImplementation(() => chainable);
    chainable.update.mockImplementation(() => chainable);
    chainable.set.mockImplementation(() => chainable);
    chainable.where.mockImplementation(() => chainable);
    chainable.limit.mockImplementation(() => {
      limitCall++;
      // Call 1: parent check -> parent exists by default
      if (limitCall % 2 === 1) return Promise.resolve([{ id: "msg-0" }]);
      // Call 2: partial reply check -> none by default
      return Promise.resolve([]);
    });
    chainable.onConflictDoNothing.mockImplementation(() => chainable);
    chainable.returning.mockResolvedValue([{ id: "msg-1" }]);
  });

  it("inserts message and updates chat leaf", async () => {
    await persistAssistantResponse({
      chatId: "chat-1",
      assistantMessageId: "msg-1",
      content: "Hello AI",
      parentId: "msg-0",
      metadata: null,
    });

    expect(chainable.insert).toHaveBeenCalledOnce();
    expect(chainable.values).toHaveBeenCalledWith({
      id: "msg-1",
      chatId: "chat-1",
      role: "assistant",
      content: "Hello AI",
      parentId: "msg-0",
      metadata: null,
    });

    expect(chainable.update).toHaveBeenCalledOnce();
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({
        currentLeafId: "msg-1",
      }),
    );
  });

  it("inserts message with null parentId when parentId is undefined", async () => {
    await persistAssistantResponse({
      chatId: "chat-1",
      assistantMessageId: "msg-2",
      content: "First message",
      parentId: undefined,
      metadata: "{}",
    });

    expect(chainable.values).toHaveBeenCalledWith({
      id: "msg-2",
      chatId: "chat-1",
      role: "assistant",
      content: "First message",
      parentId: null,
      metadata: "{}",
    });
  });

  it("safely ignores duplicate inserts via onConflictDoNothing", async () => {
    chainable.insert.mockClear();
    chainable.update.mockClear();
    
    // Simulate duplicate where onConflictDoNothing returns empty
    chainable.returning.mockResolvedValueOnce([]); 

    await persistAssistantResponse({
      chatId: "chat-1",
      assistantMessageId: "msg-1",
      content: "Hello AI",
      parentId: "msg-0",
      metadata: null,
    });

    expect(chainable.onConflictDoNothing).toHaveBeenCalled();
    // Since returning is [], the update chat block should NOT be called
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it("skips insertion when the client already persisted a partial reply for the parent", async () => {
    chainable.insert.mockClear();
    chainable.update.mockClear();
    // 1st limit: parent exists; 2nd limit: sibling assistant row already exists (user pressed Stop).
    chainable.limit
      .mockResolvedValueOnce([{ id: "msg-0" }])
      .mockResolvedValueOnce([{ id: "msg-partial" }]);

    await persistAssistantResponse({
      chatId: "chat-1",
      assistantMessageId: "msg-new",
      content: "Full streamed answer",
      parentId: "msg-0",
      metadata: null,
    });

    expect(chainable.limit).toHaveBeenCalledTimes(2);
    // The early return must skip both the insert and the chat leaf update.
    expect(chainable.insert).not.toHaveBeenCalled();
    expect(chainable.values).not.toHaveBeenCalled();
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it("does not query for an existing reply when parentId is undefined", async () => {
    chainable.limit.mockClear();
    chainable.insert.mockClear();

    await persistAssistantResponse({
      chatId: "chat-1",
      assistantMessageId: "msg-3",
      content: "First message",
      parentId: undefined,
      metadata: null,
    });

    // The `if (parentId)` guard skips the lookup entirely for a root message.
    expect(chainable.limit).not.toHaveBeenCalled();
    expect(chainable.insert).toHaveBeenCalledOnce();
  });

  it("returns true when assistant response is successfully inserted and chat updated", async () => {
    chainable.limit
      .mockResolvedValueOnce([{ id: "msg-0" }])
      .mockResolvedValueOnce([]);
    chainable.returning.mockResolvedValueOnce([{ id: "msg-1" }]);

    const result = await persistAssistantResponse({
      chatId: "chat-1",
      assistantMessageId: "msg-1",
      content: "Hello",
      parentId: "msg-0",
      metadata: null,
    });

    expect(result).toBe(true);
    expect(chainable.update).toHaveBeenCalled();
  });

  it("returns false and does not insert when parent message does not exist in DB", async () => {
    chainable.limit.mockResolvedValueOnce([]); // parent does not exist

    const result = await persistAssistantResponse({
      chatId: "chat-1",
      assistantMessageId: "msg-1",
      content: "Hello",
      parentId: "deleted-parent",
      metadata: null,
    });

    expect(result).toBe(false);
    expect(chainable.insert).not.toHaveBeenCalled();
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it("returns false when skipping insertion because partial reply already exists", async () => {
    chainable.limit
      .mockResolvedValueOnce([{ id: "msg-0" }])
      .mockResolvedValueOnce([{ id: "msg-partial" }]);

    const result = await persistAssistantResponse({
      chatId: "chat-1",
      assistantMessageId: "msg-new",
      content: "Full answer",
      parentId: "msg-0",
      metadata: null,
    });

    expect(result).toBe(false);
  });

  it("returns false when insert is skipped due to conflict (!inserted)", async () => {
    chainable.limit
      .mockResolvedValueOnce([{ id: "msg-0" }])
      .mockResolvedValueOnce([]);
    chainable.returning.mockResolvedValueOnce([]);

    const result = await persistAssistantResponse({
      chatId: "chat-1",
      assistantMessageId: "msg-duplicate",
      content: "Duplicate",
      parentId: "msg-0",
      metadata: null,
    });

    expect(result).toBe(false);
  });

  it("returns false without throwing when foreign key violation (23503) occurs on delete", async () => {
    chainable.limit
      .mockResolvedValueOnce([{ id: "msg-0" }])
      .mockResolvedValueOnce([]);
    const fkViolation = new Error(
      'insert violates foreign key constraint "message_chat_id_chat_id_fk"',
    );
    (fkViolation as any).code = "23503";
    chainable.returning.mockRejectedValueOnce(fkViolation);

    const result = await persistAssistantResponse({
      chatId: "chat-deleted",
      assistantMessageId: "msg-1",
      content: "Hello",
      parentId: "msg-0",
      metadata: null,
    });

    expect(result).toBe(false);
  });

  it("re-throws unexpected database errors", async () => {
    chainable.limit
      .mockResolvedValueOnce([{ id: "msg-0" }])
      .mockResolvedValueOnce([]);
    const dbErr = new Error("Connection terminated unexpectedly");
    (dbErr as any).code = "08006";
    chainable.returning.mockRejectedValueOnce(dbErr);

    await expect(
      persistAssistantResponse({
        chatId: "chat-1",
        assistantMessageId: "msg-1",
        content: "Hello",
        parentId: "msg-0",
        metadata: null,
      }),
    ).rejects.toThrow("Connection terminated unexpectedly");
  });
});
