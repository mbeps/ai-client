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
  for (const m of ["select", "from", "where", "delete", "returning"]) {
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
import { deleteModel } from "@/actions/models/delete-model";

describe("deleteModel action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.delete.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.returning.mockResolvedValue([{ id: "model-1" }]);
  });

  it("deletes model owned by user", async () => {
    const res = await deleteModel("model-1");
    expect(res).toEqual({ deletedCount: 1 });
    expect(chainable.delete).toHaveBeenCalled();
  });

  it("rejects deletion if model does not exist or belongs to another user", async () => {
    chainable.returning.mockResolvedValueOnce([]);

    await expect(deleteModel("model-1")).rejects.toThrow("Not Found");
  });
});
