vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["select", "from", "where"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

const downloadObjectMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/download-object", () => ({
  downloadObject: downloadObjectMock,
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as xlsx from "xlsx";
import { getAttachmentSpreadsheet } from "@/actions/attachments/get-attachment-spreadsheet";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("getAttachmentSpreadsheet action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
  });

  it("successfully retrieves and parses spreadsheet attachment for owned file", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/file.xlsx",
        name: "file.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ]);

    // Create real xlsx buffer
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([
      ["Col1", "Col2"],
      ["A", "B"],
    ]);
    xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    downloadObjectMock.mockResolvedValueOnce(buf);

    const result = await getAttachmentSpreadsheet(VALID_UUID);

    expect(result.id).toBe(VALID_UUID);
    expect(result.name).toBe("file.xlsx");
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].name).toBe("Sheet1");
    expect(result.sheets[0].data).toEqual([
      ["Col1", "Col2"],
      ["A", "B"],
    ]);
  });

  it("caps rows at 500 when sheet has more rows", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/large.xlsx",
        name: "large.xlsx",
      },
    ]);

    const largeData: string[][] = [["Header"]];
    for (let i = 0; i < 600; i++) {
      largeData.push([`Row ${i}`]);
    }

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(largeData);
    xlsx.utils.book_append_sheet(wb, ws, "LargeSheet");
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    downloadObjectMock.mockResolvedValueOnce(buf);

    const result = await getAttachmentSpreadsheet(VALID_UUID);
    expect(result.sheets[0].data.length).toBe(500);
  });

  it("throws ZodError when id is not a valid uuid", async () => {
    await expect(getAttachmentSpreadsheet("not-a-uuid")).rejects.toThrow();
  });

  it("throws Not Found when attachment does not exist or not owned", async () => {
    chainable.where.mockResolvedValueOnce([]);

    await expect(getAttachmentSpreadsheet(VALID_UUID)).rejects.toThrow(
      "Not Found",
    );
  });
});

