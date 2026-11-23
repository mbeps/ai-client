import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildFileContext } from "@/lib/workflows/build-file-context";

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));
const mockGetPresignedUrl = vi.fn();

vi.mock("@/drizzle/db", () => ({
  db: { select: () => mockSelect() },
}));

vi.mock("@/lib/storage/get-presigned-url", () => ({
  getPresignedUrl: (key: string) => mockGetPresignedUrl(key),
}));

describe("buildFileContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty when inputAttachmentIds is empty or no rows found", async () => {
    expect(await buildFileContext([], "u1")).toEqual({
      fileContext: "",
      attachmentRows: [],
    });
    mockSelectWhere.mockResolvedValueOnce([]);
    expect(await buildFileContext(["a1"], "u1")).toEqual({
      fileContext: "",
      attachmentRows: [],
    });
  });

  it("builds input and current workbook instructions with presigned URLs", async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { id: "a1", name: "input.xlsx", key: "workflow-inputs/u1/a1.xlsx" },
    ]);
    mockGetPresignedUrl.mockResolvedValueOnce("https://s3/input.xlsx");

    const inputOnly = await buildFileContext(["a1"], "u1");
    expect(inputOnly.fileContext).toContain("[Input] input.xlsx");

    mockSelectWhere.mockResolvedValueOnce([
      { id: "a2", name: "out.xlsx", key: "workflow-outputs/u1/a2.xlsx" },
    ]);
    mockGetPresignedUrl.mockResolvedValueOnce("https://s3/out.xlsx");

    const withOutput = await buildFileContext(["a2"], "u1");
    expect(withOutput.fileContext).toContain("[Current workbook] out.xlsx");
  });

  it("skips attachments whose presigned URL fails", async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { id: "a1", name: "bad.xlsx", key: "workflow-inputs/u1/bad.xlsx" },
    ]);
    mockGetPresignedUrl.mockRejectedValueOnce(new Error("S3 down"));

    const res = await buildFileContext(["a1"], "u1");
    expect(res.fileContext).toBe("");
    expect(res.attachmentRows).toHaveLength(1);
  });
});
