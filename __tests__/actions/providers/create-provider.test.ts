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
    await expect(createProvider({} as any)).rejects.toThrow();
  });

  it("encrypts api key and creates provider record", async () => {
    const created = { id: "prov-1", name: "OpenAI", providerType: "openai" };
    chainable.returning.mockResolvedValueOnce([created]);

    const res = await createProvider({
      name: "OpenAI",
      providerType: "openai",
      apiKey: "sk-proj-123",
      baseUrl: "https://api.openai.com/v1",
    });

    expect(res).toEqual(created);
    expect(chainable.insert).toHaveBeenCalled();
  });
});
