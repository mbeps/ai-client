import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c: any = {};
  for (const m of [
    "select",
    "from",
    "where",
    "orderBy",
    "limit",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  c.returning = vi.fn().mockResolvedValue([]);
  c.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

const requireSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: requireSessionMock,
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

import { startTransformRunAction } from "@/actions/transform-runs/start-transform-run";
import { inngest } from "@/lib/inngest/client";

describe("startTransformRunAction", () => {
  const userId = "user-123";
  const runId = "123e4567-e89b-12d3-a456-426614174001";

  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({
      user: { id: userId, email: "test@example.com" },
      session: { id: "sess-1" },
    });
    for (const m of [
      "select",
      "from",
      "where",
      "orderBy",
      "limit",
      "insert",
      "values",
      "update",
      "set",
      "delete",
    ]) {
      chainable[m].mockImplementation(() => chainable);
    }
    chainable.returning.mockResolvedValue([]);
    chainable.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);
  });

  it("atomically claims pending run, updates status to running, and dispatches inngest event", async () => {
    const claimedRun = {
      id: runId,
      userId,
      status: "running",
      currentStepIndex: 0,
    };
    chainable.returning.mockResolvedValueOnce([claimedRun]);

    const result = await startTransformRunAction(runId);

    expect(result).toEqual({ success: true });
    expect(chainable.update).toHaveBeenCalled();
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "running",
      }),
    );
    expect(inngest.send).toHaveBeenCalledWith({
      name: "workflows/transform.execute",
      data: {
        runId,
        userId,
        startFromStep: 0,
      },
    });
  });

  it("returns early when run is already claimed or running without double-dispatching inngest event", async () => {
    // Atomic update returns empty (already claimed / not pending)
    chainable.returning.mockResolvedValueOnce([]);
    // Select confirms run exists for this user
    chainable.then = (onFulfilled: any) =>
      Promise.resolve([{ id: runId, userId, status: "running" }]).then(
        onFulfilled,
      );

    const result = await startTransformRunAction(runId);

    expect(result).toEqual({ success: true });
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it("throws Error('Transform run not found') when run does not exist or user does not own it", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    chainable.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);

    await expect(startTransformRunAction(runId)).rejects.toThrow(
      "Transform run not found",
    );
    expect(inngest.send).not.toHaveBeenCalled();
  });
});

