import { validateFile } from "@/lib/attachments/validate-file";
import type { Attachment } from "@/types/attachment/attachment";

// ── Helpers ──────────────────────────────────────────────────────────────────

const MB = 1024 * 1024;

function makeFile(name: string, type: string, sizeBytes: number = 1024): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

function makeAttachment(
  type: "image" | "document" | "spreadsheet",
): Attachment {
  return {
    id: crypto.randomUUID(),
    type,
    name: "test.png",
    mimeType: "image/png",
    sizeBytes: 1024,
    dataUrl: "",
    s3Key: "test/key",
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("validateFile", () => {
  describe("total attachment quota (5 max)", () => {
    it("rejects when there are already 5 attachments", () => {
      const attachments = Array.from({ length: 5 }, () =>
        makeAttachment("document"),
      );
      const file = makeFile("doc.pdf", "application/pdf");
      const result = validateFile(file, attachments);
      expect(result.valid).toBe(false);
      if (!result.valid)
        expect(result.reason).toMatch(/Maximum 5 attachments per message/);
    });

    it("allows when there are 4 existing attachments", () => {
      const attachments = Array.from({ length: 4 }, () =>
        makeAttachment("document"),
      );
      const file = makeFile("doc.pdf", "application/pdf", 1024);
      const result = validateFile(file, attachments);
      expect(result.valid).toBe(true);
    });
  });

  describe("unsupported file types", () => {
    it("rejects .exe files", () => {
      const file = makeFile("virus.exe", "application/octet-stream");
      const result = validateFile(file, []);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toMatch(/not supported/);
    });

    it("rejects .zip files", () => {
      const file = makeFile("archive.zip", "application/zip");
      const result = validateFile(file, []);
      expect(result.valid).toBe(false);
    });

    it("rejects audio files", () => {
      const file = makeFile("song.mp3", "audio/mpeg");
      const result = validateFile(file, []);
      expect(result.valid).toBe(false);
    });

    it("rejects video files", () => {
      const file = makeFile("video.mp4", "video/mp4");
      const result = validateFile(file, []);
      expect(result.valid).toBe(false);
    });

    it("includes 'unknown' in reason when MIME type is empty", () => {
      const file = makeFile("mystery", "");
      const result = validateFile(file, []);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toMatch(/unknown/);
    });
  });

  describe("image files", () => {
    it("accepts image/png", () => {
      const file = makeFile("photo.png", "image/png");
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("accepts image/jpeg", () => {
      const file = makeFile("photo.jpg", "image/jpeg");
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("accepts image/gif", () => {
      const file = makeFile("anim.gif", "image/gif");
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("accepts image/webp", () => {
      const file = makeFile("img.webp", "image/webp");
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("rejects image exceeding 2 MB", () => {
      const file = makeFile("big.png", "image/png", 2 * MB + 1);
      const result = validateFile(file, []);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toMatch(/2 MB limit/);
    });

    it("accepts image exactly at 2 MB", () => {
      const file = makeFile("exact.png", "image/png", 2 * MB);
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("rejects a 4th image when 3 images already attached", () => {
      const attachments = Array.from({ length: 3 }, () =>
        makeAttachment("image"),
      );
      const file = makeFile("extra.png", "image/png");
      const result = validateFile(file, attachments);
      expect(result.valid).toBe(false);
      if (!result.valid)
        expect(result.reason).toMatch(/Maximum 3 images per message/);
    });

    it("accepts a 3rd image when only 2 images already attached", () => {
      const attachments = Array.from({ length: 2 }, () =>
        makeAttachment("image"),
      );
      const file = makeFile("third.png", "image/png");
      expect(validateFile(file, attachments).valid).toBe(true);
    });
  });

  describe("document files", () => {
    it("accepts application/pdf", () => {
      const file = makeFile("report.pdf", "application/pdf");
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("accepts text/plain", () => {
      const file = makeFile("readme.txt", "text/plain");
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("accepts text/markdown by MIME type", () => {
      const file = makeFile("notes.md", "text/markdown");
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("accepts .md extension with no MIME type via extension fallback", () => {
      const file = makeFile("notes.md", "");
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("rejects document exceeding 20 MB", () => {
      const file = makeFile("large.pdf", "application/pdf", 20 * MB + 1);
      const result = validateFile(file, []);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toMatch(/20 MB limit/);
    });

    it("accepts document exactly at 20 MB", () => {
      const file = makeFile("exact.pdf", "application/pdf", 20 * MB);
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("includes filename in rejection reason for oversized document", () => {
      const file = makeFile("my-report.pdf", "application/pdf", 25 * MB);
      const result = validateFile(file, []);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toContain("my-report.pdf");
    });
  });

  describe("spreadsheet files", () => {
    it("accepts .xlsx by MIME type", () => {
      const mime =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const file = makeFile("data.xlsx", mime);
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("accepts .xls by MIME type", () => {
      const file = makeFile("data.xls", "application/vnd.ms-excel");
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("accepts text/csv", () => {
      const file = makeFile("export.csv", "text/csv");
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("accepts .xlsx extension with no MIME type via extension fallback", () => {
      const file = makeFile("data.xlsx", "");
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("accepts .xls extension with no MIME type via extension fallback", () => {
      const file = makeFile("data.xls", "");
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("accepts .csv extension with no MIME type via extension fallback", () => {
      const file = makeFile("data.csv", "");
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("rejects spreadsheet exceeding 50 MB", () => {
      const mime =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const file = makeFile("huge.xlsx", mime, 50 * MB + 1);
      const result = validateFile(file, []);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toMatch(/50 MB limit/);
    });

    it("accepts spreadsheet exactly at 50 MB", () => {
      const mime =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const file = makeFile("exact.xlsx", mime, 50 * MB);
      expect(validateFile(file, []).valid).toBe(true);
    });

    it("includes filename in rejection reason for oversized spreadsheet", () => {
      const mime =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const file = makeFile("my-data.xlsx", mime, 60 * MB);
      const result = validateFile(file, []);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toContain("my-data.xlsx");
    });
  });

  describe("empty attachment list", () => {
    it("works correctly with an empty existing attachments array", () => {
      const file = makeFile("test.png", "image/png");
      expect(validateFile(file, []).valid).toBe(true);
    });
  });

  describe("mixed attachment quota edge cases", () => {
    it("counts non-image attachments toward total but not image limit", () => {
      // 2 images + 2 docs = 4 total; adding 1 more image should be fine (image count = 2)
      const attachments = [
        makeAttachment("image"),
        makeAttachment("image"),
        makeAttachment("document"),
        makeAttachment("document"),
      ];
      const file = makeFile("third.png", "image/png");
      expect(validateFile(file, attachments).valid).toBe(true);
    });

    it("rejects when total quota is hit even if image limit is not", () => {
      // 1 image + 4 docs = 5 total; adding another image hits total limit
      const attachments = [
        makeAttachment("image"),
        makeAttachment("document"),
        makeAttachment("document"),
        makeAttachment("document"),
        makeAttachment("document"),
      ];
      const file = makeFile("extra.png", "image/png");
      const result = validateFile(file, attachments);
      expect(result.valid).toBe(false);
      if (!result.valid)
        expect(result.reason).toMatch(/Maximum 5 attachments per message/);
    });
  });
});
