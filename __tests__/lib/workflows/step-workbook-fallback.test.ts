import { beforeEach, describe, expect, it, vi } from "vitest";
import * as xlsx from "xlsx";

vi.mock("xlsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("xlsx")>();
  return {
    ...actual,
    read: vi.fn((...args: Parameters<typeof actual.read>) =>
      actual.read(...args),
    ),
  };
});

const { mockPersistWorkflowArtifact, mockExtractDownloadFilePayload, mockWarn } =
  vi.hoisted(() => ({
    mockPersistWorkflowArtifact: vi.fn(),
    mockExtractDownloadFilePayload: vi.fn(),
    mockWarn: vi.fn(),
  }));

vi.mock("@/lib/workflows/persist-artifact", () => ({
  persistWorkflowArtifact: mockPersistWorkflowArtifact,
}));

vi.mock("@/lib/workflows/extract-download-file-payload", () => ({
  extractDownloadFilePayload: mockExtractDownloadFilePayload,
}));

vi.mock("@/lib/logger", () => {
  const mockLog = { warn: mockWarn, error: vi.fn(), info: vi.fn(), debug: vi.fn() };
  return { getLogger: vi.fn(() => mockLog), logger: mockLog };
});

import { applyDownloadFallbackIfMutated } from "@/lib/workflows/step-workbook-fallback";

function makeBase64Workbook(): string {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([["A", "B"], [1, 2]]);
  xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" }).toString("base64");
}

const applyPersistedOutput = (
  persisted: { attachmentRow: any; outputAttachmentIds: string[] },
  currentOutputIds: string[],
) => ({
  currentOutputIds: [...currentOutputIds, ...persisted.outputAttachmentIds],
  currentRows: [persisted.attachmentRow],
  stepOutputAttachmentId: persisted.attachmentRow.id,
});

