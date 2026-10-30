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
import { getAttachmentArtifact } from "@/actions/attachments/get-attachment-artifact";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("getAttachmentArtifact action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
  });

  it("successfully retrieves and parses spreadsheet attachment", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/file.xlsx",
        name: "file.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ]);

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([
      ["Col1", "Col2"],
      ["A", "B"],
    ]);
    xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    downloadObjectMock.mockResolvedValueOnce(buf);

    const result = await getAttachmentArtifact(VALID_UUID);

    expect(result.id).toBe(VALID_UUID);
    expect(result.type).toBe("spreadsheet");
    expect(result.title).toBe("file.xlsx");
    const parsed = JSON.parse(result.content);
    expect(parsed.sheets).toHaveLength(1);
    expect(parsed.sheets[0].name).toBe("Sheet1");
  });

  it("successfully retrieves markdown document attachment", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/report.md",
        name: "report.md",
        mimeType: "text/markdown",
      },
    ]);

    downloadObjectMock.mockResolvedValueOnce(Buffer.from("# Quarterly Report\nSummary here."));

    const result = await getAttachmentArtifact(VALID_UUID);

    expect(result.id).toBe(VALID_UUID);
    expect(result.type).toBe("markdown");
    expect(result.title).toBe("report.md");
    expect(result.content).toBe("# Quarterly Report\nSummary here.");
  });

  it("successfully retrieves HTML attachment", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/widget.html",
        name: "widget.html",
        mimeType: "text/html",
      },
    ]);

    downloadObjectMock.mockResolvedValueOnce(Buffer.from("<div class='chart'>Content</div>"));

    const result = await getAttachmentArtifact(VALID_UUID);

    expect(result.id).toBe(VALID_UUID);
    expect(result.type).toBe("html");
    expect(result.title).toBe("widget.html");
    expect(result.content).toBe("<div class='chart'>Content</div>");
  });

  it("successfully retrieves Mermaid diagram attachment", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/diag.mmd",
        name: "diag.mmd",
        mimeType: "text/plain",
      },
    ]);

    downloadObjectMock.mockResolvedValueOnce(Buffer.from("graph TD\nA-->B"));

    const result = await getAttachmentArtifact(VALID_UUID);

    expect(result.id).toBe(VALID_UUID);
    expect(result.type).toBe("mermaid");
    expect(result.title).toBe("diag.mmd");
    expect(result.content).toBe("graph TD\nA-->B");
  });

  it("wraps code or JSON in markdown code fence", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/data.json",
        name: "data.json",
        mimeType: "application/json",
      },
    ]);

    downloadObjectMock.mockResolvedValueOnce(Buffer.from('{"key":"value"}'));

    const result = await getAttachmentArtifact(VALID_UUID);

    expect(result.type).toBe("markdown");
    expect(result.content).toContain("```json\n{\"key\":\"value\"}\n```");
  });

  it("embeds image attachments as base64 data URLs in markdown", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/photo.png",
        name: "photo.png",
        mimeType: "image/png",
      },
    ]);

    downloadObjectMock.mockResolvedValueOnce(Buffer.from("png-bytes"));

    const result = await getAttachmentArtifact(VALID_UUID);

    expect(result.type).toBe("markdown");
    expect(result.content).toBe("![photo.png](data:image/png;base64,cG5nLWJ5dGVz)");
  });

  it("returns informative notice for non-previewable binary files", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/document.pdf",
        name: "document.pdf",
        mimeType: "application/pdf",
      },
    ]);

    downloadObjectMock.mockResolvedValueOnce(Buffer.from("%PDF-1.4"));

    const result = await getAttachmentArtifact(VALID_UUID);

    expect(result.type).toBe("markdown");
    expect(result.content).toContain("Binary preview is not supported for this file type (PDF)");
  });

  it("resolves svg image mime when extension is svg but mime is not image/*", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/icon.svg",
        name: "icon.svg",
        mimeType: "text/plain",
      },
    ]);

    downloadObjectMock.mockResolvedValueOnce(Buffer.from("<svg/>"));

    const result = await getAttachmentArtifact(VALID_UUID);

    expect(result.type).toBe("markdown");
    expect(result.content).toBe(
      "![icon.svg](data:image/svg+xml;base64,PHN2Zy8+)",
    );
  });

  it("derives image mime from extension when mime is not image/*", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/photo.webp",
        name: "photo.webp",
        mimeType: "application/octet-stream",
      },
    ]);

    downloadObjectMock.mockResolvedValueOnce(Buffer.from("webp-bytes"));

    const result = await getAttachmentArtifact(VALID_UUID);

    expect(result.type).toBe("markdown");
    expect(result.content).toBe(
      "![photo.webp](data:image/webp;base64,d2VicC1ieXRlcw==)",
    );
  });

  it("returns binary notice for audio files", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/voice.mp3",
        name: "voice.mp3",
        mimeType: "audio/mpeg",
      },
    ]);

    downloadObjectMock.mockResolvedValueOnce(Buffer.from("audio-bytes"));

    const result = await getAttachmentArtifact(VALID_UUID);

    expect(result.type).toBe("markdown");
    expect(result.content).toContain("Binary preview is not supported");
  });

  it("returns binary notice for archive mime with extensionless name", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/archive",
        name: "archive",
        mimeType: "application/zip",
      },
    ]);

    downloadObjectMock.mockResolvedValueOnce(Buffer.from("zip-bytes"));

    const result = await getAttachmentArtifact(VALID_UUID);

    expect(result.type).toBe("markdown");
    expect(result.content).toContain("Binary preview is not supported");
    expect(result.content).toContain("(binary)");
  });

  it("wraps json mime text files in code fence", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/config",
        name: "config",
        mimeType: "application/json",
      },
    ]);

    downloadObjectMock.mockResolvedValueOnce(Buffer.from('{"a":1}'));

    const result = await getAttachmentArtifact(VALID_UUID);

    expect(result.type).toBe("markdown");
    expect(result.content).toContain('```\n{"a":1}\n```');
  });

  it("treats null mimeType as empty string and returns raw text", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/notes.txt",
        name: "notes.txt",
        mimeType: null,
      },
    ]);

    downloadObjectMock.mockResolvedValueOnce(Buffer.from("plain notes"));

    const result = await getAttachmentArtifact(VALID_UUID);

    expect(result.type).toBe("markdown");
    expect(result.content).toBe("plain notes");
  });

  it("throws Error if attachment not found or owned by different user", async () => {
    chainable.where.mockResolvedValueOnce([]);

    await expect(getAttachmentArtifact(VALID_UUID)).rejects.toThrow("Not Found");
  });
});

