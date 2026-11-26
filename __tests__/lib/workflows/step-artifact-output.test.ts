import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUpdateWhere,
  mockUpdateSet,
  mockDbUpdate,
  mockPersistWorkflowArtifact,
  mockApplyDownloadFallbackIfMutated,
} = vi.hoisted(() => {
  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockDbUpdate = vi.fn(() => ({ set: mockUpdateSet }));
  return {
    mockUpdateWhere,
    mockUpdateSet,
    mockDbUpdate,
    mockPersistWorkflowArtifact: vi.fn(),
    mockApplyDownloadFallbackIfMutated: vi.fn(),
  };
});

vi.mock("@/drizzle/db", () => ({
  db: {
    update: mockDbUpdate,
  },
}));

vi.mock("@/lib/workflows/persist-artifact", () => ({
  persistWorkflowArtifact: mockPersistWorkflowArtifact,
}));

vi.mock("@/lib/workflows/step-workbook-fallback", () => ({
  applyDownloadFallbackIfMutated: mockApplyDownloadFallbackIfMutated,
}));

import { InvalidArtifactFormatError } from "@/lib/error/invalid-artifact-format-error";
import {
  type HandleStepArtifactOutputParams,
  handleStepArtifactOutput,
} from "@/lib/workflows/step-artifact-output";

function makeBaseParams(
  overrides: Partial<HandleStepArtifactOutputParams> = {},
): HandleStepArtifactOutputParams {
  return {
    stepName: "Analyze",
    stepIndex: 0,
    userId: "user-1",
    runId: "run-1",
    stepArtifact: null,
    stepHasSpreadsheetMutations: false,
    activeWorkbookFilePath: "/tmp/book.xlsx",
    currentOutputAttachmentIds: ["att-0"],
    currentAttachmentRows: [],
    runMcpTools: {},
    runToolSourceMap: {},
    stepServerNames: new Set(),
    emit: vi.fn(),
    ...overrides,
  };
}

describe("handleStepArtifactOutput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateWhere.mockResolvedValue(undefined);
    mockApplyDownloadFallbackIfMutated.mockResolvedValue(null);
  });

  it("returns success with unchanged state when no artifact and no mutations", async () => {
    const result = await handleStepArtifactOutput(makeBaseParams());
    expect(result).toEqual({
      success: true,
      stepArtifact: null,
      stepOutputAttachmentId: undefined,
      currentOutputAttachmentIds: ["att-0"],
      currentAttachmentRows: [],
      activeWorkbookFilePath: "/tmp/book.xlsx",
    });
  });

  it("persists valid explicit artifact and clears activeWorkbookFilePath", async () => {
    const artifact = { type: "spreadsheet", content: "{}" };
    mockPersistWorkflowArtifact.mockResolvedValue({
      attachmentRow: { id: "att-1", name: "report.xlsx" },
      outputAttachmentIds: ["att-1"],
    });

    const result = await handleStepArtifactOutput(
      makeBaseParams({ stepArtifact: artifact }),
    );

    expect(result).toEqual({
      success: true,
      stepArtifact: artifact,
      stepOutputAttachmentId: "att-1",
      currentOutputAttachmentIds: ["att-0", "att-1"],
      currentAttachmentRows: [{ id: "att-1", name: "report.xlsx" }],
      activeWorkbookFilePath: null,
    });
  });

  it("handles persistWorkflowArtifact returning null for valid artifact", async () => {
    const artifact = { type: "spreadsheet", content: "{}" };
    mockPersistWorkflowArtifact.mockResolvedValue(null);

    const result = await handleStepArtifactOutput(
      makeBaseParams({
        stepArtifact: artifact,
        currentAttachmentRows: [{ id: "att-0", name: "input.xlsx" } as any],
      }),
    );

    expect(result.success).toBe(true);
    expect(mockApplyDownloadFallbackIfMutated).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultFilename: "input.xlsx",
      }),
    );
  });

  it("fails closed and emits error when persistWorkflowArtifact throws InvalidArtifactFormatError", async () => {
    const emit = vi.fn();
    mockPersistWorkflowArtifact.mockRejectedValue(
      new InvalidArtifactFormatError("missing sheets"),
    );

    const result = await handleStepArtifactOutput(
      makeBaseParams({
        stepArtifact: { type: "spreadsheet", content: "bad" },
        emit,
      }),
    );

    expect(result.success).toBe(false);
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorMessage: expect.stringContaining("missing sheets"),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        message: expect.stringContaining("missing sheets"),
      }),
    );
  });

  it("rethrows unexpected errors from persistWorkflowArtifact", async () => {
    mockPersistWorkflowArtifact.mockRejectedValue(new Error("S3 down"));

    await expect(
      handleStepArtifactOutput(
        makeBaseParams({
          stepArtifact: { type: "spreadsheet", content: "{}" },
        }),
      ),
    ).rejects.toThrow("S3 down");
  });

  it("applies fallback result when spreadsheet mutated without explicit artifact", async () => {
    const fallbackArtifact = { id: "step-0-wb", type: "spreadsheet", content: "{}" };
    mockApplyDownloadFallbackIfMutated.mockResolvedValue({
      currentOutputIds: ["att-0", "att-2"],
      currentRows: [{ id: "att-2", name: "fallback.xlsx" }],
      stepOutputAttachmentId: "att-2",
      artifact: fallbackArtifact,
    });

    const result = await handleStepArtifactOutput(
      makeBaseParams({
        stepHasSpreadsheetMutations: true,
      }),
    );

    expect(result).toEqual({
      success: true,
      stepArtifact: fallbackArtifact,
      stepOutputAttachmentId: "att-2",
      currentOutputAttachmentIds: ["att-0", "att-2"],
      currentAttachmentRows: [{ id: "att-2", name: "fallback.xlsx" }],
      activeWorkbookFilePath: "/tmp/book.xlsx",
    });
  });

  it("fails closed when spreadsheet mutated and neither explicit nor fallback persistence succeeded", async () => {
    const emit = vi.fn();
    mockApplyDownloadFallbackIfMutated.mockResolvedValue(null);

    const result = await handleStepArtifactOutput(
      makeBaseParams({
        stepHasSpreadsheetMutations: true,
        emit,
      }),
    );

    expect(result.success).toBe(false);
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith({
      type: "error",
      message: expect.stringContaining("changed workbook data"),
    });
  });
});
