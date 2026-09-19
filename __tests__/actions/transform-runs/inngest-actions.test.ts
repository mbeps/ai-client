import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["select", "from", "where"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
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

import {
  approveTransformRunAction,
  getTransformRunRealtimeToken,
  startTransformRunAction,
} from "@/actions/transform-runs/inngest-actions";
import { inngest } from "@/lib/inngest/client";

describe("Transform Run Inngest Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startTransformRunAction", () => {
    it("throws an error when transform run is not found or not owned by user", async () => {
      chainable.where.mockResolvedValueOnce([]);

      await expect(startTransformRunAction("run-123")).rejects.toThrow(
        "Transform run not found",
      );
    });

    it("dispatches workflows/transform.execute event when valid", async () => {
      chainable.where.mockResolvedValueOnce([
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
  });

  describe("approveTransformRunAction", () => {
    it("throws an error when transform run is not found", async () => {
      chainable.where.mockResolvedValueOnce([]);

      await expect(approveTransformRunAction("run-123")).rejects.toThrow(
        "Transform run not found",
      );
    });

    it("dispatches workflows/transform.approved event when valid", async () => {
      chainable.where.mockResolvedValueOnce([{ id: "run-123" }]);

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
      chainable.where.mockResolvedValueOnce([]);

      await expect(getTransformRunRealtimeToken("run-123")).rejects.toThrow(
        "Unauthorized",
      );
    });

    it("returns client subscription token for authorized user", async () => {
      chainable.where.mockResolvedValueOnce([{ id: "run-123" }]);

      const token = await getTransformRunRealtimeToken("run-123");
      expect(token).toBe("mock-client-token");
    });
  });
});

