import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c: any = {};
  for (const m of ["select", "from", "where", "update", "set"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  c.returning = vi.fn().mockResolvedValue([]);
  c.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User" },
    session: { id: "session-1" },
  }),
}));

vi.mock("inngest/react", () => ({
  getClientSubscriptionToken: vi.fn().mockResolvedValue("mock-client-token"),
}));

import { approveTransformRunAction } from "@/actions/transform-runs/approve-transform-run";
import { getTransformRunRealtimeToken } from "@/actions/transform-runs/get-transform-run-realtime-token";
import { startTransformRunAction } from "@/actions/transform-runs/start-transform-run";
import { inngest } from "@/lib/inngest/client";

describe("Transform Run Inngest Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const m of ["select", "from", "where", "update", "set"]) {
      chainable[m].mockImplementation(() => chainable);
    }
    chainable.returning.mockResolvedValue([]);
    chainable.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);
  });

  describe("startTransformRunAction", () => {
    it("throws an error when transform run is not found or not owned by user", async () => {
      chainable.returning.mockResolvedValueOnce([]);
      chainable.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);

      await expect(startTransformRunAction("run-123")).rejects.toThrow(
        "Transform run not found",
      );
    });

    it("dispatches workflows/transform.execute event when valid", async () => {
      chainable.returning.mockResolvedValueOnce([
        { id: "run-123", currentStepIndex: 2 },
      ]);

      const result = await startTransformRunAction("run-123");

      expect(result).toEqual({ success: true });
      expect(inngest.send).toHaveBeenCalledWith({
        name: "workflows/transform.execute",
        data: {
          runId: "run-123",
          userId: "user-1",
          startFromStep: 2,
        },
      });
    });

    it("falls back startFromStep to 0 when currentStepIndex is null", async () => {
      chainable.returning.mockResolvedValueOnce([
        { id: "run-123", currentStepIndex: null },
      ]);

      const result = await startTransformRunAction("run-123");

      expect(result).toEqual({ success: true });
      expect(inngest.send).toHaveBeenCalledWith({
        name: "workflows/transform.execute",
        data: {
          runId: "run-123",
          userId: "user-1",
          startFromStep: 0,
        },
      });
    });
  });

  describe("approveTransformRunAction", () => {
    it("throws an error when transform run is not found", async () => {
      chainable.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);

      await expect(approveTransformRunAction("run-123")).rejects.toThrow(
        "Transform run not found",
      );
    });

    it("dispatches workflows/transform.approved event when valid", async () => {
      chainable.then = (onFulfilled: any) =>
        Promise.resolve([{ id: "run-123" }]).then(onFulfilled);

      const result = await approveTransformRunAction("run-123");

      expect(result).toEqual({ success: true });
      expect(inngest.send).toHaveBeenCalledWith({
        name: "workflows/transform.approved",
        data: { runId: "run-123" },
      });
    });
  });

  describe("getTransformRunRealtimeToken", () => {
    it("throws an error when unauthorized", async () => {
      chainable.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);

      await expect(getTransformRunRealtimeToken("run-123")).rejects.toThrow(
        "Unauthorized",
      );
    });

    it("returns client subscription token for authorized user", async () => {
      chainable.then = (onFulfilled: any) =>
        Promise.resolve([{ id: "run-123" }]).then(onFulfilled);

      const token = await getTransformRunRealtimeToken("run-123");
      expect(token).toBe("mock-client-token");
    });
  });
});

