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
  for (const m of ["select", "from", "where", "insert", "values", "returning"]) {
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
import { createModel } from "@/actions/models/create-model";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("createModel action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.returning.mockReturnValue(chainable);
  });

  it("validates payload and rejects invalid input", async () => {
    const res = await createModel({} as any);
    expect(res.ok).toBe(false);
  });

  it("rejects if provider is not owned by user", async () => {
    chainable.where.mockResolvedValueOnce([]);

    const res = await createModel({
      providerId: VALID_UUID,
      modelId: "gpt-4",
      label: "GPT-4",
      modelType: "chat",
      contextWindow: 8192,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe("Not Found");
    }
  });

  it("inserts model row into database and returns created model", async () => {
    chainable.where.mockResolvedValueOnce([{ id: VALID_UUID }]);
    const newModel = {
      id: "model-1",
      providerId: VALID_UUID,
      userId: "user-1",
      modelId: "gpt-4",
      label: "GPT-4",
      modelType: "chat",
      contextWindow: 8192,
      isManuallyAdded: true,
      isEnabled: true,
    };
    chainable.returning.mockResolvedValueOnce([newModel]);

    const res = await createModel({
      providerId: VALID_UUID,
      modelId: "gpt-4",
      label: "GPT-4",
      modelType: "chat",
      contextWindow: 8192,
    });

    expect(res).toEqual({ ok: true, value: newModel });
    expect(chainable.insert).toHaveBeenCalled();
  });

  it("inserts model with reasoningEffortFormat and modelOptions", async () => {
    chainable.where.mockResolvedValueOnce([{ id: VALID_UUID }]);
    const newModel = {
      id: "model-2",
      providerId: VALID_UUID,
      userId: "user-1",
      modelId: "claude-3-7-sonnet",
      label: "Claude 3.7",
      modelType: "chat",
      contextWindow: 200000,
      reasoningEffortFormat: "anthropic",
      modelOptions: JSON.stringify({ temperature: 0.7 }),
      isManuallyAdded: true,
      isEnabled: true,
    };
    chainable.returning.mockResolvedValueOnce([newModel]);

    const res = await createModel({
      providerId: VALID_UUID,
      modelId: "claude-3-7-sonnet",
      label: "Claude 3.7",
      modelType: "chat",
      contextWindow: 200000,
      capReasoning: true,
      reasoningEffortFormat: "anthropic",
      modelOptions: { temperature: 0.7 },
    });

    expect(res).toEqual({ ok: true, value: newModel });
    expect(chainable.insert).toHaveBeenCalled();
  });
});
