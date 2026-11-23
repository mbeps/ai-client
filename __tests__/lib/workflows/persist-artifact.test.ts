import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidArtifactFormatError } from "@/lib/error/invalid-artifact-format-error";
import { persistWorkflowArtifact } from "@/lib/workflows/persist-artifact";

const mockInsertValues = vi.fn();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));
const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
const mockUploadObject = vi.fn();

vi.mock("@/drizzle/db", () => ({
  db: {
    insert: () => mockInsert(),
    delete: () => mockDelete(),
    update: () => mockUpdate(),
  },
}));

vi.mock("@/lib/storage/upload-object", () => ({
  uploadObject: (...args: unknown[]) => mockUploadObject(...args),
}));

describe("persistWorkflowArtifact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue(undefined);
    mockDeleteWhere.mockResolvedValue(undefined);
    mockUpdateWhere.mockResolvedValue(undefined);
    mockUploadObject.mockResolvedValue(undefined);
  });

  it("persists spreadsheet, markdown, html, mermaid artifacts and download payloads", async () => {
    const ss = await persistWorkflowArtifact(
      {
        kind: "artifact",
        stepIndex: 0,
        artifact: {
          type: "spreadsheet",
          content: JSON.stringify({ sheets: [{ name: "S1", data: [["a", 1]] }] }),
        },
      },
      "u1",
      "run-1",
    );
    expect(ss?.attachmentRow.name).toBe("step-1-output.xlsx");

    const ssArr = await persistWorkflowArtifact(
      {
        kind: "artifact",
        stepIndex: 0,
        artifact: {
          type: "spreadsheet",
          content: JSON.stringify([["col1", "col2"], ["v1", "v2"]]),
        },
      },
      "u1",
      "run-1",
    );
    expect(ssArr?.attachmentRow.name).toBe("step-1-output.xlsx");

    const ssSingleObj = await persistWorkflowArtifact(
      {
        kind: "artifact",
        stepIndex: 0,
        artifact: {
          type: "spreadsheet",
          content: JSON.stringify({ name: "CustomSheet", data: [["a"]] }),
        },
      },
      "u1",
      "run-1",
    );
    expect(ssSingleObj?.attachmentRow.name).toBe("step-1-output.xlsx");

    const ssUnnamedObj = await persistWorkflowArtifact(
      {
        kind: "artifact",
        stepIndex: 0,
        artifact: {
          type: "spreadsheet",
          content: JSON.stringify({ name: 123, data: [["a"]] }),
        },
      },
      "u1",
      "run-1",
    );
    expect(ssUnnamedObj?.attachmentRow.name).toBe("step-1-output.xlsx");

    await expect(
      persistWorkflowArtifact(
        {
          kind: "artifact",
          stepIndex: 0,
          artifact: { type: "spreadsheet", content: "null" },
        },
        "u1",
        "run-1",
      ),
    ).rejects.toThrow(InvalidArtifactFormatError);

    const ssMultiEmpty = await persistWorkflowArtifact(
      {
        kind: "artifact",
        stepIndex: 0,
        artifact: {
          type: "spreadsheet",
          content: JSON.stringify({ sheets: [{}] }),
        },
      },
      "u1",
      "run-1",
    );
    expect(ssMultiEmpty?.attachmentRow.name).toBe("step-1-output.xlsx");

    const md = await persistWorkflowArtifact(
      {
        kind: "artifact",
        stepIndex: 1,
        artifact: { type: "markdown", content: "# Report" },
      },
      "u1",
      "run-1",
    );
    expect(md?.attachmentRow.name).toBe("step-2-output.md");

    const dl = await persistWorkflowArtifact(
      {
        kind: "download",
        stepIndex: 2,
        fileContent: Buffer.from("csv,1").toString("base64"),
        filename: "report.csv",
      },
      "u1",
      "run-1",
    );
    expect(dl?.attachmentRow.mimeType).toBe("text/csv");

    const dlFallback = await persistWorkflowArtifact(
      {
        kind: "download",
        stepIndex: 2,
        fileContent: Buffer.from("bin").toString("base64"),
        filename: "archive.bin",
      },
      "u1",
      "run-1",
    );
    expect(dlFallback?.attachmentRow.mimeType).toBe("application/octet-stream");

    const dlNoName = await persistWorkflowArtifact(
      {
        kind: "download",
        stepIndex: 2,
        fileContent: Buffer.from("xlsx").toString("base64"),
      },
      "u1",
      "run-1",
    );
    expect(dlNoName?.attachmentRow.name).toBe("step-3-output.xlsx");

    expect(
      await persistWorkflowArtifact(
        { kind: "artifact", stepIndex: 0, artifact: {} },
        "u1",
        "run-1",
      ),
    ).toBeNull();
  });

  it("returns null on empty/unsupported artifacts and throws InvalidArtifactFormatError on bad spreadsheet", async () => {
    expect(
      await persistWorkflowArtifact(
        { kind: "artifact", stepIndex: 0, artifact: { type: "markdown", content: "" } },
        "u1",
        "run-1",
      ),
    ).toBeNull();

    expect(
      await persistWorkflowArtifact(
        { kind: "artifact", stepIndex: 0, artifact: { type: "unknown", content: "abc" } },
        "u1",
        "run-1",
      ),
    ).toBeNull();

    await expect(
      persistWorkflowArtifact(
        {
          kind: "artifact",
          stepIndex: 0,
          artifact: { type: "spreadsheet", content: "{}" },
        },
        "u1",
        "run-1",
      ),
    ).rejects.toThrow(InvalidArtifactFormatError);
  });

  it("compensates DB attachment row if S3 uploadObject throws", async () => {
    mockUploadObject.mockRejectedValueOnce(new Error("S3 error"));
    const res = await persistWorkflowArtifact(
      {
        kind: "artifact",
        stepIndex: 0,
        artifact: { type: "markdown", content: "# Hi" },
      },
      "u1",
      "run-1",
    );
    expect(res).toBeNull();
    expect(mockDelete).toHaveBeenCalledTimes(1);

    mockUploadObject.mockRejectedValueOnce("non-error-s3");
    const resStr = await persistWorkflowArtifact(
      {
        kind: "artifact",
        stepIndex: 0,
        artifact: { type: "markdown", content: "# Hi2" },
      },
      "u1",
      "run-1",
    );
    expect(resStr).toBeNull();
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });
});
