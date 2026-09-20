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
  for (const m of ["update", "set", "where", "returning"]) {
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
import { updateModels } from "@/actions/models/update-model";

describe("updateModels action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
  });

  it("returns empty array if ids list is empty", async () => {
    const res = await updateModels([], { label: "New Label" });
    expect(res).toEqual([]);
  });

  it("throws validation error on invalid input", async () => {
    await expect(updateModels("model-1", { modelType: "invalid-type" as any })).rejects.toThrow();
  });

  it("throws NotFound if no models were updated", async () => {
    chainable.returning.mockResolvedValueOnce([]);

    await expect(updateModels("model-1", { label: "New Label" })).rejects.toThrow("Not Found");
  });

  it("updates single model successfully with partial fields", async () => {
    const updated = [{ id: "model-1", label: "New Label" }];
    chainable.returning.mockResolvedValueOnce(updated);

    const res = await updateModels("model-1", { label: "New Label" });
    expect(res).toEqual(updated);
    expect(chainable.set).toHaveBeenCalled();
    expect(chainable.where).toHaveBeenCalled();
  });

  it("updates multiple models with all fields defined", async () => {
    const updated = [
      { id: "model-1", label: "All Fields" },
      { id: "model-2", label: "All Fields" },
    ];
    chainable.returning.mockResolvedValueOnce(updated);

    const res = await updateModels(["model-1", "model-2"], {
      label: "All Fields",
      modelType: "both",
      contextWindow: 128000,
      embeddingDimensions: 1536,
      capTools: true,
      capVision: true,
      capReasoning: true,
      capStructuredOutput: true,
      isEnabled: false,
    });

    expect(res).toEqual(updated);
    expect(chainable.set).toHaveBeenCalled();
    expect(chainable.where).toHaveBeenCalled();
  });

  it("updates model with individual optional fields", async () => {
    const updated = [{ id: "model-1" }];
    chainable.returning.mockResolvedValue(updated);

    await updateModels("model-1", { label: "Custom Label" });
    await updateModels("model-1", { modelType: "chat" });
    await updateModels("model-1", { contextWindow: 4096 });
    await updateModels("model-1", { embeddingDimensions: 768 });
    await updateModels("model-1", { embeddingDimensions: null });
    await updateModels("model-1", { capTools: true });
    await updateModels("model-1", { capTools: false });
    await updateModels("model-1", { capVision: true });
    await updateModels("model-1", { capVision: false });
    await updateModels("model-1", { capReasoning: true });
    await updateModels("model-1", { capReasoning: false });
    await updateModels("model-1", { capStructuredOutput: true });
    await updateModels("model-1", { capStructuredOutput: false });
    await updateModels("model-1", { isEnabled: true });
    await updateModels("model-1", { isEnabled: false });
    await updateModels(["model-1"], { label: "Single Array" });

    expect(chainable.set).toHaveBeenCalledTimes(16);
  });
});
