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
  for (const m of ["select", "from", "innerJoin", "where", "orderBy"]) {
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
import { listModels } from "@/actions/models/list-models";

describe("listModels action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.innerJoin.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.orderBy.mockResolvedValue([]);
  });

  it("returns all active models for user's configured providers", async () => {
    const mockModels = [{ id: "m-1", label: "Model 1", providerName: "OpenAI" }];
    chainable.orderBy.mockResolvedValueOnce(mockModels);

    const models = await listModels();
    expect(models).toEqual(mockModels);
  });

  it("filters models by chat type and enabled true", async () => {
    chainable.orderBy.mockResolvedValueOnce([]);

    const models = await listModels({ type: "chat", isEnabled: true, providerId: "prov-1" });
    expect(models).toEqual([]);
    expect(chainable.where).toHaveBeenCalled();
  });

  it("filters models by embedding type and enabled false", async () => {
    chainable.orderBy.mockResolvedValueOnce([]);

    const models = await listModels({ type: "embedding", isEnabled: false });
    expect(models).toEqual([]);
    expect(chainable.where).toHaveBeenCalled();
  });

  it("filters models by both type", async () => {
    chainable.orderBy.mockResolvedValueOnce([]);

    const models = await listModels({ type: "both" });
    expect(models).toEqual([]);
    expect(chainable.where).toHaveBeenCalled();
  });

  it("handles filters object with undefined values", async () => {
    chainable.orderBy.mockResolvedValueOnce([]);

    const models = await listModels({});
    expect(models).toEqual([]);
    expect(chainable.where).toHaveBeenCalled();
  });
});
