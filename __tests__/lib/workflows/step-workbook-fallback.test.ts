import { beforeEach, describe, expect, it, vi } from "vitest";
import * as xlsx from "xlsx";

const { mockLog, mockExtractDownloadFilePayload, mockPersistWorkflowArtifact } =
  vi.hoisted(() => ({
    mockLog: {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    mockExtractDownloadFilePayload: vi.fn(),
    mockPersistWorkflowArtifact: vi.fn(),
  }));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => mockLog),
  logger: mockLog,
}));

vi.mock("@/lib/workflows/extract-download-file-payload", () => ({
  extractDownloadFilePayload: mockExtractDownloadFilePayload,
}));

vi.mock("@/lib/workflows/persist-artifact", () => ({
  persistWorkflowArtifact: mockPersistWorkflowArtifact,
}));

import {
  type ApplyDownloadFallbackParams,
  applyDownloadFallbackIfMutated,
} from "@/lib/workflows/step-workbook-fallback";

function makeValidXlsxBase64(): string {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([
    ["Name", "Value"],
    ["Alpha", 42],
  ]);
  xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buf.toString("base64");
}

function makeBaseParams(
  overrides: Partial<ApplyDownloadFallbackParams> = {},
): ApplyDownloadFallbackParams {
  return {
    shouldTry: true,
    currentWorkbookPath: "/tmp/book.xlsx",
    stepIndex: 0,
    stepName: "Step One",
    userId: "user-1",
    runId: "run-1",
    defaultFilename: "default.xlsx",
    runMcpTools: {
      download_file: {
        execute: vi.fn().mockResolvedValue({ content: "ok" }),
      },
    },
    runToolSourceMap: {
      download_file: "excel-mcp",
    },
    stepServerNames: new Set(["excel-mcp"]),
    currentOutputIds: ["att-0"],
    artifact: null,
    applyPersistedOutput: vi.fn((persisted, currentIds) => ({
      currentOutputIds: [...currentIds, ...persisted.outputAttachmentIds],
      currentRows: [persisted.attachmentRow],
      stepOutputAttachmentId: persisted.attachmentRow.id,
    })),
    ...overrides,
  };
}

describe("applyDownloadFallbackIfMutated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when shouldTry is false or currentWorkbookPath is null", async () => {
    expect(
      await applyDownloadFallbackIfMutated(
        makeBaseParams({ shouldTry: false }),
      ),
    ).toBeNull();
    expect(
      await applyDownloadFallbackIfMutated(
        makeBaseParams({ currentWorkbookPath: null }),
      ),
    ).toBeNull();
  });

  it("returns null when no executable download tool is available", async () => {
    const result = await applyDownloadFallbackIfMutated(
      makeBaseParams({
        runMcpTools: {
          other_tool: { execute: vi.fn() },
          download_file: { execute: "not-a-function" },
        },
        runToolSourceMap: {
          other_tool: "excel-mcp",
          download_file: "excel-mcp",
        },
      }),
    );
    expect(result).toBeNull();
  });

  it("resolves regex-matched download tool when preferred names are absent", async () => {
    const execute = vi.fn().mockResolvedValue({ raw: true });
    mockExtractDownloadFilePayload.mockReturnValue({
      fileContent: makeValidXlsxBase64(),
      filename: "custom.xlsx",
    });
    mockPersistWorkflowArtifact.mockResolvedValue({
      attachmentRow: { id: "att-1", name: "custom.xlsx" },
      outputAttachmentIds: ["att-1"],
    });

    const result = await applyDownloadFallbackIfMutated(
      makeBaseParams({
        runMcpTools: {
          custom_export_workbook: { execute },
        },
        runToolSourceMap: {
          custom_export_workbook: "excel-mcp",
        },
      }),
    );

    expect(execute).toHaveBeenCalledWith({
      file_path: "/tmp/book.xlsx",
      path: "/tmp/book.xlsx",
    });
    expect(result).not.toBeNull();
    expect(result?.artifact).toEqual(
      expect.objectContaining({
        id: "step-0-wb",
        type: "spreadsheet",
        title: "Step One - custom.xlsx",
      }),
    );
    expect(result?.currentOutputIds).toEqual(["att-0", "att-1"]);
  });

  it("returns null when extractDownloadFilePayload or persistWorkflowArtifact returns null", async () => {
    mockExtractDownloadFilePayload.mockReturnValueOnce(null);
    expect(
      await applyDownloadFallbackIfMutated(makeBaseParams()),
    ).toBeNull();

    mockExtractDownloadFilePayload.mockReturnValueOnce({
      fileContent: makeValidXlsxBase64(),
      filename: "",
    });
    mockPersistWorkflowArtifact.mockResolvedValueOnce(null);
    expect(
      await applyDownloadFallbackIfMutated(makeBaseParams()),
    ).toBeNull();
    expect(mockPersistWorkflowArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "default.xlsx" }),
      "user-1",
      "run-1",
    );
  });

  it("keeps existing params.artifact when already present", async () => {
    const existingArtifact = { id: "existing", type: "spreadsheet", content: "{}" };
    mockExtractDownloadFilePayload.mockReturnValue({
      fileContent: makeValidXlsxBase64(),
      filename: "out.xlsx",
    });
    mockPersistWorkflowArtifact.mockResolvedValue({
      attachmentRow: { id: "att-2", name: "out.xlsx" },
      outputAttachmentIds: ["att-2"],
    });

    const result = await applyDownloadFallbackIfMutated(
      makeBaseParams({ artifact: existingArtifact }),
    );
    expect(result?.artifact).toBe(existingArtifact);
  });

  it("logs warning and returns null artifact when workbook parsing fails", async () => {
    mockExtractDownloadFilePayload.mockReturnValue({
      fileContent: Buffer.from("PK\x03\x04corrupt").toString("base64"),
      filename: "bad.xlsx",
    });
    mockPersistWorkflowArtifact.mockResolvedValue({
      attachmentRow: { id: "att-3", name: "bad.xlsx" },
      outputAttachmentIds: ["att-3"],
    });

    const result = await applyDownloadFallbackIfMutated(makeBaseParams());
    expect(mockLog.warn).toHaveBeenCalledWith(
      "Failed to build spreadsheet artifact from downloaded workbook",
      expect.objectContaining({ stepIndex: 0 }),
    );
    expect(result?.artifact).toBeNull();
  });

  it("catches Error and non-Error rejections from downloadTool.execute", async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce("string failure");

    const params = makeBaseParams({
      runMcpTools: { download_file: { execute } },
    });

    expect(await applyDownloadFallbackIfMutated(params)).toBeNull();
    expect(mockLog.warn).toHaveBeenCalledWith(
      "download_file fallback persistence failed",
      expect.objectContaining({ error: "network down" }),
    );

    expect(await applyDownloadFallbackIfMutated(params)).toBeNull();
    expect(mockLog.warn).toHaveBeenCalledWith(
      "download_file fallback persistence failed",
      expect.objectContaining({ error: "string failure" }),
    );
  });
});
