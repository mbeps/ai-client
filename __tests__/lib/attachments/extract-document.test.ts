import { describe, expect, it } from "vitest";
import { extractPlainText, extractPdf } from "@/lib/attachments/extract-document";

describe("extract-document lib", () => {
  it("extracts plain text buffer into string", async () => {
    const buf = Buffer.from("Hello world plain text", "utf-8");
    const text = await extractPlainText(buf);
    expect(text).toBe("Hello world plain text");
  });

  it("extractPdf handles buffer or errors gracefully", async () => {
    const buf = Buffer.from("not a pdf", "utf-8");
    await expect(extractPdf(buf)).rejects.toThrow();
  });
});
