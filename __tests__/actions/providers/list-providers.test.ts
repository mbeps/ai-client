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
  for (const m of ["select", "from", "where", "orderBy"]) {
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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProviders } from "@/actions/providers/list-providers";

describe("listProviders action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.orderBy.mockResolvedValue([]);
  });

  it("returns all providers for authenticated user with masked apiKey and headers", async () => {
    const provs = [
      {
        id: "prov-1",
        name: "OpenAI",
        apiKey: "iv:tag:ciphertext-api-key",
        headers: "iv:tag:ciphertext-headers",
      },
      {
        id: "prov-2",
        name: "Ollama",
        apiKey: null,
        headers: null,
      },
    ];
    chainable.orderBy.mockResolvedValueOnce(provs);

    const res = await listProviders();
    expect(res).toEqual([
      {
        id: "prov-1",
        name: "OpenAI",
        apiKey: "[REDACTED]",
        headers: "[REDACTED]",
      },
      {
        id: "prov-2",
        name: "Ollama",
        apiKey: null,
        headers: null,
      },
    ]);
  });
});
