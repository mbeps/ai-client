import { describe, expect, it, vi, beforeEach } from "vitest";
import { DELETE } from "@/app/api/chat/stop/route";
import { auth } from "@/lib/auth/auth";
import { abortChatStream } from "@/lib/chat/abort-chat-stream";

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/chat/abort-chat-stream", () => ({
  abortChatStream: vi.fn().mockResolvedValue(true),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

const mockDbSelect = vi.hoisted(() => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ id: "11111111-1111-4111-8111-111111111111" }]),
  };
  return {
    select: vi.fn(() => chain),
    chain,
  };
});

vi.mock("@/drizzle/db", () => ({ db: mockDbSelect }));
vi.mock("@/drizzle/schemas/chat-schema", () => ({
  chat: { id: "id", userId: "userId" },
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("DELETE /api/chat/stop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.chain.where.mockResolvedValue([
      { id: "11111111-1111-4111-8111-111111111111" },
    ]);
  });

  it("returns 401 when user is unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/chat/stop", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: "chat-123" }),
    });

    const res = await DELETE(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  });

  it("returns 400 when request body fails validation", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-123" },
      session: { id: "session-123" },
    } as any);

    const req = new Request("http://localhost:3000/api/chat/stop", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when chat is not found or not owned by user", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-123" },
      session: { id: "session-123" },
    } as any);
    mockDbSelect.chain.where.mockResolvedValueOnce([]);

    const validChatId = "11111111-1111-4111-8111-111111111111";
    const req = new Request("http://localhost:3000/api/chat/stop", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: validChatId }),
    });

    const res = await DELETE(req);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: "Chat not found or access denied",
      code: "NOT_FOUND",
    });
    expect(abortChatStream).not.toHaveBeenCalled();
  });

  it("delegates to abortChatStream and returns success", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-123" },
      session: { id: "session-123" },
    } as any);

    const validChatId = "11111111-1111-4111-8111-111111111111";
    const req = new Request("http://localhost:3000/api/chat/stop", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: validChatId }),
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ success: true, aborted: true });
    expect(abortChatStream).toHaveBeenCalledWith(validChatId, "user-123");
  });
});
