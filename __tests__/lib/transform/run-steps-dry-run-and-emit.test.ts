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

const mockGenerateText = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({
  tool: vi.fn((config: unknown) => config),
  generateText: mockGenerateText,
  isStepCount: vi.fn(),
}));

vi.mock("@/lib/transform/build-file-context", () => ({
  buildFileContext: vi.fn().mockResolvedValue({ attachmentRows: [] }),
}));

vi.mock("@/lib/transform/persist-artifact", () => ({
  persistTransformArtifact: vi.fn(),
}));

import { runTransformSteps } from "@/lib/transform/run-steps";

const BASE_OPTIONS = {
  runRow: { id: "run-dry-emit" },
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
  allServers: [{ id: "srv-1", name: "excel-server" }],
  resolvedProvider: {
    sdkProvider: { chat: () => () => {} },
    modelId: "test-model",
  } as any,
  kbContext: "",
  runMcpTools: {
    read_sheet: { execute: vi.fn() },
    write_sheet: { execute: vi.fn() },
  },
  runToolSourceMap: {
    read_sheet: "excel-server",
    write_sheet: "excel-server",
  },
  initialAttachmentRows: [],
};

describe("runTransformSteps dryRun and awaited emit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.update.mockImplementation(() => chainable);
    chainable.set.mockImplementation(() => chainable);
    chainable.where.mockImplementation(() => chainable);
    mockGenerateText.mockResolvedValue({
      text: "step complete",
      steps: [
        {
          toolCalls: [],
          toolResults: [],
        },
      ],
    });
  });

  it("injects dryRun instructions and filters out mutation tools when dryRun is true", async () => {
    const steps = [
      {
        order: 0,
        name: "step-0",
        prompt: "analyze spreadsheet",
        mcpServerIds: ["srv-1"],
        toolIds: [],
        requiresReview: false,
      },
    ];

    const result = await runTransformSteps({
      ...BASE_OPTIONS,
      steps,
      startFromStep: 0,
      singleStep: true,
      dryRun: true,
      emit: vi.fn(),
    });

    expect(result.success).toBe(true);
    expect(mockGenerateText).toHaveBeenCalledTimes(1);

    const callArgs = mockGenerateText.mock.calls[0][0];
    // Instructions should contain DRY RUN MODE
    expect(callArgs.instructions).toContain("DRY RUN MODE:");
    // Mutation tools like write_sheet must be excluded, while read_sheet is preserved
    expect(callArgs.tools).toHaveProperty("read_sheet");
    expect(callArgs.tools).not.toHaveProperty("write_sheet");
  });

  it("awaits async emit callbacks during step execution", async () => {
    const steps = [
      {
        order: 0,
        name: "step-0",
        prompt: "test emit",
        mcpServerIds: ["srv-1"],
        toolIds: [],
        requiresReview: false,
      },
    ];

    mockGenerateText.mockResolvedValueOnce({
      text: "with tools",
      steps: [
        {
          toolCalls: [
            {
              toolCallId: "tc-1",
              toolName: "read_sheet",
              args: { sheet: "Sheet1" },
            },
          ],
          toolResults: [
            {
              toolCallId: "tc-1",
              toolName: "read_sheet",
              result: { data: [1, 2, 3] },
            },
          ],
        },
      ],
    });

    let asyncEmitResolved = false;
    const emit = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      asyncEmitResolved = true;
    });

    const result = await runTransformSteps({
      ...BASE_OPTIONS,
      steps,
      startFromStep: 0,
      singleStep: true,
      emit,
    });

    expect(result.success).toBe(true);
    // When runTransformSteps resolves, the async emit promises must have finished
    expect(asyncEmitResolved).toBe(true);
    expect(emit).toHaveBeenCalled();
  });
});

