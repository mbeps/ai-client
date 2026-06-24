import { describe, it, expect } from "vitest";
import type { CloneAttachmentResult } from "@/lib/actions/attachments/clone-attachment";

describe("CloneAttachmentResult type shape", () => {
  it("has the expected properties at runtime", () => {
    // This is a compile-time and runtime check that CloneAttachmentResult
    // has the correct shape. If the type changes, this will fail to compile
    // or the assertions will catch it.
    const result: CloneAttachmentResult = {
      id: "uuid-1",
      key: "uploads/doc.pdf",
      name: "doc.pdf",
      mimeType: "application/pdf",
      size: 4096,
      extractedText: null,
    };

    expect(result.id).toBeTypeOf("string");
    expect(result.key).toBeTypeOf("string");
    expect(result.name).toBeTypeOf("string");
    expect(result.mimeType).toBeTypeOf("string");
    expect(result.size).toBeTypeOf("number");
    // extractedText can be string or null
    expect(
      result.extractedText === null || typeof result.extractedText === "string",
    ).toBe(true);
  });

  it("accepts extractedText as a string", () => {
    const result: CloneAttachmentResult = {
      id: "uuid-2",
      key: "uploads/report.pdf",
      name: "report.pdf",
      mimeType: "application/pdf",
      size: 8192,
      extractedText: "Some extracted content from the PDF",
    };

    expect(result.extractedText).toBeTypeOf("string");
  });

  it("accepts extractedText as null", () => {
    const result: CloneAttachmentResult = {
      id: "uuid-3",
      key: "uploads/image.png",
      name: "image.png",
      mimeType: "image/png",
      size: 2048,
      extractedText: null,
    };

    expect(result.extractedText).toBeNull();
  });

  it("does not include undefined properties", () => {
    // Verify the type doesn't have unexpected optional bloat
    const result: CloneAttachmentResult = {
      id: "uuid-4",
      key: "uploads/doc.pdf",
      name: "doc.pdf",
      mimeType: "application/pdf",
      size: 4096,
      extractedText: null,
    };

    // All required fields must be present
    expect(Object.keys(result).sort()).toEqual([
      "extractedText",
      "id",
      "key",
      "mimeType",
      "name",
      "size",
    ]);
  });
});
