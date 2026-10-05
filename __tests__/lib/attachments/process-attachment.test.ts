import { describe, expect, it, vi } from "vitest";
import { processAttachment } from "@/lib/attachments/process-attachment";
import * as extractDoc from "@/lib/attachments/extract-document";

vi.mock("@/lib/storage/s3-client", () => ({
  uploadObject: vi.fn().mockResolvedValue(undefined),
}));

describe("processAttachment lib", () => {
  it("processes image attachment without text extraction", async () => {
    const file = new File(["fake-image-bytes"], "test.png", { type: "image/png" });
    const res = await processAttachment(file, []);
    expect(res.id).toBeDefined();
    expect(res.type).toBe("image");
    expect(res.mimeType).toBe("image/png");
    expect(res.name).toBe("test.png");
    expect(res.dataUrl).toContain("data:image/png;base64,");
  });

  it("throws error when file validation fails", async () => {
    const file = new File(["invalid-content"], "test.exe", { type: "application/x-msdownload" });
    await expect(processAttachment(file, [])).rejects.toThrow();
  });

  it("handles FileReader error when reading image data URL", async () => {
    const file = new File(["fake-image-bytes"], "test.jpg", { type: "image/jpeg" });
    const originalReadAsDataURL = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function () {
      setTimeout(() => {
        if (this.onerror) {
          this.onerror(new ProgressEvent("error") as any);
        }
      }, 0);
    };

    try {
      await expect(processAttachment(file, [])).rejects.toThrow();
    } finally {
      FileReader.prototype.readAsDataURL = originalReadAsDataURL;
    }
  });

  it("processes spreadsheet file preserving rawFile", async () => {
    const file = new File(["a,b,c\n1,2,3"], "data.csv", { type: "text/csv" });
    const res = await processAttachment(file, []);
    expect(res.type).toBe("spreadsheet");
    expect(res.name).toBe("data.csv");
    expect(res.rawFile).toBe(file);
    expect(res.dataUrl).toBe("");
  });

  it("processes PDF document extracting text via extractPdf", async () => {
    const extractPdfSpy = vi.spyOn(extractDoc, "extractPdf").mockResolvedValueOnce("PDF Extracted text");
    const file = new File(["%PDF-1.4 mock content"], "sample.pdf", { type: "application/pdf" });

    const res = await processAttachment(file, []);
    expect(res.type).toBe("document");
    expect(res.name).toBe("sample.pdf");
    expect(res.extractedText).toBe("PDF Extracted text");
    expect(extractPdfSpy).toHaveBeenCalledWith(file);
    extractPdfSpy.mockRestore();
  });

  it("processes plain text document extracting text via extractPlainText", async () => {
    const extractTextSpy = vi.spyOn(extractDoc, "extractPlainText").mockResolvedValueOnce("Text file content");
    const file = new File(["Text content"], "notes.txt", { type: "text/plain" });

    const res = await processAttachment(file, []);
    expect(res.type).toBe("document");
    expect(res.name).toBe("notes.txt");
    expect(res.extractedText).toBe("Text file content");
    expect(extractTextSpy).toHaveBeenCalledWith(file);
    extractTextSpy.mockRestore();
  });
});

