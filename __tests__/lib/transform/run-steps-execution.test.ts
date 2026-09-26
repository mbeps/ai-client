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

const buildFileContextMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/transform/build-file-context", () => ({
  buildFileContext: buildFileContextMock,
}));

const persistTransformArtifactMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/transform/persist-artifact", () => ({
  persistTransformArtifact: persistTransformArtifactMock,
}));

const generateTextMock = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({
  generateText: generateTextMock,
  isStepCount: vi.fn(),
}));

import { runTransformSteps } from "@/lib/transform/run-steps";

const MOCK_PROVIDER = {
  modelId: "gpt-4",
  providerId: "openai",
  apiKey: "key",
  baseUrl: "https://api.openai.com",
  sdkProvider: {
    chat: vi.fn().mockReturnValue("mock-chat-model"),
  },
};

describe("runTransformSteps — execution flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.where.mockImplementation(() => c => c);
    chainable.update.mockImplementation(() => chainable);
    chainable.set.mockImplementation(() => chainable);
  });

  it("handles multi-step run with upload_file, single-workbook guard, and manage_artifact output", async () => {
    buildFileContextMock.mockResolvedValue({
      fileContext: "Initial file context",
      attachmentRows: [{ id: "att-1", name: "initial.xlsx" }],
    });

    persistTransformArtifactMock.mockResolvedValue({
      outputAttachmentIds: ["att-out-1"],
      attachmentRow: { id: "att-out-1", name: "step-1-output.xlsx" },
    });

    // Step 0: calls upload_file and manage_artifact
    generateTextMock.mockResolvedValueOnce({
      text: "Step 0 completed",
      steps: [
        {
          toolCalls: [
            { toolCallId: "tc-up", toolName: "upload_file", args: { file: "test" } },
            { toolCallId: "tc-art", toolName: "manage_artifact", input: { action: "create" } },
          ],
          toolResults: [
            {
              toolCallId: "tc-up",
              toolName: "upload_file",
              result: { file_path: "/tmp/active_sheet.xlsx" },
            },
            {
              toolCallId: "tc-art",
              toolName: "manage_artifact",
              output: {
                type: "spreadsheet",
                content: JSON.stringify([["A", "B"]]),
              },
            },
          ],
        },
      ],
    });

    // Step 1: simple step
    generateTextMock.mockResolvedValueOnce({
      text: "Step 1 completed",
      steps: [],
    });

    const emitted: any[] = [];
    const emit = (e: any) => emitted.push(e);

    const result = await runTransformSteps({
      steps: [
        {
          id: "s0",
          name: "Step 0",
          prompt: "Load file",
          order: 0,
          mcpServerIds: ["srv-1"],
          toolIds: ["internal:tool:upload_file", "internal:tool:manage_artifact"],
          requiresReview: false,
        },
        {
          id: "s1",
          name: "Step 1",
          prompt: "Process",
          order: 1,
          mcpServerIds: [],
          toolIds: [],
          requiresReview: false,
        },
      ],
      startFromStep: 0,
      runRow: { id: "run-exec" },
      agentRow: {
        id: "agent-1",
        name: "test-agent",
        description: "agent desc",
        globalContext: "global agent context",
        requiresFileUpload: true,
        tools: null,
        modelId: "gpt-4",
      },
      userId: "user-1",
      allServers: [{ id: "srv-1", name: "Server1" }],
      resolvedProvider: MOCK_PROVIDER as any,
      kbContext: "KB context info",
      runMcpTools: {
        upload_file: {},
        manage_artifact: {},
      },
      runToolSourceMap: {
        upload_file: "Server1",
        manage_artifact: "Internal",
      },
      initialAttachmentRows: [{ id: "att-1", name: "input.xlsx" } as any],
      emit,
    });

    expect(result.success).toBe(true);
    expect(persistTransformArtifactMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "artifact", stepIndex: 0 }),
      "user-1",
      "run-exec",
    );
    expect(emitted.some((e) => e.type === "tool-call")).toBe(true);
    expect(emitted.some((e) => e.type === "tool-result")).toBe(true);
  });

  it("handles spreadsheet mutation with download_file tool fallback", async () => {
    const downloadExecuteMock = vi.fn().mockResolvedValue({
      file_content: Buffer.from("downloaded-data").toString("base64"),
      filename: "mutated.xlsx",
    });

    persistTransformArtifactMock.mockResolvedValue({
      outputAttachmentIds: ["att-dl-1"],
      attachmentRow: { id: "att-dl-1", name: "mutated.xlsx" },
    });

    generateTextMock.mockResolvedValueOnce({
      text: "Mutation done",
      steps: [
        {
          toolCalls: [
            { toolCallId: "tc-mut", toolName: "write_cells", args: {} },
          ],
          toolResults: [
            {
              toolCallId: "tc-mut",
              toolName: "write_cells",
              result: "OK", // string result
            },
            {
              toolCallId: "tc-art-empty",
              toolName: "manage_artifact",
              result: null, // no extractable artifact
            },
          ],
        },
      ],
    });

    const emitted: any[] = [];
    const emit = (e: any) => emitted.push(e);

    // Initial attachment row + activeWorkbookFilePath set
    const result = await runTransformSteps({
      steps: [
        {
          id: "s0",
          name: "Mutation Step",
          prompt: "Mutate",
          order: 0,
          mcpServerIds: ["srv-1"],
          toolIds: [],
          requiresReview: false,
        },
      ],
      startFromStep: 0,
      runRow: { id: "run-dl" },
      agentRow: {
        id: "agent-1",
        name: "mutation-agent",
        description: null,
        globalContext: null,
        requiresFileUpload: false,
        tools: null,
        modelId: null,
      },
      userId: "user-1",
      allServers: [{ id: "srv-1", name: "Server1" }],
      resolvedProvider: MOCK_PROVIDER as any,
      kbContext: "",
      runMcpTools: {
        write_cells: {},
        manage_artifact: {},
        download_file: { execute: downloadExecuteMock },
      },
      runToolSourceMap: {
        write_cells: "Server1",
        manage_artifact: "Internal",
        download_file: "Server1",
      },
      initialAttachmentRows: [],
      emit,
    });

    // Note: activeWorkbookFilePath was null so download_file was not called,
    // which leads to the fail-safe guard!
    expect(result.success).toBe(false);
    expect(emitted.some((e) => e.type === "error")).toBe(true);
  });

  it("handles rate limit error and non-rate-limit error during step execution", async () => {
    // 1. Rate limit error
    const rateLimitError = new Error("Rate limit exceeded: 429 Too Many Requests");
    (rateLimitError as any).status = 429;
    generateTextMock.mockRejectedValueOnce(rateLimitError);

    const emitted1: any[] = [];
    const result1 = await runTransformSteps({
      steps: [
        {
          id: "s0",
          name: "Rate Limit Step",
          prompt: "Prompt",
          order: 0,
          mcpServerIds: [],
          toolIds: [],
          requiresReview: false,
        },
      ],
      startFromStep: 0,
      runRow: { id: "run-rl" },
      agentRow: {
        id: "agent-1",
        name: "agent",
        description: null,
        globalContext: null,
        requiresFileUpload: false,
        tools: null,
        modelId: null,
      },
      userId: "user-1",
      allServers: [],
      resolvedProvider: MOCK_PROVIDER as any,
      kbContext: "",
      runMcpTools: {},
      runToolSourceMap: {},
      initialAttachmentRows: [],
      emit: (e) => emitted1.push(e),
    });

    expect(result1.success).toBe(false);
    expect(emitted1.some((e) => e.code === "RATE_LIMIT")).toBe(true);

    // 2. Generic error
    generateTextMock.mockRejectedValueOnce(new Error("Random crash"));
    const emitted2: any[] = [];
    const result2 = await runTransformSteps({
      steps: [
        {
          id: "s0",
          name: "Crash Step",
          prompt: "Prompt",
          order: 0,
          mcpServerIds: [],
          toolIds: [],
          requiresReview: false,
        },
      ],
      startFromStep: 0,
      runRow: { id: "run-crash" },
      agentRow: {
        id: "agent-1",
        name: "agent",
        description: null,
        globalContext: null,
        requiresFileUpload: false,
        tools: null,
        modelId: null,
      },
      userId: "user-1",
      allServers: [],
      resolvedProvider: MOCK_PROVIDER as any,
      kbContext: "",
      runMcpTools: {},
      runToolSourceMap: {},
      initialAttachmentRows: [],
      emit: (e) => emitted2.push(e),
    });

    expect(result2.success).toBe(false);
    expect(emitted2.some((e) => e.code === "ERROR")).toBe(true);
  });

  it("handles heartbeat update failure and download_file throwing error gracefully", async () => {
    // Make db update throw once for heartbeat
    chainable.set.mockImplementationOnce(() => {
      throw new Error("DB heartbeat fail");
    });

    const downloadExecuteMock = vi.fn().mockRejectedValue(new Error("Download failed"));

    // Step with upload_file to set activeWorkbookFilePath, and write_cells
    generateTextMock.mockResolvedValueOnce({
      text: "Step output",
      steps: [
        {
          toolCalls: [],
          toolResults: [
            {
              toolCallId: "tc-up",
              toolName: "upload_file",
              result: { file_path: "/tmp/active.xlsx" },
            },
            {
              toolCallId: "tc-mut",
              toolName: "write_cells",
              result: {},
            },
          ],
        },
      ],
    });

    const emitted: any[] = [];
    const result = await runTransformSteps({
      steps: [
        {
          id: "s0",
          name: "Heartbeat & Download Throw Step",
          prompt: "Prompt",
          order: 0,
          mcpServerIds: ["srv-1"],
          toolIds: [],
          requiresReview: false,
        },
      ],
      startFromStep: 0,
      runRow: { id: "run-hb-fail" },
      agentRow: {
        id: "agent-1",
        name: "agent",
        description: null,
        globalContext: null,
        requiresFileUpload: false,
        tools: null,
        modelId: null,
      },
      userId: "user-1",
      allServers: [{ id: "srv-1", name: "Server1" }],
      resolvedProvider: MOCK_PROVIDER as any,
      kbContext: "",
      runMcpTools: {
        upload_file: {},
        write_cells: {},
        download_file: { execute: downloadExecuteMock },
      },
      runToolSourceMap: {
        upload_file: "Server1",
        write_cells: "Server1",
        download_file: "Server1",
      },
      initialAttachmentRows: [],
      emit: (e) => emitted.push(e),
    });

    expect(result.success).toBe(false);
    expect(emitted.some((e) => e.type === "error")).toBe(true);
  });

  it("successfully persists with download_file fallback when activeWorkbookFilePath exists", async () => {
    const downloadExecuteMock = vi.fn().mockResolvedValue({
      file_content: Buffer.from("persisted").toString("base64"),
      filename: "saved.xlsx",
    });

    persistTransformArtifactMock.mockResolvedValue({
      outputAttachmentIds: ["att-saved-1"],
      attachmentRow: { id: "att-saved-1", name: "saved.xlsx" },
    });

    // Two steps: Step 0 calls upload_file, Step 1 does write_cells without manage_artifact
    generateTextMock.mockResolvedValueOnce({
      text: "Step 0 uploaded",
      steps: [
        {
          toolCalls: [],
          toolResults: [
            {
              toolCallId: "tc-up",
              toolName: "upload_file",
              result: { file_path: "/tmp/persisted.xlsx" },
            },
          ],
        },
      ],
    });

    generateTextMock.mockResolvedValueOnce({
      text: "Step 1 mutated",
      steps: [
        {
          toolCalls: [],
          toolResults: [
            {
              toolCallId: "tc-mut",
              toolName: "write_cells",
              result: {},
            },
          ],
        },
      ],
    });

    const emitted: any[] = [];
    const result = await runTransformSteps({
      steps: [
        {
          id: "s0",
          name: "Upload Step",
          prompt: "Prompt 0",
          order: 0,
          mcpServerIds: ["srv-1"],
          toolIds: [],
          requiresReview: false,
        },
        {
          id: "s1",
          name: "Mutation Step",
          prompt: "Prompt 1",
          order: 1,
          mcpServerIds: ["srv-1"],
          toolIds: [],
          requiresReview: false,
        },
      ],
      startFromStep: 0,
      runRow: { id: "run-dl-success" },
      agentRow: {
        id: "agent-1",
        name: "agent",
        description: null,
        globalContext: null,
        requiresFileUpload: true,
        tools: null,
        modelId: null,
      },
      userId: "user-1",
      allServers: [{ id: "srv-1", name: "Server1" }],
      resolvedProvider: MOCK_PROVIDER as any,
      kbContext: "",
      runMcpTools: {
        upload_file: {},
        write_cells: {},
        download_file: { execute: downloadExecuteMock },
      },
      runToolSourceMap: {
        upload_file: "Server1",
        write_cells: "Server1",
        download_file: "Server1",
      },
      initialAttachmentRows: [{ id: "att-orig", name: "orig.xlsx" } as any],
      emit: (e) => emitted.push(e),
    });

    expect(result.success).toBe(true);
    expect(persistTransformArtifactMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "download", stepIndex: 1 }),
      "user-1",
      "run-dl-success",
    );
  });
});

