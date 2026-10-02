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
  for (const m of ["select", "from", "where", "insert", "values", "onConflictDoUpdate", "update", "set"]) {
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
import { setDefaultEmbeddingModel } from "@/actions/models/set-default-embedding-model";

describe("setDefaultEmbeddingModel action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.onConflictDoUpdate.mockResolvedValue(undefined);
  });

  it("throws NotFound if model does not exist or lacks embedding capability", async () => {
    chainable.where.mockResolvedValueOnce([]);

    await expect(setDefaultEmbeddingModel("model-1")).rejects.toThrow("Not Found");
  });

  it("sets default embedding model successfully", async () => {
    chainable.where.mockResolvedValueOnce([{ id: "model-1" }]);

    await setDefaultEmbeddingModel("model-1");
    expect(chainable.insert).toHaveBeenCalled();
  });
});
