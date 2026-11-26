import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidArtifactFormatError } from "@/lib/error/invalid-artifact-format-error";

const {
  mockUpdate,
  mockSet,
  mockWhere,
  mockPersistWorkflowArtifact,
  mockApplyDownloadFallbackIfMutated,
} = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));
  return {
    mockUpdate,
    mockSet,
    mockWhere,
    mockPersistWorkflowArtifact: vi.fn(),
    mockApplyDownloadFallbackIfMutated: vi.fn(),
  };
});

vi.mock("@/drizzle/db", () => ({
  db: { update: mockUpdate },
}));

vi.mock("@/lib/workflows/persist-artifact", () => ({
  persistWorkflowArtifact: mockPersistWorkflowArtifact,
}));

vi.mock("@/lib/workflows/step-workbook-fallback", () => ({
  applyDownloadFallbackIfMutated: mockApplyDownloadFallbackIfMutated,
}));

import { handleStepArtifactOutput } from "@/lib/workflows/step-artifact-output";

const baseParams = () => ({
  stepName: "Step 1",
  stepIndex: 0,
  userId: "user-1",
  runId: "run-1",
  stepArtifact: null as Record<string, unknown> | null,
  stepHasSpreadsheetMutations: false,
  activeWorkbookFilePath: null as string | null,
  currentOutputAttachmentIds: ["att-0"],
  currentAttachmentRows: [{ id: "att-0", name: "input.xlsx" }] as any[],
  runMcpTools: {},
  runToolSourceMap: {},
  stepServerNames: new Set<string>(),
  emit: vi.fn(),
});

describe("handleStepArtifactOutput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApplyDownloadFallbackIfMutated.mockResolvedValue(null);
  });

  it("returns success with unchanged state when no artifact and no mutations", async () => {
    const res = await handleStepArtifactOutput(baseParams());
    expect(res.success).toBe(true);
    expect(res.currentOutputAttachmentIds).toEqual(["att-0"]);
  });

  it("persists valid explicit artifact and clears activeWorkbookFilePath", async () => {
    mockPersistWorkflowArtifact.mockResolvedValue({
      attachmentRow: { id: "att-1", name: "out.xlsx" },
      outputAttachmentIds: ["att-1"],
    });
    const params = {
      ...baseParams(),
      stepArtifact: { type: "spreadsheet", content: "{}" },
      activeWorkbookFilePath: "/tmp/wb.xlsx",
    };
    const res = await handleStepArtifactOutput(params);
    expect(res.success).toBe(true);
    expect(res.stepOutputAttachmentId).toBe("att-1");
    expect(res.currentOutputAttachmentIds).toEqual(["att-0", "att-1"]);
    expect(res.activeWorkbookFilePath).toBeNull();
  });

  it("handles persistWorkflowArtifact returning null without applying output", async () => {
    mockPersistWorkflowArtifact.mockResolvedValue(null);
    const params = {
      ...baseParams(),
      stepArtifact: { type: "spreadsheet", content: "{}" },
      activeWorkbookFilePath: "/tmp/wb.xlsx",
    };
    const res = await handleStepArtifactOutput(params);
    expect(res.success).toBe(true);
    expect(res.stepOutputAttachmentId).toBeUndefined();
    expect(res.currentOutputAttachmentIds).toEqual(["att-0"]);
    expect(res.activeWorkbookFilePath).toBe("/tmp/wb.xlsx");
  });

  it("handles InvalidArtifactFormatError by failing run and emitting error", async () => {
    mockPersistWorkflowArtifact.mockRejectedValue(
      new InvalidArtifactFormatError("bad sheets"),
    );
    const params = {
      ...baseParams(),
      stepArtifact: { type: "spreadsheet", content: "bad" },
    };
    const res = await handleStepArtifactOutput(params);
    expect(res.success).toBe(false);
    expect(mockUpdate).toHaveBeenCalled();
    expect(params.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });

  it("rethrows unexpected errors from persistWorkflowArtifact", async () => {
    mockPersistWorkflowArtifact.mockRejectedValue(new Error("db down"));
    const params = {
      ...baseParams(),
      stepArtifact: { type: "spreadsheet", content: "{}" },
    };
    await expect(handleStepArtifactOutput(params)).rejects.toThrow("db down");
  });

  it("applies fallback result when mutated without explicit artifact", async () => {
    mockApplyDownloadFallbackIfMutated.mockResolvedValue({
      currentOutputIds: ["att-0", "att-2"],
      currentRows: [{ id: "att-2", name: "fb.xlsx" }],
      stepOutputAttachmentId: "att-2",
      artifact: { type: "spreadsheet", content: "{}" },
    });
    const params = {
      ...baseParams(),
      stepHasSpreadsheetMutations: true,
      currentAttachmentRows: [],
    };
    const res = await handleStepArtifactOutput(params);
    expect(res.success).toBe(true);
    expect(res.stepOutputAttachmentId).toBe("att-2");
  });

  it("fails closed when spreadsheet mutated without any persisted output", async () => {
    const params = {
      ...baseParams(),
      stepHasSpreadsheetMutations: true,
    };
    const res = await handleStepArtifactOutput(params);
    expect(res.success).toBe(false);
    expect(mockUpdate).toHaveBeenCalled();
    expect(params.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });

  it("succeeds when persistWorkflowArtifact returns null", async () => {
    mockPersistWorkflowArtifact.mockResolvedValue(null as any);
    const params = baseParams();
    const res = await handleStepArtifactOutput(params);
    expect(res.success).toBe(true);
    expect(res.stepOutputAttachmentId).toBeUndefined();
  });
});
