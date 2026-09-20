import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockUpdateSet = vi.hoisted(() => vi.fn().mockReturnValue({ where: mockUpdateWhere }));
const mockUpdate = vi.hoisted(() => vi.fn().mockReturnValue({ set: mockUpdateSet }));

const chainable = vi.hoisted(() => {
  const c = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: mockSelectWhere,
      })),
    })),
    update: mockUpdate,
    where: mockSelectWhere,
  };
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

  it("handles step execution failure and returns success: false", async () => {
    const runRow = {
      id: "run-fail",
      agentId: "agent-fail",
      currentStepIndex: 0,
      outputAttachmentIds: [],
    };
    const agentRow = {
      id: "agent-fail",
      requiresFileUpload: false,
      steps: JSON.stringify([{ id: "s1", name: "Fail Step", order: 0 }]),
    };

    let selectCall = 0;
    chainable.where.mockImplementation(() => {
      selectCall++;
      if (selectCall % 2 === 1) return Promise.resolve([runRow]);
      return Promise.resolve([agentRow]);
    });

    mockRunSteps.mockResolvedValueOnce({
      success: false,
    });

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => any) => fn()),
      waitForEvent: vi.fn(),
    };

    const fn = (executeTransformRun as any).fn;
    const result = await fn({
      event: {
        data: {
          runId: "run-fail",
          userId: "user-1",
          startFromStep: 0,
        },
      },
      step: mockStep,
    });

    expect(result).toEqual({ success: false });
  });

  it("handles requiresFileUpload when resuming from step > 0 with prior output attachments", async () => {
    const runRow = {
      id: "run-files",
      agentId: "agent-files",
      currentStepIndex: 1,
      inputAttachmentIds: ["in-1"],
      outputAttachmentIds: ["out-stage-0"],
    };
    const agentRow = {
      id: "agent-files",
      requiresFileUpload: true,
      steps: JSON.stringify([
        { id: "s0", name: "Step 0", order: 0 },
        { id: "s1", name: "Step 1", order: 1, toolIds: ["internal:tool:manage_artifact"] },
      ]),
    };

    let selectCall = 0;
    chainable.where.mockImplementation(() => {
      selectCall++;
      if (selectCall % 2 === 1) return Promise.resolve([runRow]);
      return Promise.resolve([agentRow]);
    });

    mockRunSteps.mockResolvedValueOnce({
      success: true,
      paused: false,
      currentOutputAttachmentIds: ["out-stage-1"],
    });

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => any) => fn()),
      waitForEvent: vi.fn(),
    };

    const fn = (executeTransformRun as any).fn;
    const result = await fn({
      event: {
        data: {
          runId: "run-files",
          userId: "user-1",
          startFromStep: 1,
        },
      },
      step: mockStep,
    });

    expect(result).toEqual({ success: true, completed: true });
    expect(mockRunSteps).toHaveBeenCalledWith(
      expect.objectContaining({
        startFromStep: 1,
      }),
    );
  });

  it("completes immediately when steps array is empty", async () => {
    const runRow = {
      id: "run-empty",
      agentId: "agent-empty",
      currentStepIndex: 0,
      outputAttachmentIds: [],
    };
    const agentRow = {
      id: "agent-empty",
      requiresFileUpload: false,
      steps: JSON.stringify([]),
    };

    chainable.where
      .mockResolvedValueOnce([runRow])
      .mockResolvedValueOnce([agentRow]);

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => any) => fn()),
      waitForEvent: vi.fn(),
    };

    const fn = (executeTransformRun as any).fn;
    const result = await fn({
      event: {
        data: {
          runId: "run-empty",
          userId: "user-1",
          startFromStep: 0,
        },
      },
      step: mockStep,
    });

    expect(result).toEqual({ success: true, completed: true });
    expect(mockRunSteps).not.toHaveBeenCalled();
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "transform-complete",
        runId: "run-empty",
        outputAttachmentIds: [],
      }),
    );
  });

  it("handles realtime publish failure in emit", async () => {
    const publishSpy = vi
      .spyOn(inngest.realtime, "publish")
      .mockRejectedValueOnce(new Error("Publish failed"));

    const runRow = {
      id: "run-pub-err",
      agentId: "agent-1",
      currentStepIndex: 0,
      outputAttachmentIds: [],
    };
    const agentRow = {
      id: "agent-1",
      requiresFileUpload: false,
      steps: JSON.stringify([]),
    };

    chainable.where
      .mockResolvedValueOnce([runRow])
      .mockResolvedValueOnce([agentRow]);

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => any) => fn()),
      waitForEvent: vi.fn(),
    };

    const fn = (executeTransformRun as any).fn;
    const result = await fn({
      event: {
        data: {
          runId: "run-pub-err",
          userId: "user-1",
          startFromStep: 0,
        },
      },
      step: mockStep,
    });

    expect(result).toEqual({ success: true, completed: true });
    expect(publishSpy).toHaveBeenCalled();
  });

  it("handles corrupted agentRow.steps JSON in initialize-run", async () => {
    const runRow = {
      id: "run-corrupted",
      agentId: "agent-corrupted",
      currentStepIndex: 0,
      outputAttachmentIds: [],
    };
    const agentRow = {
      id: "agent-corrupted",
      requiresFileUpload: false,
      steps: "{ not valid json",
    };

    chainable.where
      .mockResolvedValueOnce([runRow])
      .mockResolvedValueOnce([agentRow]);

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => any) => fn()),
      waitForEvent: vi.fn(),
    };

    const fn = (executeTransformRun as any).fn;
    const result = await fn({
      event: {
        data: {
          runId: "run-corrupted",
          userId: "user-1",
          startFromStep: 0,
        },
      },
      step: mockStep,
    });

    expect(result).toEqual({ success: true, completed: true });
  });

  it("handles requiresFileUpload at step 0 with nullish inputs and invalid agent steps JSON in execute-step", async () => {
    const runRow = {
      id: "run-step0-files",
      agentId: "agent-step0",
      currentStepIndex: 0,
      inputAttachmentIds: null,
      outputAttachmentIds: null,
    };
    const agentRow = {
      id: "agent-step0",
      requiresFileUpload: true,
      steps: JSON.stringify([
        { id: "s0", name: "Step 0", order: 0 },
      ]),
    };
    const agentRowBadSteps = {
      ...agentRow,
      steps: "invalid-json-in-execute",
    };

    let selectCall = 0;
    chainable.where.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return Promise.resolve([runRow]);
      if (selectCall === 2) return Promise.resolve([agentRow]);
      if (selectCall === 3) return Promise.resolve([runRow]);
      if (selectCall === 4) return Promise.resolve([agentRowBadSteps]);
      // Finalize run check
      return Promise.resolve([{ ...runRow, outputAttachmentIds: ["fallback-out-1"] }]);
    });

    mockRunSteps.mockResolvedValueOnce({
      success: true,
      paused: false,
      currentOutputAttachmentIds: undefined,
    });

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => any) => fn()),
      waitForEvent: vi.fn(),
    };

    const fn = (executeTransformRun as any).fn;
    const result = await fn({
      event: {
        data: {
          runId: "run-step0-files",
          userId: "user-1",
          startFromStep: 0,
        },
      },
      step: mockStep,
    });

    expect(result).toEqual({ success: true, completed: true });
  });
});
