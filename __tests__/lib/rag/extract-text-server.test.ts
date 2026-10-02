vi.mock("@/config/env", () => ({
  env: {
    MAX_DOCUMENT_CHARS: 50000,
  },
}));

import { describe, expect, it, vi } from "vitest";
import { extractTextFromBuffer } from "@/lib/rag/extract-text-server";

const extractDocumentContentMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/utils/extraction-helpers", () => ({
  extractDocumentContent: extractDocumentContentMock,
}));

describe("extractTextFromBuffer", () => {
  it("calls extractDocumentContent with buffer, mimeType, and MAX_DOCUMENT_CHARS limit", async () => {
    const buf = Buffer.from("hello");
    extractDocumentContentMock.mockResolvedValue("extracted text");

    const result = await extractTextFromBuffer(buf, "text/plain");
    expect(result).toBe("extracted text");
    expect(extractDocumentContentMock).toHaveBeenCalledWith(buf, "text/plain", 50000);
  });
});
