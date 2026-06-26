import { describe, it, expect, vi, beforeEach } from "vitest";
import { processAttachments } from "@/lib/chat/upload-attachments";
import type { Attachment } from "@/types/attachment/attachment";

// ─── Mock logger and server actions ───────────────────────────────────────
const { mockCloneAttachment, mockUploadAttachment, mockLoggerError } =
  vi.hoisted(() => ({
    mockCloneAttachment: vi.fn(),
    mockUploadAttachment: vi.fn(),
    mockLoggerError: vi.fn(),
  }));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mockLoggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/actions/attachments/clone-attachment", () => ({
  cloneAttachment: mockCloneAttachment,
}));

vi.mock("@/lib/actions/attachments/upload-attachment", () => ({
  uploadAttachment: mockUploadAttachment,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────
const makeAttachment = (
  overrides: Partial<Attachment> & { id: string },
): Attachment => ({
  id: overrides.id,
  type: "document",
  name: "doc.pdf",
  mimeType: "application/pdf",
  sizeBytes: 4096,
  dataUrl: "",
  ...overrides,
});

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("processAttachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("routing by key presence", () => {
    it("calls cloneAttachment when attachment has a key", async () => {
      mockCloneAttachment.mockResolvedValueOnce({
        id: "cloned-1",
        key: "uploads/existing.pdf",
        name: "doc.pdf",
        mimeType: "application/pdf",
        size: 4096,
        extractedText: null,
      });

      const att = makeAttachment({ id: "att-1", key: "uploads/existing.pdf" });
      const result = await processAttachments([att], "msg-1");

      expect(mockCloneAttachment).toHaveBeenCalledWith("att-1", "msg-1");
      expect(mockUploadAttachment).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("cloned-1");
      expect(result[0].key).toBe("uploads/existing.pdf");
    });

    it("calls uploadSingleAttachment (via uploadAttachment) when attachment has no key", async () => {
      mockUploadAttachment.mockResolvedValueOnce({
        key: "uploads/new.pdf",
      });

      const att = makeAttachment({
        id: "att-2",
        key: undefined,
        rawFile: new File(["content"], "new.pdf", { type: "application/pdf" }),
      });
      const result = await processAttachments([att], "msg-1");

      expect(mockUploadAttachment).toHaveBeenCalled();
      expect(mockCloneAttachment).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("att-2");
      expect(result[0].key).toBe("uploads/new.pdf");
    });
  });

  describe("mixed attachments", () => {
    it("processes both existing and new attachments in a single call", async () => {
      mockCloneAttachment.mockResolvedValueOnce({
        id: "cloned-1",
        key: "uploads/existing.pdf",
        name: "doc.pdf",
        mimeType: "application/pdf",
        size: 4096,
        extractedText: null,
      });
      mockUploadAttachment.mockResolvedValueOnce({
        key: "uploads/new.pdf",
      });

      const existing = makeAttachment({
        id: "att-existing",
        key: "uploads/existing.pdf",
      });
      const newFile = makeAttachment({
        id: "att-new",
        key: undefined,
        rawFile: new File(["content"], "new.pdf", { type: "application/pdf" }),
      });

      const result = await processAttachments([existing, newFile], "msg-1");

      expect(mockCloneAttachment).toHaveBeenCalledTimes(1);
      expect(mockUploadAttachment).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });
  });

  describe("error handling", () => {
    it("skips and logs when cloneAttachment throws", async () => {
      mockLoggerError.mockClear();
      mockCloneAttachment.mockRejectedValueOnce(new Error("DB error"));

      const att = makeAttachment({ id: "att-1", key: "uploads/existing.pdf" });
      const result = await processAttachments([att], "msg-1");

      expect(result).toHaveLength(0);
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Attachment clone failed"),
        expect.any(Error),
      );
    });

    it("skips and logs when uploadSingleAttachment (via uploadAttachment) throws", async () => {
      mockLoggerError.mockClear();
      mockUploadAttachment.mockRejectedValueOnce(new Error("S3 error"));

      const att = makeAttachment({
        id: "att-2",
        key: undefined,
        rawFile: new File(["content"], "new.pdf", { type: "application/pdf" }),
      });
      const result = await processAttachments([att], "msg-1");

      expect(result).toHaveLength(0);
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Attachment upload failed"),
        expect.any(Error),
      );
    });

    it("skips attachments that have no key and no rawFile (fails in uploadSingleAttachment)", async () => {
      mockUploadAttachment.mockRejectedValueOnce(new Error("No file"));

      const att = makeAttachment({
        id: "att-3",
        key: undefined,
        dataUrl: "data:text/plain,test",
      });
      const result = await processAttachments([att], "msg-1");

      expect(result).toHaveLength(0);
    });
  });

  describe("extractedText propagation", () => {
    it("passes extractedText from clone result when present", async () => {
      mockCloneAttachment.mockResolvedValueOnce({
        id: "cloned-1",
        key: "uploads/doc.pdf",
        name: "doc.pdf",
        mimeType: "application/pdf",
        size: 4096,
        extractedText: "Extracted content from PDF",
      });

      const att = makeAttachment({
        id: "att-1",
        key: "uploads/doc.pdf",
        extractedText: "old text",
      });
      const result = await processAttachments([att], "msg-1");

      expect(result[0].extractedText).toBe("Extracted content from PDF");
    });

    it("falls back to original extractedText when clone returns null", async () => {
      mockCloneAttachment.mockResolvedValueOnce({
        id: "cloned-1",
        key: "uploads/doc.pdf",
        name: "doc.pdf",
        mimeType: "application/pdf",
        size: 4096,
        extractedText: null,
      });

      const att = makeAttachment({
        id: "att-1",
        key: "uploads/doc.pdf",
        extractedText: "original extracted text",
      });
      const result = await processAttachments([att], "msg-1");

      expect(result[0].extractedText).toBe("original extracted text");
    });

    it("passes extractedText to uploadAttachment when present on new file", async () => {
      mockUploadAttachment.mockResolvedValueOnce({
        key: "uploads/new.pdf",
      });

      const att = makeAttachment({
        id: "att-new",
        key: undefined,
        extractedText: "new file extracted text",
        rawFile: new File(["content"], "new.pdf", { type: "application/pdf" }),
      });
      const result = await processAttachments([att], "msg-1");

      expect(mockUploadAttachment).toHaveBeenCalled();
      expect(result[0].extractedText).toBe("new file extracted text");
    });
  });
});
