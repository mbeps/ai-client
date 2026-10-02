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
  for (const m of ["select", "from", "where", "update", "set", "returning"]) {
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

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { toggleProvider } from "@/actions/providers/toggle-provider";

describe("toggleProvider action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
  });

  it("throws NotFound if provider does not exist", async () => {
    chainable.returning.mockResolvedValueOnce([]);

    await expect(toggleProvider("prov-1", true)).rejects.toThrow("Not Found");
  });

  it("toggles provider enabled flag successfully", async () => {
    chainable.returning.mockResolvedValueOnce([{ id: "prov-1", isEnabled: true }]);

    await expect(toggleProvider("prov-1", true)).resolves.toBeUndefined();
  });
});
