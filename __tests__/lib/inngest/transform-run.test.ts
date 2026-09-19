import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["select", "from", "update", "set"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  c.where = vi.fn();
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

const mockRunSteps = vi.hoisted(() => vi.fn());
vi.mock("@/lib/transform/run-steps", () => ({
  runTransformSteps: mockRunSteps,
}));

vi.mock("@/lib/transform/load-transform-context", () => ({
  loadTransformContext: vi.fn().mockResolvedValue({
    allServers: [],
    resolvedProvider: { sdkProvider: { chat: () => () => {} }, modelId: "m" },
    kbContext: "",
    runMcpTools: {},
    runToolSourceMap: {},
    mcpCleanup: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/lib/transform/build-file-context", () => ({
  buildFileContext: vi.fn().mockResolvedValue({ attachmentRows: [] }),
}));

vi.mock("@/lib/transform/lifecycle-service", () => ({
  validateStepOrders: vi.fn(),
}));

import { executeTransformRun } from "@/lib/inngest/functions/transform-run";
import { inngest } from "@/lib/inngest/client";

describe("executeTransformRun Inngest Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes run, executes steps, and marks run completed", async () => {
    const runRow = {
      id: "run-1",
      agentId: "agent-1",
      currentStepIndex: 0,
      outputAttachmentIds: [],
    };
    const agentRow = {
      id: "agent-1",
      requiresFileUpload: false,
      steps: JSON.stringify([
        { id: "s1", name: "Step 1", order: 0, prompt: "test" },
      ]),
    };

    let selectCall = 0;
    chainable.where.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return Promise.resolve([runRow]);
      if (selectCall === 2) return Promise.resolve([agentRow]);
      if (selectCall === 3) return Promise.resolve([runRow]);
      if (selectCall === 4) return Promise.resolve([agentRow]);
      return Promise.resolve([runRow]);
    });

    mockRunSteps.mockResolvedValueOnce({
      success: true,
      paused: false,
      currentOutputAttachmentIds: ["out-att-1"],
    });

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => any) => fn()),
      waitForEvent: vi.fn().mockResolvedValue({ data: { runId: "run-1" } }),
    };

    const fn = (executeTransformRun as any).fn;
    const result = await fn({
      event: {
        data: {
          runId: "run-1",
          userId: "user-1",
          startFromStep: 0,
        },
      },
      step: mockStep,
    });

    expect(result).toEqual({ success: true, completed: true });
    expect(mockRunSteps).toHaveBeenCalledTimes(1);
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "transform-start", runId: "run-1" }),
    );
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "transform-complete",
        runId: "run-1",
        outputAttachmentIds: ["out-att-1"],
      }),
    );
  });

  it("handles review pause and awaits workflows/transform.approved event", async () => {
    const runRow = {
      id: "run-1",
      agentId: "agent-1",
      currentStepIndex: 0,
      outputAttachmentIds: [],
    };
    const agentRow = {
      id: "agent-1",
      requiresFileUpload: false,
      steps: JSON.stringify([
        { id: "s1", name: "Step 1", order: 0, requiresReview: true },
        { id: "s2", name: "Step 2", order: 1 },
      ]),
    };

    let selectCall = 0;
    chainable.where.mockImplementation(() => {
      selectCall++;
      if (selectCall % 2 === 0) return Promise.resolve([agentRow]);
      return Promise.resolve([runRow]);
    });

    // Step 0 pauses for review, Step 1 completes
    mockRunSteps
      .mockResolvedValueOnce({
        success: true,
        paused: true,
        currentOutputAttachmentIds: ["stage-1"],
      })
      .mockResolvedValueOnce({
        success: true,
        paused: false,
        currentOutputAttachmentIds: ["stage-2"],
      });

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => any) => fn()),
      waitForEvent: vi.fn().mockResolvedValue({ data: { runId: "run-1" } }),
    };

    const fn = (executeTransformRun as any).fn;
    const result = await fn({
      event: {
        data: {
          runId: "run-1",
          userId: "user-1",
          startFromStep: 0,
        },
      },
      step: mockStep,
    });

    expect(result).toEqual({ success: true, completed: true });
    expect(mockStep.waitForEvent).toHaveBeenCalledWith(
      "wait-for-review-approval",
      expect.objectContaining({
        event: "workflows/transform.approved",
        match: "data.runId",
      }),
    );
    expect(mockRunSteps).toHaveBeenCalledTimes(2);
  });
});
