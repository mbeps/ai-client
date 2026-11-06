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

vi.mock("@/lib/encryption/encrypt", () => ({
  encrypt: vi.fn().mockImplementation((val: string) => `enc-${val}`),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateProvider } from "@/actions/providers/update-provider";

describe("updateProvider action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
  });

  it("throws validation error if input payload is empty or invalid", async () => {
    const res = await updateProvider("prov-1", {} as any);
    expect(res.ok).toBe(false);
  });

  it("throws NotFound if provider does not exist in database", async () => {
    chainable.where.mockResolvedValueOnce([]);

    const res = await updateProvider("prov-1", { name: "New Name" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe("Not Found");
    }
  });

  it("updates provider without apiKey or headers, preserving existing", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: "prov-1",
        userId: "user-1",
        apiKey: "existing-key",
        headers: "existing-headers",
      },
    ]);
    const updated = { id: "prov-1", name: "New Name" };
    chainable.returning.mockResolvedValueOnce([updated]);

    const res = await updateProvider("prov-1", { name: "New Name" });
    expect(res).toEqual({ ok: true, value: updated });
    expect(chainable.set).toHaveBeenCalled();
  });

  it("updates provider with all scalar fields and re-encrypts apiKey and headers", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: "prov-1",
        userId: "user-1",
        apiKey: "old-key",
        headers: "old-headers",
      },
    ]);
    const updated = {
      id: "prov-1",
      name: "All Fields",
      baseUrl: "https://api.openai.com/v1",
      isEnabled: false,
      requiresKey: false,
      apiKey: "enc-sk-new",
      headers: 'enc-{"X-Header":"val"}',
    };
    chainable.returning.mockResolvedValueOnce([updated]);

    const res = await updateProvider("prov-1", {
      name: "All Fields",
      baseUrl: "https://api.openai.com/v1",
      isEnabled: false,
      requiresKey: false,
      apiKey: "sk-new",
      headers: { "X-Header": "val" },
    });

    expect(res).toEqual({ ok: true, value: updated });
    expect(chainable.set).toHaveBeenCalled();
  });

  it("updates provider with apiKey only, preserving existing headers", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: "prov-1",
        userId: "user-1",
        apiKey: "old-key",
        headers: "existing-headers-val",
      },
    ]);
    const updated = { id: "prov-1", apiKey: "enc-sk-updated" };
    chainable.returning.mockResolvedValueOnce([updated]);

    const res = await updateProvider("prov-1", { apiKey: "sk-updated" });
    expect(res).toEqual({ ok: true, value: updated });
  });

  it("updates provider with headers only, preserving existing apiKey", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: "prov-1",
        userId: "user-1",
        apiKey: "existing-api-key",
        headers: "old-headers",
      },
    ]);
    const updated = { id: "prov-1", headers: 'enc-{"X-Foo":"bar"}' };
    chainable.returning.mockResolvedValueOnce([updated]);

    const res = await updateProvider("prov-1", {
      headers: { "X-Foo": "bar" },
    });
    expect(res).toEqual({ ok: true, value: updated });
  });

  it("throws NotFound if update query returns empty result", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "prov-1", userId: "user-1", apiKey: "key", headers: null },
    ]);
    chainable.returning.mockResolvedValueOnce([]);

    const res = await updateProvider("prov-1", { name: "Non-existent" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe("Not Found");
    }
  });
});
