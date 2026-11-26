import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetSession,
  mockHeaders,
  mockCheckRateLimit,
  mockSelect,
  mockFrom,
  mockWhere,
  mockInngestSend,
  mockLoggerWarn,
  mockLoggerError,
} = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  return {
    mockGetSession: vi.fn(),
    mockHeaders: vi.fn(async () => new Headers()),
    mockCheckRateLimit: vi.fn(),
    mockSelect,
    mockFrom,
    mockWhere,
    mockInngestSend: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockLoggerError: vi.fn(),
  };
});

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: mockSelect,
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: mockInngestSend,
  },
}));

vi.mock("@/lib/logger", () => {
  const mockLog = {
    warn: mockLoggerWarn,
    error: mockLoggerError,
    info: vi.fn(),
    debug: vi.fn(),
  };
  return {
    getLogger: vi.fn(() => mockLog),
    logger: mockLog,
  };
});

import { POST } from "@/app/api/chat/route";

const VALID_CHAT_ID = "00000000-0000-4000-8000-000000000001";
const VALID_MSG_ID = "00000000-0000-4000-8000-000000000002";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user-1" } });
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockWhere.mockResolvedValue([{ id: VALID_CHAT_ID }]);
    mockInngestSend.mockResolvedValue({ ids: ["evt-1"] });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await POST(makeRequest("{bad-json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when chatRequestSchema validation fails", async () => {
    const res = await POST(makeRequest({ chatId: "" }));
    expect(res.status).toBe(400);
    expect(mockLoggerWarn).toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      retryAfterSeconds: 42,
    });
    const res = await POST(
      makeRequest({ chatId: VALID_CHAT_ID, userMessageId: VALID_MSG_ID }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });

  it("returns 404 when chat is not owned by user", async () => {
    mockWhere.mockResolvedValue([]);
    const res = await POST(
      makeRequest({ chatId: VALID_CHAT_ID, userMessageId: VALID_MSG_ID }),
    );
    expect(res.status).toBe(404);
  });

  it("normalizes whitespace-only model to undefined and dispatches to Inngest", async () => {
    const res = await POST(
      makeRequest({
        chatId: VALID_CHAT_ID,
        userMessageId: VALID_MSG_ID,
        model: "   ",
      }),
    );
    expect(res.status).toBe(200);
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "chat/response.generate",
        data: expect.objectContaining({
          chatId: VALID_CHAT_ID,
          userId: "user-1",
          userMessageId: VALID_MSG_ID,
          model: undefined,
        }),
      }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockInngestSend.mockRejectedValue(new Error("boom"));
    const res = await POST(
      makeRequest({ chatId: VALID_CHAT_ID, userMessageId: VALID_MSG_ID }),
    );
    expect(res.status).toBe(500);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("returns 500 when a non-Error or Error without stack is thrown", async () => {
    mockInngestSend.mockRejectedValueOnce("string error");
    const res1 = await POST(
      makeRequest({ chatId: VALID_CHAT_ID, userMessageId: VALID_MSG_ID }),
    );
    expect(res1.status).toBe(500);

    const errNoStack = new Error("no stack");
    errNoStack.stack = undefined;
    mockInngestSend.mockRejectedValueOnce(errNoStack);
    const res2 = await POST(
      makeRequest({ chatId: VALID_CHAT_ID, userMessageId: VALID_MSG_ID }),
    );
    expect(res2.status).toBe(500);
  });
});
