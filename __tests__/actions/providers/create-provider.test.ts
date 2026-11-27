vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["insert", "values", "returning"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

vi.mock("@/lib/encryption/encrypt", () => ({
  encrypt: vi.fn().mockReturnValue("encrypted-key"),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProvider } from "@/actions/providers/create-provider";

describe("createProvider action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
  });

  it("rejects invalid input schema", async () => {
    const res = await createProvider({} as any);
    expect(res.ok).toBe(false);
  });

  it("encrypts api key and creates provider record with explicit type", async () => {
    const created = {
      id: "prov-1",
      name: "OpenAI",
      type: "openai",
    };
    chainable.returning.mockResolvedValueOnce([created]);

    const res = await createProvider({
      type: "openai",
      name: "OpenAI",
      apiKey: "sk-proj-123",
      baseUrl: "https://api.openai.com/v1",
    });

    expect(res).toEqual({ ok: true, value: created });
    expect(chainable.insert).toHaveBeenCalled();
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "openai",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
      }),
    );
  });

  it("defaults type to openai-compatible when omitted", async () => {
    const created = {
      id: "prov-2",
      name: "Custom",
      type: "openai-compatible",
    };
    chainable.returning.mockResolvedValueOnce([created]);

    const res = await createProvider({
      name: "Custom",
      baseUrl: "https://api.custom.com/v1",
    });

    expect(res).toEqual({ ok: true, value: created });
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "openai-compatible",
        isEnabled: true,
        requiresKey: true,
      }),
    );
  });

  it("returns CONFLICT when a provider with the same name already exists (23505)", async () => {
    const pgError = Object.assign(new Error("duplicate key value"), {
      code: "23505",
    });
    const drizzleError = Object.assign(new Error("Failed query"), {
      cause: pgError,
    });
    chainable.returning.mockRejectedValueOnce(drizzleError);

    const res = await createProvider({
      type: "openrouter",
      name: "OpenRouter",
      apiKey: "sk-or-123",
      baseUrl: "https://openrouter.ai/api/v1",
    });

    expect(res).toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        message: 'A provider named "OpenRouter" already exists.',
      },
    });
  });

  it("rethrows unexpected database errors to defineAction", async () => {
    chainable.returning.mockRejectedValueOnce(new Error("connection lost"));

    const res = await createProvider({
      type: "openrouter",
      name: "OpenRouter",
      apiKey: "sk-or-123",
      baseUrl: "https://openrouter.ai/api/v1",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("INTERNAL");
    }
  });
});
