import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasExistingAssistantMessage } from "@/lib/chat/has-existing-assistant-message";

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  c.select = vi.fn().mockImplementation(() => c);
  c.from = vi.fn().mockImplementation(() => c);
  c.where = vi.fn().mockImplementation(() => c);
  c.limit = vi.fn().mockResolvedValue([]);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

describe("hasExistingAssistantMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockImplementation(() => chainable);
    chainable.from.mockImplementation(() => chainable);
    chainable.where.mockImplementation(() => chainable);
    chainable.limit.mockResolvedValue([]);
  });

  it("returns false when neither assistantMessageId nor parentId is provided", async () => {
    const result = await hasExistingAssistantMessage("chat-1");
    expect(result).toBe(false);
    expect(chainable.select).not.toHaveBeenCalled();
  });

  it("returns true when found by assistantMessageId", async () => {
    chainable.limit.mockResolvedValueOnce([{ id: "asst-1" }]);
    const result = await hasExistingAssistantMessage(
      "chat-1",
      undefined,
      "asst-1",
    );
    expect(result).toBe(true);
    expect(chainable.select).toHaveBeenCalledOnce();
  });

  it("returns true when found by parentId", async () => {
    chainable.limit.mockResolvedValueOnce([{ id: "asst-from-parent" }]);
    const result = await hasExistingAssistantMessage("chat-1", "parent-1");
    expect(result).toBe(true);
    expect(chainable.select).toHaveBeenCalledOnce();
  });

  it("returns false when neither query finds a matching row", async () => {
    chainable.limit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await hasExistingAssistantMessage(
      "chat-1",
      "parent-1",
      "asst-missing",
    );
    expect(result).toBe(false);
  });
});

