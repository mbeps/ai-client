import { describe, it, expect } from "vitest";
import { CHUNK_CONSTANTS } from "../../../constants/chunk";
import { chunkText } from "../../../lib/rag/chunk-text";

describe("chunkText", () => {
  it("returns empty array for empty string", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns single chunk for short text", () => {
    const text = "Hello world.";
    expect(chunkText(text)).toEqual([text]);
  });

  it("returns single chunk when text is exactly at chunkSize", () => {
    const text = "a".repeat(100);
    const chunks = chunkText(text, { chunkSize: 100 });
    expect(chunks).toHaveLength(1);
  });

  it("splits on paragraph boundaries", () => {
    const text = "Paragraph one.\n\nParagraph two.\n\nParagraph three.";
    const chunks = chunkText(text, { chunkSize: 30 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain("Paragraph one");
  });

  it("does not split text shorter than chunkSize", () => {
    const text = "Short text that fits.";
    const chunks = chunkText(text, { chunkSize: 1000 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it("produces multiple chunks for long text", () => {
    const text = "word ".repeat(500);
    const chunks = chunkText(text, { chunkSize: 200, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("all chunks are non-empty strings", () => {
    // Provide a large enough text to ensure multiple chunks with defaults
    const text = "A long document. ".repeat(CHUNK_CONSTANTS.DEFAULT_CHARS / 5);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.trim().length > 0)).toBe(true);
  });
});
