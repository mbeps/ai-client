import { describe, expect, it, vi } from "vitest";
import { buildFileContext } from "@/lib/transform/build-file-context";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));
vi.mock("@/drizzle/db", () => ({ db: dbMock }));

const getPresignedUrlMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/get-presigned-url", () => ({
  getPresignedUrl: getPresignedUrlMock,
}));

describe("buildFileContext", () => {
  it("returns empty context when inputAttachmentIds is empty", async () => {
    const result = await buildFileContext([], "user-1");
    expect(result).toEqual({ fileContext: "", attachmentRows: [] });
  });

  it("returns empty context when db query returns no matching attachments", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    dbMock.select.mockReturnValue(mockSelect);

    const result = await buildFileContext(["att-1"], "user-1");
    expect(result).toEqual({ fileContext: "", attachmentRows: [] });
  });

  it("builds file context for initial input files when presigned urls succeed", async () => {
    const mockRows = [
      { id: "att-1", userId: "user-1", name: "data.csv", key: "uploads/user-1/data.csv" },
    ];
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockRows),
    };
    dbMock.select.mockReturnValue(mockSelect);
    getPresignedUrlMock.mockResolvedValue("https://s3.example.com/data.csv");

    const result = await buildFileContext(["att-1"], "user-1");
    expect(result.attachmentRows).toEqual(mockRows);
    expect(result.fileContext).toContain("The user has attached spreadsheet files.");
    expect(result.fileContext).toContain("[Input] data.csv: https://s3.example.com/data.csv");
  });

  it("builds file context specifying current workbook when output attachment exists", async () => {
    const mockRows = [
      { id: "att-1", userId: "user-1", name: "input.xlsx", key: "uploads/user-1/input.xlsx" },
      { id: "att-2", userId: "user-1", name: "out.xlsx", key: "transform-outputs/user-1/out.xlsx" },
    ];
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockRows),
    };
    dbMock.select.mockReturnValue(mockSelect);
    getPresignedUrlMock
      .mockResolvedValueOnce("https://s3.example.com/input.xlsx")
      .mockResolvedValueOnce("https://s3.example.com/out.xlsx");

    const result = await buildFileContext(["att-1", "att-2"], "user-1");
    expect(result.fileContext).toContain("The current workbook is the [Current workbook] file below.");
    expect(result.fileContext).toContain("[Current workbook] out.xlsx: https://s3.example.com/out.xlsx");
  });

  it("handles rejected presigned URL generation gracefully", async () => {
    const mockRows = [
      { id: "att-1", userId: "user-1", name: "input.xlsx", key: "uploads/user-1/input.xlsx" },
    ];
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockRows),
    };
    dbMock.select.mockReturnValue(mockSelect);
    getPresignedUrlMock.mockRejectedValue(new Error("Failed to sign"));

    const result = await buildFileContext(["att-1"], "user-1");
    expect(result.fileContext).toBe("");
    expect(result.attachmentRows).toEqual(mockRows);
  });
});