describe("applyDownloadFallbackIfMutated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when shouldTry is false or currentWorkbookPath is null", async () => {
    expect(
      await applyDownloadFallbackIfMutated({
        shouldTry: false,
        currentWorkbookPath: "/a.xlsx",
        stepIndex: 0,
        stepName: "S1",
        userId: "u1",
        runId: "r1",
        defaultFilename: "out.xlsx",
        runMcpTools: {},
        runToolSourceMap: {},
        stepServerNames: new Set(),
        currentOutputIds: [],
        artifact: null,
        applyPersistedOutput,
      }),
    ).toBeNull();
  });

  it("returns null when no download tool is executable", async () => {
    expect(
      await applyDownloadFallbackIfMutated({
        shouldTry: true,
        currentWorkbookPath: "/a.xlsx",
        stepIndex: 0,
        stepName: "S1",
        userId: "u1",
        runId: "r1",
        defaultFilename: "out.xlsx",
        runMcpTools: {},
        runToolSourceMap: {},
        stepServerNames: new Set(["srv"]),
        currentOutputIds: [],
        artifact: null,
        applyPersistedOutput,
      }),
    ).toBeNull();
  });

  it("downloads via preferred tool, builds fallback artifact, and persists", async () => {
    const b64 = makeBase64Workbook();
    mockExtractDownloadFilePayload.mockReturnValue({
      fileContent: b64,
      filename: "wb.xlsx",
    });
    mockPersistWorkflowArtifact.mockResolvedValue({
      attachmentRow: { id: "att-9", name: "wb.xlsx" },
      outputAttachmentIds: ["att-9"],
    });

    const res = await applyDownloadFallbackIfMutated({
      shouldTry: true,
      currentWorkbookPath: "/a.xlsx",
      stepIndex: 0,
      stepName: "S1",
      userId: "u1",
      runId: "r1",
      defaultFilename: "out.xlsx",
      runMcpTools: {
        download_file: { execute: vi.fn().mockResolvedValue({ ok: true }) },
      },
      runToolSourceMap: { download_file: "srv" },
      stepServerNames: new Set(["srv"]),
      currentOutputIds: [],
      artifact: null,
      applyPersistedOutput,
    });

    expect(res?.stepOutputAttachmentId).toBe("att-9");
    expect(res?.artifact).toMatchObject({ type: "spreadsheet" });
  });

  it("uses regex-matched download tool and preserves existing artifact", async () => {
    mockExtractDownloadFilePayload.mockReturnValue({
      fileContent: "invalid-base64-for-xlsx",
      filename: "",
    });
    mockPersistWorkflowArtifact.mockResolvedValue({
      attachmentRow: { id: "att-10", name: "out.xlsx" },
      outputAttachmentIds: ["att-10"],
    });
    const existing = { type: "markdown", content: "hi" };
    const res = await applyDownloadFallbackIfMutated({
      shouldTry: true,
      currentWorkbookPath: "/a.xlsx",
      stepIndex: 0,
      stepName: "S1",
      userId: "u1",
      runId: "r1",
      defaultFilename: "out.xlsx",
      runMcpTools: {
        custom_export_sheet: { execute: vi.fn().mockResolvedValue({}) },
      },
      runToolSourceMap: { custom_export_sheet: "srv" },
      stepServerNames: new Set(["srv"]),
      currentOutputIds: [],
      artifact: existing,
      applyPersistedOutput,
    });

    expect(res?.artifact).toBe(existing);
  });

  it("logs warning and returns null when download tool throws", async () => {
    const res = await applyDownloadFallbackIfMutated({
      shouldTry: true,
      currentWorkbookPath: "/a.xlsx",
      stepIndex: 0,
      stepName: "S1",
      userId: "u1",
      runId: "r1",
      defaultFilename: "out.xlsx",
      runMcpTools: {
        download_file: {
          execute: vi.fn().mockRejectedValue(new Error("net err")),
        },
      },
      runToolSourceMap: { download_file: "srv" },
      stepServerNames: new Set(["srv"]),
      currentOutputIds: [],
      artifact: null,
      applyPersistedOutput,
    });
    expect(res).toBeNull();
    expect(mockWarn).toHaveBeenCalled();
  });

  it("returns null when extractDownloadFilePayload returns null or persistWorkflowArtifact returns null", async () => {
    const baseParams = {
      shouldTry: true,
      currentWorkbookPath: "/a.xlsx",
      stepIndex: 0,
      stepName: "S1",
      userId: "u1",
      runId: "r1",
      defaultFilename: "out.xlsx",
      runMcpTools: {
        download_file: {
          execute: vi.fn().mockResolvedValue({}),
        },
      },
      runToolSourceMap: { download_file: "srv" },
      stepServerNames: new Set(["srv"]),
      currentOutputIds: [],
      artifact: null,
      applyPersistedOutput,
    };

    mockExtractDownloadFilePayload.mockReturnValueOnce(null);
    expect(await applyDownloadFallbackIfMutated(baseParams)).toBeNull();

    mockExtractDownloadFilePayload.mockReturnValueOnce({
      fileContent: "dGVzdA==",
      filename: "out.xlsx",
    });
    mockPersistWorkflowArtifact.mockResolvedValueOnce(null as any);
    expect(await applyDownloadFallbackIfMutated(baseParams)).toBeNull();
  });

  it("logs warning when xlsx.read throws or download tool rejects with non-Error", async () => {
    vi.mocked(xlsx.read).mockImplementationOnce(() => {
      throw new Error("corrupt xlsx");
    });
    mockExtractDownloadFilePayload.mockReturnValueOnce({
      fileContent: "dGVzdA==",
      filename: "out.xlsx",
    });
    mockPersistWorkflowArtifact.mockResolvedValueOnce({
      attachmentRow: { id: "att-1", name: "out.xlsx" } as any,
      outputAttachmentIds: ["att-1"],
    });

    const res = await applyDownloadFallbackIfMutated({
      shouldTry: true,
      currentWorkbookPath: "/a.xlsx",
      stepIndex: 0,
      stepName: "S1",
      userId: "u1",
      runId: "r1",
      defaultFilename: "out.xlsx",
      runMcpTools: {
        download_file: {
          execute: vi.fn().mockResolvedValue({}),
        },
      },
      runToolSourceMap: { download_file: "srv" },
      stepServerNames: new Set(["srv"]),
      currentOutputIds: [],
      artifact: null,
      applyPersistedOutput,
    });
    expect(res?.artifact).toBeNull();
    expect(mockWarn).toHaveBeenCalled();

    const res2 = await applyDownloadFallbackIfMutated({
      shouldTry: true,
      currentWorkbookPath: "/a.xlsx",
      stepIndex: 0,
      stepName: "S1",
      userId: "u1",
      runId: "r1",
      defaultFilename: "out.xlsx",
      runMcpTools: {
        download_file: {
          execute: vi.fn().mockRejectedValue("non-error string"),
        },
      },
      runToolSourceMap: { download_file: "srv" },
      stepServerNames: new Set(["srv"]),
      currentOutputIds: [],
      artifact: null,
      applyPersistedOutput,
    });
    expect(res2).toBeNull();
  });

  it("returns null when runMcpTools has only non-download tools", async () => {
    const res = await applyDownloadFallbackIfMutated({
      shouldTry: true,
      currentWorkbookPath: "/a.xlsx",
      stepIndex: 0,
      stepName: "S1",
      userId: "u1",
      runId: "r1",
      defaultFilename: "out.xlsx",
      runMcpTools: { some_other_tool: {} },
      runToolSourceMap: { some_other_tool: "srv" },
      stepServerNames: new Set(["srv"]),
      currentOutputIds: [],
      artifact: null,
      applyPersistedOutput,
    });
    expect(res).toBeNull();
  });
});
