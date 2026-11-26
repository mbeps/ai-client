import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

const mockOrderBy = vi.hoisted(() => vi.fn());
const mockWhere = vi.hoisted(() => vi.fn(() => ({ orderBy: mockOrderBy })));
const mockFrom = vi.hoisted(() => vi.fn(() => ({ where: mockWhere })));
const mockSelect = vi.hoisted(() => vi.fn(() => ({ from: mockFrom })));

vi.mock("@/drizzle/db", () => ({
  db: { select: mockSelect },
}));

import { listChats } from "@/actions/chats/list-chats";

describe("listChats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("queries chats owned by the user with workflowId IS NULL", async () => {
    const rows = [
      { id: "chat-1", title: "General", userId: "user-1", workflowId: null },
    ];
    mockOrderBy.mockResolvedValueOnce(rows);

    const result = await listChats();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(rows);
    }
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(mockOrderBy).toHaveBeenCalledTimes(1);
  });
});
