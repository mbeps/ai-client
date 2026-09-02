import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { RATE_LIMIT_CHAT_RPM: 20 } }));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

import { POST } from "@/app/api/chat/route";
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
});
