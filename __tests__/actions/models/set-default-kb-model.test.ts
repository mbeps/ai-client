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
  for (const m of [
    "select",
    "from",
    "where",
    "insert",
    "values",
    "onConflictDoUpdate",
  ]) {
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
import { setDefaultKbModel } from "@/actions/models/set-default-kb-model";

describe("setDefaultKbModel action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.onConflictDoUpdate.mockResolvedValue(undefined);
  });

  it("returns NotFound if non-null modelId does not exist or lacks chat capability", async () => {
    chainable.where.mockResolvedValueOnce([]);

    const res = await setDefaultKbModel("model-1");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe("Not Found");
    }
    expect(chainable.insert).not.toHaveBeenCalled();
  });

  it("sets default KB model successfully for an owned chat-capable model", async () => {
    chainable.where.mockResolvedValueOnce([{ id: "model-1" }]);

    const res = await setDefaultKbModel("model-1");
    expect(res).toEqual({ ok: true, value: undefined });
    expect(chainable.values).toHaveBeenCalledWith({
      userId: "user-1",
      defaultKbModelId: "model-1",
    });
  });

  it("clears default KB model to null so it inherits Default Chat Model", async () => {
    const res = await setDefaultKbModel(null);
    expect(res).toEqual({ ok: true, value: undefined });
    expect(chainable.select).not.toHaveBeenCalled();
    expect(chainable.values).toHaveBeenCalledWith({
      userId: "user-1",
      defaultKbModelId: null,
    });
  });
});
