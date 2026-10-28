import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["update", "set"]) c[m] = vi.fn();
  c.where = vi.fn().mockImplementation(() => c);
  c.update.mockImplementation(() => c);
  c.set.mockImplementation(() => c);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    CHAT_MAX_STEPS: 10,
    NODE_ENV: "test",
  },
}));

vi.mock("ai", () => ({
  tool: vi.fn((config: unknown) => config),
  generateText: vi.fn().mockResolvedValue({
    text: "step done",
    steps: [
      {
        toolCalls: [],
        toolResults: [
          {
            toolCallId: "tc-1",
            toolName: "upload_file",
            result: { file_path: "/tmp/step-workbook.xlsx" },
          },
        ],
      },
    ],
  }),
  isStepCount: vi.fn(),
}));

vi.mock("@/lib/transform/build-file-context", () => ({
  buildFileContext: vi.fn().mockResolvedValue({ attachmentRows: [] }),
}));

vi.mock("@/lib/transform/persist-artifact", () => ({
  persistTransformArtifact: vi.fn(),
}));

import { transformRun } from "@/drizzle/schemas/transform-agent-schema";
import { runTransformSteps } from "@/lib/transform/run-steps";

const BASE_OPTIONS = {
  runRow: { id: "run-single-step" },
  agentRow: {
    id: "agent-1",
    name: "test-agent",
    description: null,
    globalContext: null,
    requiresFileUpload: false,
    tools: null,
    modelId: null,
  },
  userId: "user-1",
  allServers: [],
  resolvedProvider: {
    sdkProvider: { chat: () => () => {} },
    modelId: "test-model",
  } as any,
  kbContext: "",
  runMcpTools: {},
  runToolSourceMap: {},
  initialAttachmentRows: [],
};

describe("runTransformSteps singleStep & initialWorkbookFilePath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.update.mockImplementation(() => chainable);
    chainable.set.mockImplementation(() => chainable);
    chainable.where.mockImplementation(() => chainable);
  });

  it("executes only one step when singleStep is true even if multiple steps exist", async () => {
    const steps = [
      {
        order: 0,
        name: "step-0",
        prompt: "first",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: false,
      },
      {
        order: 1,
        name: "step-1",
        prompt: "second",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: false,
      },
    ];
    const emitted: any[] = [];

    const result = await runTransformSteps({
      ...BASE_OPTIONS,
      steps,
      startFromStep: 0,
      singleStep: true,
      emit: (d) => emitted.push(d),
    });

    expect(result.success).toBe(true);
    expect(result.paused).toBe(false);

    const stepStarts = emitted.filter((e) => e.type === "transform-step-start");
    expect(stepStarts).toHaveLength(1);
    expect(stepStarts[0].stepName).toBe("step-0");
  });

  it("threads initialWorkbookFilePath and returns activeWorkbookFilePath in result", async () => {
    const steps = [
      {
        order: 0,
        name: "step-0",
        prompt: "process",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: false,
      },
    ];

    const result = await runTransformSteps({
      ...BASE_OPTIONS,
      steps,
      startFromStep: 0,
      singleStep: true,
      initialWorkbookFilePath: "/tmp/incoming.xlsx",
      emit: () => {},
    });

    expect(result.success).toBe(true);
    expect(result.activeWorkbookFilePath).toBe("/tmp/step-workbook.xlsx");
  });

  it("merges currentStepIndex and updatedAt into a single db.update call per step", async () => {
    const steps = [
      {
        order: 0,
        name: "step-0",
        prompt: "first",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: false,
      },
    ];

    await runTransformSteps({
      ...BASE_OPTIONS,
      steps,
      startFromStep: 0,
      singleStep: true,
      emit: () => {},
    });

    const setCalls = chainable.set.mock.calls.filter(
      ([arg]) =>
        arg !== null &&
        typeof arg === "object" &&
        "currentStepIndex" in arg &&
        "updatedAt" in arg,
    );

    expect(setCalls).toHaveLength(1);
    expect(setCalls[0][0].currentStepIndex).toBe(0);
    expect(setCalls[0][0].updatedAt).toBeInstanceOf(Date);
    expect(chainable.update).toHaveBeenCalledWith(transformRun);
  });
});

