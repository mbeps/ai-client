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
});
