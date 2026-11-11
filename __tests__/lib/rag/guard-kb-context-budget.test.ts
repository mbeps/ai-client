import { describe, expect, it } from "vitest";
import { guardKbContextBudget } from "@/lib/rag/guard-kb-context-budget";

describe("guardKbContextBudget", () => {
  const sampleDoc = {
    tokenCount: 10_000,
    chunkCount: 20,
    tableOfContents: [
      { title: "Introduction", chunkStartIndex: 0, chunkEndIndex: 4 },
      { title: "Architecture", chunkStartIndex: 5, chunkEndIndex: 14 },
      { title: "Conclusion", chunkStartIndex: 15, chunkEndIndex: 19 },
    ],
  };

  it("permits reading full document when within usable budget", () => {
    // 32k window -> 75% is 24,000. Used: 2,000. Usable: 22,000.
    // Doc tokens: 10,000 <= 22,000 -> safeToRead: true
    const result = guardKbContextBudget({
      targetDoc: sampleDoc,
      modelContextWindow: 32_768,
      usedTokens: 2_000,
    });

    expect(result.safeToRead).toBe(true);
    expect(result.estimatedSliceTokens).toBe(10_000);
    expect(result.usableBudget).toBe(22_576);
    expect(result.outlineFallback).toBeUndefined();
  });

  it("blocks reading full document when exceeding usable budget on smaller context model", () => {
    // 8k window (8192) -> 75% is 6,144. Used: 1,000. Usable: 5,144.
    // Doc tokens: 10,000 > 5,144 -> safeToRead: false
    const result = guardKbContextBudget({
      targetDoc: sampleDoc,
      modelContextWindow: 8_192,
      usedTokens: 1_000,
    });

    expect(result.safeToRead).toBe(false);
    expect(result.estimatedSliceTokens).toBe(10_000);
    expect(result.usableBudget).toBe(5_144);
    expect(result.outlineFallback).toEqual(sampleDoc.tableOfContents);
  });

  it("permits reading a slice when slice estimated tokens fit within budget", () => {
    // 8k window (8192) -> 75% is 6,144. Used: 1,000. Usable: 5,144.
    // Slice: chunks 0-4 (5 chunks out of 20 = 25% of 10,000 = 2,500 tokens)
    // 2,500 <= 5,144 -> safeToRead: true
    const result = guardKbContextBudget({
      targetDoc: sampleDoc,
      modelContextWindow: 8_192,
      usedTokens: 1_000,
      chunkStartIndex: 0,
      chunkEndIndex: 4,
    });

    expect(result.safeToRead).toBe(true);
    expect(result.estimatedSliceTokens).toBe(2_500);
    expect(result.usableBudget).toBe(5_144);
  });

  it("handles slice with only chunkStartIndex defined", () => {
    const result = guardKbContextBudget({
      targetDoc: sampleDoc,
      modelContextWindow: 32_768,
      usedTokens: 0,
      chunkStartIndex: 15,
      chunkEndIndex: undefined,
    });

    expect(result.safeToRead).toBe(true);
    // Chunks 15 to 19 -> 5 chunks = 2,500 tokens
    expect(result.estimatedSliceTokens).toBe(2_500);
  });

  it("handles slice with only chunkEndIndex defined", () => {
    const result = guardKbContextBudget({
      targetDoc: sampleDoc,
      modelContextWindow: 32_768,
      usedTokens: 0,
      chunkStartIndex: undefined,
      chunkEndIndex: 4,
    });

    expect(result.safeToRead).toBe(true);
    // Chunks 0 to 4 -> 5 chunks = 2,500 tokens
    expect(result.estimatedSliceTokens).toBe(2_500);
  });

  it("uses default 16,384 context window when modelContextWindow is not provided", () => {
    // Default 16,384 -> 75% is 12,288. Used: 5,000. Usable: 7,288.
    // Doc tokens: 10,000 > 7,288 -> blocks full read
    const result = guardKbContextBudget({
      targetDoc: sampleDoc,
      usedTokens: 5_000,
    });

    expect(result.safeToRead).toBe(false);
    expect(result.usableBudget).toBe(7_288);
    expect(result.outlineFallback).toBeDefined();
  });

  it("handles inverted or out-of-range slice indices gracefully", () => {
    const result = guardKbContextBudget({
      targetDoc: sampleDoc,
      modelContextWindow: 16_384,
      usedTokens: 0,
      chunkStartIndex: 10,
      chunkEndIndex: 5, // inverted -> 0 length
    });

    expect(result.safeToRead).toBe(true);
    expect(result.estimatedSliceTokens).toBe(0);
  });

  it("blocks when usedTokens already exhausts budget", () => {
    const result = guardKbContextBudget({
      targetDoc: sampleDoc,
      modelContextWindow: 8_000,
      usedTokens: 7_000, // 75% of 8000 is 6000 -> usable is -1000
    });

    expect(result.safeToRead).toBe(false);
    expect(result.usableBudget).toBe(-1000);
    expect(result.outlineFallback).toEqual(sampleDoc.tableOfContents);
  });

  it("handles zero tokenCount and zero chunkCount safely", () => {
    const result = guardKbContextBudget({
      targetDoc: {
        tokenCount: 0,
        chunkCount: 0,
        tableOfContents: [],
      },
      modelContextWindow: 16_384,
      usedTokens: 0,
    });

    expect(result.safeToRead).toBe(true);
    expect(result.estimatedSliceTokens).toBe(0);
  });
});
