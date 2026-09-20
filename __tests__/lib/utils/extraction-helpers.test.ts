import { describe, expect, it, vi } from "vitest";
import { extractDocumentContent } from "@/lib/utils/extraction-helpers";

vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn(),
  extractText: vi.fn(),
}));

import { extractText, getDocumentProxy } from "unpdf";

describe("extractDocumentContent", () => {
  it("extracts plain text from Uint8Array", async () => {
    const data = new TextEncoder().encode("Hello world text content");
    const result = await extractDocumentContent(data, "text/plain", 100);
    expect(result).toBe("Hello world text content");
  });

  it("extracts text from Buffer", async () => {
    const data = Buffer.from('{"name": "test"}');
    const result = await extractDocumentContent(data, "application/json", 100);
    expect(result).toBe('{"name": "test"}');
  });

  it("extracts text from File instance", async () => {
    const file = new File(["<xml>test</xml>"], "test.xml", {
      type: "application/xml",
    });
    const result = await extractDocumentContent(file, "application/xml", 100);
    expect(result).toBe("<xml>test</xml>");
  });

  it("respects character limit", async () => {
    const data = new TextEncoder().encode("1234567890");
    const result = await extractDocumentContent(data, "text/plain", 5);
    expect(result).toBe("12345");
  });

  it("extracts PDF content successfully", async () => {
    const mockProxy = {};
    vi.mocked(getDocumentProxy).mockResolvedValue(mockProxy as any);
    vi.mocked(extractText).mockResolvedValue({
      text: "Extracted PDF content",
      totalPages: 1,
    });

    const data = new Uint8Array([1, 2, 3]);
    const result = await extractDocumentContent(data, "application/pdf", 100);
    expect(result).toBe("Extracted PDF content");
    expect(getDocumentProxy).toHaveBeenCalledWith(data);
  });

  it("throws formatted error when PDF extraction fails", async () => {
    vi.mocked(getDocumentProxy).mockRejectedValue(new Error("Corrupt PDF file"));

    const data = new Uint8Array([1, 2, 3]);
    await expect(
      extractDocumentContent(data, "application/pdf", 100),
    ).rejects.toThrow("Failed to extract text from PDF");
  });

  it("throws when PDF extraction throws a non-Error object", async () => {
    vi.mocked(getDocumentProxy).mockRejectedValue("string error");

    const data = new Uint8Array([1, 2, 3]);
    await expect(
      extractDocumentContent(data, "application/pdf", 100),
    ).rejects.toThrow("Failed to extract text from PDF");
  });

  it("falls back to text decoder for unknown non-text MIME type", async () => {
    const data = new TextEncoder().encode("Fallback text content");
    const result = await extractDocumentContent(data, "application/x-custom", 100);
    expect(result).toBe("Fallback text content");
  });

  it("throws when fallback decoding fails", async () => {
    const decodeSpy = vi
      .spyOn(TextDecoder.prototype, "decode")
      .mockImplementationOnce(() => {
        throw new Error("Decode failed");
      });

    const data = new Uint8Array([0xff]);
    await expect(
      extractDocumentContent(data, "application/octet-stream", 100),
    ).rejects.toThrow("Unsupported or unreadable MIME type: application/octet-stream");

    decodeSpy.mockRestore();
  });
});

