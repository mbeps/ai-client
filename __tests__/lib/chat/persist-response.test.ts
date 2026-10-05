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
    // A sibling assistant row already exists for this parentId (user pressed Stop).
    chainable.limit.mockResolvedValueOnce([{ id: "msg-partial" }]);

    await persistAssistantResponse({
      chatId: "chat-1",
      assistantMessageId: "msg-new",
      content: "Full streamed answer",
      parentId: "msg-0",
      metadata: null,
    });

    expect(chainable.limit).toHaveBeenCalledOnce();
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
});
