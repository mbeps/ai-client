import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({ env: { RATE_LIMIT_CHAT_RPM: 20 } }));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: { id: "u1", name: "Alice Smith", email: "alice@example.com" },
      }),
    },
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: ["evt-1"] }) },
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

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
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

import { POST, maxDuration, runtime, dynamic } from "@/app/api/chat/route";
import { auth } from "@/lib/auth/auth";
import { inngest } from "@/lib/inngest/client";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mocked(checkRateLimit).mockReturnValue({
  allowed: false,
  retryAfterSeconds: 42,
});

describe("POST /api/chat — rate limiting (T9.1)", () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockClear();
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      retryAfterSeconds: 42,
    });
    mockDbSelect.chain.where.mockResolvedValue([
      { id: "11111111-1111-4111-8111-111111111111" },
    ]);
  });

  it("returns 404 when chat does not exist or user does not own it", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockDbSelect.chain.where.mockResolvedValueOnce([]);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        chatId: "11111111-1111-4111-8111-111111111111",
        userMessageId: "22222222-2222-4222-8222-222222222222",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Chat not found or access denied");
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After header when the limiter blocks", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        chatId: "11111111-1111-4111-8111-111111111111",
        userMessageId: "22222222-2222-4222-8222-222222222222",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Rate limit exceeded");
    expect(checkRateLimit).toHaveBeenCalledWith("chat:u1", expect.any(Number));
  });

  it("does not return 429 when allowed", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        chatId: "11111111-1111-4111-8111-111111111111",
        userMessageId: "22222222-2222-4222-8222-222222222222",
      }),
    });
    const res = await POST(req);
    // Route proceeds past rate limit; may fail later on provider resolution
    // but must not be a rate-limit response.
    expect(res.status).not.toBe(429);
  });

  it("forwards the session user's name and email to the Inngest event", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        chatId: "11111111-1111-4111-8111-111111111111",
        userMessageId: "22222222-2222-4222-8222-222222222222",
      }),
    });

    await POST(req);

    expect(inngest.send).toHaveBeenCalledWith({
      name: "chat/response.generate",
      data: expect.objectContaining({
        userId: "u1",
        userName: "Alice Smith",
        userEmail: "alice@example.com",
      }),
    });
  });

  it("returns 401 when user session is missing", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as any);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        chatId: "11111111-1111-4111-8111-111111111111",
        userMessageId: "22222222-2222-4222-8222-222222222222",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const req = {
      json: vi.fn().mockRejectedValue(new Error("Unexpected token")),
    } as unknown as Request;

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Invalid JSON payload",
      code: "INVALID_INPUT",
    });
  });

  it("returns 400 when schema validation fails", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        // missing required chatId and userMessageId
        model: "gpt-4o",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.error).toBe("Invalid request");
    expect(body.code).toBe("INVALID_INPUT");
  });

  it("normalizes empty or whitespace model string to undefined", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        chatId: "11111111-1111-4111-8111-111111111111",
        userMessageId: "22222222-2222-4222-8222-222222222222",
        model: "   ",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(inngest.send).toHaveBeenCalledWith({
      name: "chat/response.generate",
      data: expect.objectContaining({
        model: undefined,
      }),
    });
  });

  it("returns 500 when database or inngest dispatch throws an error", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockDbSelect.chain.where.mockRejectedValueOnce(new Error("Database connection lost"));

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        chatId: "11111111-1111-4111-8111-111111111111",
        userMessageId: "22222222-2222-4222-8222-222222222222",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; code: string; ref: string };
    expect(body.code).toBe("INTERNAL");
    expect(body.error).toContain("An internal error occurred");
    expect(body.ref).toBeDefined();
  });

  it("exports correct Next.js route segment configuration", () => {
    expect(maxDuration).toBe(60);
    expect(runtime).toBe("nodejs");
    expect(dynamic).toBe("force-dynamic");
  });
});
