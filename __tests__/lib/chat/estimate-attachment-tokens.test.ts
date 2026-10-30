import { describe, expect, it } from "vitest";
import { estimateAttachmentTokens } from "@/lib/chat/estimate-attachment-tokens";
import type { Attachment } from "@/types/attachment/attachment";

describe("estimateAttachmentTokens", () => {
  it("returns 20 tokens for spreadsheet attachments", () => {
    const spreadsheetAtt: Attachment = {
      id: "att-sheet",
      type: "spreadsheet",
      name: "data.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 500000,
      dataUrl: "",
      extractedText: "Some very long extracted sheet text with lots of rows and columns",
    };

    expect(estimateAttachmentTokens(spreadsheetAtt)).toBe(20);
  });

  it("returns 800 tokens for image attachments", () => {
    const imageAtt: Attachment = {
      id: "att-img",
      type: "image",
      name: "photo.png",
      mimeType: "image/png",
      sizeBytes: 2048,
      dataUrl: "",
    };

    expect(estimateAttachmentTokens(imageAtt)).toBe(800);
  });

  it("returns estimated tokens from extractedText for document attachments", () => {
    const docAtt: Attachment = {
      id: "att-doc",
      type: "document",
      name: "notes.txt",
      mimeType: "text/plain",
      sizeBytes: 100,
      dataUrl: "",
      extractedText: "12345678", // 8 chars / 3.8 = ceil(2.1) = 3
    };

    expect(estimateAttachmentTokens(docAtt)).toBe(3);
  });

  it("returns sizeBytes / 4 tokens when no extractedText is present", () => {
    const docAtt: Attachment = {
      id: "att-raw",
      type: "document",
      name: "raw.bin",
      mimeType: "application/octet-stream",
      sizeBytes: 400,
      dataUrl: "",
    };

    expect(estimateAttachmentTokens(docAtt)).toBe(100);
  });

  it("returns fallback 100 tokens when neither extractedText nor sizeBytes exists", () => {
    const emptyAtt: Attachment = {
      id: "att-empty",
      type: "document",
      name: "empty.bin",
      mimeType: "application/octet-stream",
      sizeBytes: 0,
      dataUrl: "",
    };

    expect(estimateAttachmentTokens(emptyAtt)).toBe(100);
  });
});

